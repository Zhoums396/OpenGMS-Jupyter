from __future__ import annotations

from types import SimpleNamespace

import pytest
from fastmcp.tools import ToolResult
from mcp.types import ImageContent, TextContent

import geocopilot.notebook_tools as tools
from geocopilot.errors import RevisionConflict, WorkspacePathError


class SharedText:
    def __init__(self, value: str):
        self.value = value

    def clear(self) -> None:
        self.value = ""

    def __iadd__(self, value: str):
        self.value += value
        return self

    def __str__(self) -> str:
        return self.value


class Cell:
    def __init__(self, cell_id: str, source: str, cell_type: str = "code"):
        self.data = {
            "id": cell_id,
            "cell_type": cell_type,
            "metadata": {},
            "source": SharedText(source),
            "execution_count": None,
            "execution_state": "idle",
            "outputs": [],
        }

    def get(self, key: str, default=None):
        return self.data.get(key, default)

    def __getitem__(self, key: str):
        return self.data[key]

    def __setitem__(self, key: str, value):
        self.data[key] = value

    def to_py(self):
        return {
            key: str(value) if isinstance(value, SharedText) else value
            for key, value in self.data.items()
        }


class YDoc:
    def __init__(self, cells: list[Cell]):
        self.ycells = cells

    @property
    def source(self):
        return {
            "nbformat": 4,
            "nbformat_minor": 5,
            "metadata": {},
            "cells": [cell.to_py() for cell in self.ycells],
        }

    def create_ycell(self, value):
        return Cell(value["id"], value["source"], value["cell_type"])


class FileApi:
    def __init__(self):
        self.saves = 0

    async def save(self, _ydoc):
        self.saves += 1


class Room:
    def __init__(self):
        self.file_api = FileApi()


def test_workspace_path_rejects_traversal_and_symlink_escape(tmp_path, monkeypatch):
    root = tmp_path / "root"
    root.mkdir()
    notebook = root / "inside.ipynb"
    notebook.write_text("{}")
    outside = tmp_path / "outside.ipynb"
    outside.write_text("{}")
    (root / "escape.ipynb").symlink_to(outside)
    monkeypatch.setattr(tools, "_serverapp", lambda: SimpleNamespace(root_dir=str(root)))

    assert tools.resolve_workspace_path("inside.ipynb")[0] == "inside.ipynb"
    with pytest.raises(WorkspacePathError):
        tools.resolve_workspace_path("../outside.ipynb")
    with pytest.raises(WorkspacePathError):
        tools.resolve_workspace_path(str(notebook))
    with pytest.raises(WorkspacePathError):
        tools.resolve_workspace_path("escape.ipynb")


def test_output_observation_preserves_stderr_and_native_image_content():
    outputs = [
        {
            "output_type": "stream",
            "name": "stderr",
            "text": "UserWarning: missing glyph\n",
        },
        {
            "output_type": "display_data",
            "data": {
                "text/plain": "<Figure size 800x500>",
                "image/png": (
                    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0l"
                    "EQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII="
                ),
            },
        },
    ]

    summaries = [tools._output_summary(output, index) for index, output in enumerate(outputs)]
    observation = tools._output_observation(outputs)
    result = tools._observation_result(
        {"outputs": summaries, "observation": observation},
        list(enumerate(outputs)),
    )

    assert summaries[0]["streamName"] == "stderr"
    assert summaries[0]["outputIndex"] == 0
    assert observation["hasStderr"] is True
    assert observation["imageOutputIndexes"] == [1]
    assert tools._output_observation([outputs[1]], [7])["imageOutputIndexes"] == [7]
    assert isinstance(result, ToolResult)
    assert result.structured_content["automaticallyIncludedImageCount"] == 1
    assert any(isinstance(block, TextContent) for block in result.content)
    assert any(isinstance(block, ImageContent) for block in result.content)


def test_output_summary_reports_truncation(monkeypatch):
    monkeypatch.setattr(tools, "_MAX_INLINE_OUTPUT", 5)
    summary = tools._output_summary(
        {"output_type": "stream", "name": "stdout", "text": "123456789"},
        2,
    )

    assert summary == {
        "outputType": "stream",
        "outputIndex": 2,
        "streamName": "stdout",
        "text": "12345",
        "characterCount": 9,
        "truncated": True,
    }


@pytest.mark.asyncio
async def test_update_cell_checks_source_hash(monkeypatch):
    cell = Cell("stable-cell", "before")
    ydoc = YDoc([cell])
    room = Room()

    async def fake_room(_path):
        return "work.ipynb", room, ydoc

    monkeypatch.setattr(tools, "_room_for", fake_room)
    with pytest.raises(RevisionConflict):
        await tools.notebook_update_cell("work.ipynb", "stable-cell", "after", "outdated")
    assert str(cell["source"]) == "before"

    result = await tools.notebook_update_cell(
        "work.ipynb",
        "stable-cell",
        "after",
        tools.source_hash("before"),
    )
    assert result["cellId"] == "stable-cell"
    assert result["sourceHash"] == tools.source_hash("after")
    assert str(cell["source"]) == "after"
    assert room.file_api.saves == 1


@pytest.mark.asyncio
async def test_insert_cell_checks_notebook_revision_and_uses_cell_id(monkeypatch):
    ydoc = YDoc([Cell("anchor", "x")])
    room = Room()

    async def fake_room(_path):
        return "work.ipynb", room, ydoc

    monkeypatch.setattr(tools, "_room_for", fake_room)
    revision = tools.notebook_revision(ydoc)
    result = await tools.notebook_insert_cell(
        "work.ipynb",
        "markdown",
        "# Result",
        revision,
        after_cell_id="anchor",
    )
    assert result["cellId"] != "anchor"
    assert ydoc.ycells[1].get("id") == result["cellId"]
    assert str(ydoc.ycells[1]["source"]) == "# Result"


@pytest.mark.asyncio
async def test_run_cell_rechecks_hash_after_kernel_session_connects(monkeypatch):
    initial = YDoc([Cell("stable-cell", "print('before')")])
    changed = YDoc([Cell("stable-cell", "print('changed')")])
    room = Room()
    documents = iter((initial, changed))

    async def fake_room(_path):
        return "work.ipynb", room, next(documents)

    async def fake_session(_path, _ydoc):
        return {"id": "kernel-session"}

    monkeypatch.setattr(tools, "_room_for", fake_room)
    monkeypatch.setattr(tools, "_ensure_kernel_session", fake_session)

    with pytest.raises(RevisionConflict):
        await tools.notebook_run_cell(
            "work.ipynb",
            "stable-cell",
            tools.source_hash("print('before')"),
        )


def test_mcp_exports_have_planned_names():
    functions = [
        tools.notebook_list_open,
        tools.notebook_read,
        tools.notebook_read_cell,
        tools.notebook_create,
        tools.notebook_insert_cell,
        tools.notebook_update_cell,
        tools.notebook_delete_cell,
        tools.notebook_kernel_status,
        tools.notebook_list_variables,
        tools.notebook_interrupt_kernel,
        tools.notebook_restart_kernel,
        tools.notebook_run_cell,
        tools.notebook_read_output,
        tools.notebook_save,
    ]
    assert [function.__name__ for function in functions] == [
        "notebook.list_open",
        "notebook.read",
        "notebook.read_cell",
        "notebook.create",
        "notebook.insert_cell",
        "notebook.update_cell",
        "notebook.delete_cell",
        "notebook.kernel_status",
        "notebook.list_variables",
        "notebook.interrupt_kernel",
        "notebook.restart_kernel",
        "notebook.run_cell",
        "notebook.read_output",
        "notebook.save",
    ]
