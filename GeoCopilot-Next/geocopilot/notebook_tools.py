"""Notebook-native MCP tools backed by Jupyter Server Documents.

All public paths are relative to ``ServerApp.root_dir``. Cell mutations use
nbformat cell IDs and optimistic concurrency checks so a collaborative edit is
never silently overwritten.
"""

from __future__ import annotations

import asyncio
import base64
import hashlib
import json
import uuid
from pathlib import Path, PurePosixPath, PureWindowsPath
from typing import Any, Literal

import nbformat
from fastmcp.tools import ToolResult
from jupyter_server.serverapp import ServerApp
from jupyter_server.utils import ensure_async
from mcp.types import ImageContent, TextContent

from .errors import RevisionConflict, WorkspacePathError

_MAX_INLINE_OUTPUT = 20_000
_MAX_AUTO_IMAGES = 3
_VARIABLES_MARKER = "__GEOCOPILOT_KERNEL_VARIABLES__"
_RASTER_IMAGE_MIMES = (
    "image/png",
    "image/jpeg",
    "image/gif",
    "image/webp",
)


def _serverapp() -> ServerApp:
    return ServerApp.instance()


def resolve_workspace_path(path: str, *, must_exist: bool = True) -> tuple[str, Path]:
    """Validate a user/tool supplied notebook path against Jupyter's root."""
    raw = str(path or "").strip().replace("\\", "/")
    posix = PurePosixPath(raw)
    if (
        not raw
        or "\x00" in raw
        or posix.is_absolute()
        or PureWindowsPath(raw).is_absolute()
        or ".." in posix.parts
    ):
        raise WorkspacePathError("path must be a safe path relative to root_dir")

    relative = posix.as_posix()
    while relative.startswith("./"):
        relative = relative[2:]
    if not relative or not relative.endswith(".ipynb"):
        raise WorkspacePathError("notebook path must end with .ipynb")

    root = Path(_serverapp().root_dir).expanduser().resolve()
    candidate = root.joinpath(*PurePosixPath(relative).parts)
    try:
        resolved = candidate.resolve(strict=must_exist)
    except FileNotFoundError as exc:
        raise FileNotFoundError(relative) from exc
    try:
        resolved.relative_to(root)
    except ValueError as exc:
        raise WorkspacePathError("path resolves outside root_dir") from exc

    if must_exist and not resolved.is_file():
        raise FileNotFoundError(relative)
    if not must_exist:
        parent = candidate.parent.resolve(strict=True)
        try:
            parent.relative_to(root)
        except ValueError as exc:
            raise WorkspacePathError("parent directory resolves outside root_dir") from exc
        resolved = candidate
    return relative, resolved


def source_hash(source: str) -> str:
    return hashlib.sha256(source.encode("utf-8")).hexdigest()


def _plain(value: Any) -> Any:
    if hasattr(value, "to_py"):
        return value.to_py()
    return value


def _document_source(ydoc: Any) -> dict[str, Any]:
    source = _plain(ydoc.source)
    if not isinstance(source, dict):
        raise RuntimeError("Notebook YDoc did not provide notebook JSON")
    return source


def notebook_revision(ydoc: Any) -> str:
    encoded = json.dumps(
        _document_source(ydoc),
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
    ).encode("utf-8")
    return hashlib.sha256(encoded).hexdigest()


async def _room_for(path: str) -> tuple[str, Any, Any]:
    relative, _ = resolve_workspace_path(path)
    app = _serverapp()
    settings = app.web_app.settings
    file_id = settings["file_id_manager"].index(relative)
    room = settings["yroom_manager"].get_room(f"json:notebook:{file_id}")
    if room is None:
        raise RuntimeError(f"Could not create a document room for {relative}")
    ydoc = await room.get_jupyter_ydoc()
    return relative, room, ydoc


def _find_cell(ydoc: Any, cell_id: str) -> tuple[int, Any]:
    if not cell_id or str(cell_id).isdigit():
        raise ValueError("cell_id must be a stable nbformat cell ID, not an index")
    for index, cell in enumerate(ydoc.ycells):
        if str(cell.get("id") or "") == cell_id:
            return index, cell
    raise LookupError(f"Cell {cell_id!r} was not found")


def _cell_source(cell: Any) -> str:
    return str(_plain(cell).get("source") or "")


def _replace_cell_source(cell: Any, new_source: str) -> None:
    current = _cell_source(cell)
    if current == new_source:
        return
    shared_source = cell["source"]
    shared_source.clear()
    shared_source += new_source


def _text_value(value: Any) -> str:
    if isinstance(value, list):
        return "".join(map(str, value))
    return str(value or "")


def _inline_text(value: Any) -> dict[str, Any]:
    text = _text_value(value)
    return {
        "text": text[:_MAX_INLINE_OUTPUT],
        "characterCount": len(text),
        "truncated": len(text) > _MAX_INLINE_OUTPUT,
    }


def _output_summary(output: dict[str, Any], output_index: int | None = None) -> dict[str, Any]:
    output_type = str(output.get("output_type") or "unknown")
    result: dict[str, Any] = {"outputType": output_type}
    if output_index is not None:
        result["outputIndex"] = output_index
    if output_type == "stream":
        result.update(
            {
                "streamName": str(output.get("name") or ""),
                **_inline_text(output.get("text")),
            }
        )
        return result
    if output_type == "error":
        traceback = output.get("traceback") or []
        result.update(
            {
                "ename": output.get("ename") or "",
                "evalue": output.get("evalue") or "",
                "traceback": list(map(str, traceback))[-40:],
                "tracebackLineCount": len(traceback),
                "tracebackTruncated": len(traceback) > 40,
            }
        )
        return result
    if output_type in {"display_data", "execute_result"}:
        data = output.get("data") if isinstance(output.get("data"), dict) else {}
        mime_types = sorted(map(str, data))
        text_mime = next(
            (mime for mime in ("text/plain", "text/markdown", "text/html") if data.get(mime)),
            "",
        )
        result.update(
            {
                "mimeTypes": mime_types,
                "textMimeType": text_mime,
                **_inline_text(data.get(text_mime) if text_mime else ""),
                "hasImage": any(mime in data for mime in _RASTER_IMAGE_MIMES),
            }
        )
        if output_type == "execute_result":
            result["executionCount"] = output.get("execution_count")
        return result
    return result


def _output_observation(
    outputs: list[dict[str, Any]], output_indexes: list[int] | None = None
) -> dict[str, Any]:
    indexes = output_indexes or list(range(len(outputs)))
    stream_names = [
        str(output.get("name") or "") for output in outputs if output.get("output_type") == "stream"
    ]
    image_indexes = [
        indexes[position]
        for position, output in enumerate(outputs)
        if isinstance(output.get("data"), dict)
        and any(mime in output["data"] for mime in _RASTER_IMAGE_MIMES)
    ]
    return {
        "outputCount": len(outputs),
        "stdoutCount": stream_names.count("stdout"),
        "stderrCount": stream_names.count("stderr"),
        "errorCount": sum(output.get("output_type") == "error" for output in outputs),
        "richOutputCount": sum(
            output.get("output_type") in {"display_data", "execute_result"} for output in outputs
        ),
        "imageOutputIndexes": image_indexes,
        "hasStdout": "stdout" in stream_names,
        "hasStderr": "stderr" in stream_names,
        "hasError": any(output.get("output_type") == "error" for output in outputs),
        "hasImages": bool(image_indexes),
    }


def _image_content(output: dict[str, Any]) -> ImageContent | None:
    data = output.get("data") if isinstance(output.get("data"), dict) else {}
    for mime in _RASTER_IMAGE_MIMES:
        encoded = data.get(mime)
        if not encoded:
            continue
        normalized = "".join(_text_value(encoded).split())
        # Follow Jupyter AI Tools: pass through the notebook's base64 payload.
        base64.b64decode(normalized, validate=True)
        return ImageContent(type="image", data=normalized, mimeType=mime)
    return None


def _observation_result(
    payload: dict[str, Any],
    indexed_outputs: list[tuple[int, dict[str, Any]]],
    *,
    max_images: int = _MAX_AUTO_IMAGES,
) -> ToolResult:
    """Return evidence through MCP's structured text and native image channels."""
    image_blocks: list[Any] = []
    image_count = 0
    for output_index, output in indexed_outputs:
        image = _image_content(output)
        if image is None:
            continue
        if image_count >= max_images:
            break
        image_blocks.extend(
            [
                TextContent(type="text", text=f"Raster output at index {output_index}:"),
                image,
            ]
        )
        image_count += 1

    payload["automaticallyIncludedImageCount"] = image_count
    payload["automaticImageLimit"] = max_images
    content = [
        TextContent(
            type="text",
            text=json.dumps(payload, ensure_ascii=False, separators=(",", ":")),
        ),
        *image_blocks,
    ]
    return ToolResult(content=content, structured_content=payload)


def _cell_payload(cell: Any, *, include_outputs: bool) -> dict[str, Any]:
    value = _plain(cell)
    result: dict[str, Any] = {
        "cellId": str(value.get("id") or ""),
        "cellType": str(value.get("cell_type") or ""),
        "source": str(value.get("source") or ""),
        "sourceHash": source_hash(str(value.get("source") or "")),
        "metadata": value.get("metadata") or {},
    }
    if value.get("cell_type") == "code":
        result["executionCount"] = value.get("execution_count")
        result["executionState"] = value.get("execution_state") or "idle"
        if include_outputs:
            result["outputs"] = [
                _output_summary(_plain(output), index)
                for index, output in enumerate(value.get("outputs") or [])
                if isinstance(_plain(output), dict)
            ]
    return result


async def notebook_list_open() -> dict[str, Any]:
    """List notebook documents currently open in this Jupyter Server."""
    app = _serverapp()
    manager = app.web_app.settings["yroom_manager"]
    open_paths: set[str] = set()
    for room in manager.list_document_rooms():
        if not room.room_id.startswith("json:notebook:"):
            continue
        if getattr(room, "clients", None) is not None and room.clients.count == 0:
            continue
        if room.file_api:
            open_paths.add(str(room.file_api.get_path()))

    sessions = await ensure_async(app.session_manager.list_sessions())
    session_by_path = {
        str(session.get("path") or ""): {
            "kernelSessionId": str(session.get("id") or ""),
            "kernelId": str((session.get("kernel") or {}).get("id") or ""),
            "kernelName": str((session.get("kernel") or {}).get("name") or ""),
        }
        for session in sessions
        if session.get("type") == "notebook"
    }
    return {
        "notebooks": [
            {"path": path, **session_by_path.get(path, {})}
            for path in sorted(open_paths | set(session_by_path))
        ]
    }


async def notebook_read(
    path: str,
    cell_ids: list[str] | None = None,
    start: int = 0,
    limit: int = 100,
    include_outputs: bool = False,
) -> dict[str, Any]:
    """Read notebook cells by stable ID or range and return revision metadata."""
    relative, _room, ydoc = await _room_for(path)
    cells = list(ydoc.ycells)
    if cell_ids:
        wanted = set(cell_ids)
        if any(str(cell_id).isdigit() for cell_id in wanted):
            raise ValueError("cell_ids accepts stable cell IDs, not indexes")
        selected = [cell for cell in cells if str(cell.get("id") or "") in wanted]
        found = {str(cell.get("id") or "") for cell in selected}
        missing = [cell_id for cell_id in cell_ids if cell_id not in found]
        if missing:
            raise LookupError(f"Cells not found: {', '.join(missing)}")
    else:
        selected = cells[max(start, 0) : max(start, 0) + min(max(limit, 1), 500)]
    document = _document_source(ydoc)
    return {
        "path": relative,
        "revision": notebook_revision(ydoc),
        "cellCount": len(cells),
        "metadata": document.get("metadata") or {},
        "cells": [_cell_payload(cell, include_outputs=include_outputs) for cell in selected],
    }


async def notebook_read_cell(
    path: str, cell_id: str, include_outputs: bool = True
) -> dict[str, Any]:
    """Read one notebook cell using its stable nbformat cell ID."""
    relative, _room, ydoc = await _room_for(path)
    _index, cell = _find_cell(ydoc, cell_id)
    return {
        "path": relative,
        "revision": notebook_revision(ydoc),
        "cell": _cell_payload(cell, include_outputs=include_outputs),
    }


async def notebook_create(path: str, kernel_name: str = "python3") -> dict[str, Any]:
    """Create a new notebook below root_dir and return its initial revision."""
    relative, resolved = resolve_workspace_path(path, must_exist=False)
    if resolved.exists():
        raise FileExistsError(relative)
    notebook = nbformat.v4.new_notebook()
    notebook.metadata["kernelspec"] = {
        "display_name": kernel_name,
        "language": "python",
        "name": kernel_name,
    }
    model = {"type": "notebook", "format": "json", "content": notebook}
    await ensure_async(_serverapp().contents_manager.save(model, relative))
    _relative, _room, ydoc = await _room_for(relative)
    return {"path": relative, "revision": notebook_revision(ydoc), "created": True}


async def notebook_insert_cell(
    path: str,
    cell_type: Literal["code", "markdown", "raw"],
    source: str,
    expected_revision: str,
    before_cell_id: str | None = None,
    after_cell_id: str | None = None,
) -> dict[str, Any]:
    """Insert a cell after checking the caller's notebook revision."""
    if before_cell_id and after_cell_id:
        raise ValueError("Specify only one of before_cell_id or after_cell_id")
    if cell_type not in {"code", "markdown", "raw"}:
        raise ValueError("cell_type must be code, markdown, or raw")
    relative, room, ydoc = await _room_for(path)
    current_revision = notebook_revision(ydoc)
    if expected_revision != current_revision:
        raise RevisionConflict(
            f"revision_conflict: expected {expected_revision}, current {current_revision}"
        )

    index = len(ydoc.ycells)
    if before_cell_id:
        index, _ = _find_cell(ydoc, before_cell_id)
    elif after_cell_id:
        index, _ = _find_cell(ydoc, after_cell_id)
        index += 1
    cell: dict[str, Any] = {
        "id": uuid.uuid4().hex[:8],
        "cell_type": cell_type,
        "metadata": {},
        "source": "",
    }
    if cell_type == "code":
        cell.update({"execution_count": None, "outputs": []})
    ycell = ydoc.create_ycell(cell)
    if index >= len(ydoc.ycells):
        ydoc.ycells.append(ycell)
    else:
        ydoc.ycells.insert(index, ycell)
    _replace_cell_source(ycell, source)
    await room.file_api.save(ydoc)
    return {
        "path": relative,
        "cellId": str(ycell.get("id")),
        "sourceHash": source_hash(source),
        "revision": notebook_revision(ydoc),
    }


async def notebook_update_cell(
    path: str, cell_id: str, source: str, expected_source_hash: str
) -> dict[str, Any]:
    """Replace a cell's source when its source hash still matches."""
    relative, room, ydoc = await _room_for(path)
    _index, cell = _find_cell(ydoc, cell_id)
    current_source = _cell_source(cell)
    current_hash = source_hash(current_source)
    if expected_source_hash != current_hash:
        raise RevisionConflict(f"revision_conflict: cell {cell_id} has source hash {current_hash}")
    _replace_cell_source(cell, source)
    await room.file_api.save(ydoc)
    return {
        "path": relative,
        "cellId": cell_id,
        "sourceHash": source_hash(source),
        "revision": notebook_revision(ydoc),
    }


async def notebook_delete_cell(
    path: str, cell_id: str, expected_source_hash: str
) -> dict[str, Any]:
    """Delete a cell when its current source hash still matches."""
    relative, room, ydoc = await _room_for(path)
    index, cell = _find_cell(ydoc, cell_id)
    current_hash = source_hash(_cell_source(cell))
    if expected_source_hash != current_hash:
        raise RevisionConflict(f"revision_conflict: cell {cell_id} has source hash {current_hash}")
    del ydoc.ycells[index]
    await room.file_api.save(ydoc)
    return {
        "path": relative,
        "deletedCellId": cell_id,
        "revision": notebook_revision(ydoc),
    }


async def _ensure_kernel_session(path: str, ydoc: Any) -> dict[str, Any]:
    app = _serverapp()
    sessions = await ensure_async(app.session_manager.list_sessions())
    for session in sessions:
        if session.get("type") == "notebook" and session.get("path") == path:
            return session
    metadata = _document_source(ydoc).get("metadata") or {}
    kernel_name = str((metadata.get("kernelspec") or {}).get("name") or "python3")
    return await ensure_async(
        app.session_manager.create_session(
            path=path,
            name=Path(path).name,
            type="notebook",
            kernel_name=kernel_name,
        )
    )


async def _notebook_session(path: str) -> dict[str, Any] | None:
    sessions = await ensure_async(_serverapp().session_manager.list_sessions())
    return next(
        (
            session
            for session in sessions
            if session.get("type") == "notebook" and session.get("path") == path
        ),
        None,
    )


def _kernel_model(kernel_id: str) -> dict[str, Any]:
    if not kernel_id:
        return {}
    app = _serverapp()
    return next(
        (
            model
            for model in app.kernel_manager.list_kernels()
            if str(model.get("id") or "") == kernel_id
        ),
        {},
    )


async def _kernel_session_for(
    path: str, *, create: bool
) -> tuple[str, dict[str, Any] | None, dict[str, Any]]:
    relative, _ = resolve_workspace_path(path)
    session = await _notebook_session(relative)
    if session is None and create:
        _relative, _room, ydoc = await _room_for(relative)
        session = await _ensure_kernel_session(relative, ydoc)
    kernel = session.get("kernel") if isinstance(session, dict) else {}
    kernel_id = str((kernel or {}).get("id") or "")
    return relative, session, _kernel_model(kernel_id)


async def notebook_kernel_status(path: str) -> dict[str, Any]:
    """Report the server-side kernel state for a notebook without starting it."""
    relative, session, model = await _kernel_session_for(path, create=False)
    if session is None:
        return {
            "path": relative,
            "kernelStatus": "not_started",
            "kernelSessionId": "",
            "kernelId": "",
            "kernelName": "",
        }
    kernel = session.get("kernel") or {}
    kernel_id = str(kernel.get("id") or "")
    return {
        "path": relative,
        "kernelStatus": str(
            model.get("execution_state") or kernel.get("execution_state") or "unknown"
        ),
        "kernelSessionId": str(session.get("id") or ""),
        "kernelId": kernel_id,
        "kernelName": str(model.get("name") or kernel.get("name") or ""),
        "connections": model.get("connections"),
        "lastActivity": (
            str(model.get("last_activity")) if model.get("last_activity") is not None else ""
        ),
        "alive": bool(kernel_id and kernel_id in _serverapp().kernel_manager),
    }


async def _execute_kernel_probe(kernel_id: str, code: str, timeout: float) -> str:
    """Execute a private, history-free probe and return its stdout."""
    if not kernel_id or kernel_id not in _serverapp().kernel_manager:
        raise RuntimeError("Notebook kernel is not available")
    kernel = _serverapp().kernel_manager.get_kernel(kernel_id)
    client = kernel.client()
    client.start_channels()
    output: list[str] = []
    try:
        await client.wait_for_ready(timeout=min(max(timeout, 1), 30))
        message_id = client.execute(
            code,
            silent=False,
            store_history=False,
            allow_stdin=False,
            stop_on_error=False,
        )
        loop = asyncio.get_running_loop()
        deadline = loop.time() + min(max(timeout, 1), 120)
        while True:
            remaining = deadline - loop.time()
            if remaining <= 0:
                raise TimeoutError("Kernel inspection did not finish before the timeout")
            message = await asyncio.wait_for(client.get_iopub_msg(), timeout=remaining)
            parent = message.get("parent_header") or {}
            if str(parent.get("msg_id") or "") != str(message_id):
                continue
            message_type = str(message.get("msg_type") or "")
            content = message.get("content") or {}
            if message_type == "stream" and content.get("name") == "stdout":
                output.append(_text_value(content.get("text")))
            elif message_type == "error":
                error_name = str(content.get("ename") or "KernelError")
                error_value = str(content.get("evalue") or "")
                raise RuntimeError(f"{error_name}: {error_value}".rstrip(": "))
            elif message_type == "status" and content.get("execution_state") == "idle":
                break
    finally:
        client.stop_channels()
    return "".join(output)


async def notebook_list_variables(path: str, limit: int = 100) -> dict[str, Any]:
    """List safe metadata for variables in a notebook's live IPython namespace."""
    relative, session, _model = await _kernel_session_for(path, create=False)
    if session is None:
        return {
            "path": relative,
            "kernelStatus": "not_started",
            "variables": [],
            "variableCount": 0,
            "truncated": False,
        }
    kernel = session.get("kernel") or {}
    kernel_id = str(kernel.get("id") or "")
    bounded_limit = min(max(int(limit), 1), 500)
    code = f"""
def __geocopilot_describe_namespace():
    import json
    import sys

    namespace = get_ipython().user_ns
    ignored = {{"In", "Out", "get_ipython", "exit", "quit", "open"}}
    descriptions = []
    for name in sorted(namespace):
        if name.startswith("_") or name in ignored:
            continue
        value = namespace[name]
        item = {{
            "name": name,
            "type": type(value).__name__,
            "module": type(value).__module__,
        }}
        try:
            item["sizeBytesShallow"] = int(sys.getsizeof(value))
        except Exception:
            pass
        try:
            shape = getattr(value, "shape", None)
            if shape is not None:
                item["shape"] = [int(part) for part in tuple(shape)]
        except Exception:
            pass
        try:
            dtype = getattr(value, "dtype", None)
            if dtype is not None:
                item["dtype"] = str(dtype)
        except Exception:
            pass
        try:
            columns = getattr(value, "columns", None)
            if columns is not None:
                values = [str(column) for column in list(columns)]
                item["columns"] = values[:30]
                item["columnCount"] = len(values)
        except Exception:
            pass
        try:
            crs = getattr(value, "crs", None)
            if crs is not None:
                item["crs"] = str(crs)
        except Exception:
            pass
        descriptions.append(item)
    return descriptions

try:
    __geocopilot_variables = __geocopilot_describe_namespace()
    print(
        "{_VARIABLES_MARKER}"
        + __import__("json").dumps(
            {{
                "variables": __geocopilot_variables[:{bounded_limit}],
                "variableCount": len(__geocopilot_variables),
                "truncated": len(__geocopilot_variables) > {bounded_limit},
            }},
            ensure_ascii=False,
        )
    )
finally:
    globals().pop("__geocopilot_variables", None)
    globals().pop("__geocopilot_describe_namespace", None)
"""
    stdout = await _execute_kernel_probe(kernel_id, code, timeout=30)
    marker_index = stdout.rfind(_VARIABLES_MARKER)
    if marker_index < 0:
        raise RuntimeError("Kernel variable probe returned no structured result")
    payload = json.loads(stdout[marker_index + len(_VARIABLES_MARKER) :].strip())
    return {
        "path": relative,
        "kernelStatus": "idle",
        "kernelSessionId": str(session.get("id") or ""),
        "kernelId": kernel_id,
        **payload,
    }


async def notebook_interrupt_kernel(path: str) -> dict[str, Any]:
    """Interrupt the live kernel associated with a notebook."""
    relative, session, _model = await _kernel_session_for(path, create=False)
    if session is None:
        raise RuntimeError(f"Notebook {relative} has no running kernel")
    kernel_id = str((session.get("kernel") or {}).get("id") or "")
    if not kernel_id or kernel_id not in _serverapp().kernel_manager:
        raise RuntimeError(f"Notebook {relative} has no available kernel")
    await ensure_async(_serverapp().kernel_manager.interrupt_kernel(kernel_id))
    return {
        "path": relative,
        "kernelSessionId": str(session.get("id") or ""),
        "kernelId": kernel_id,
        "interrupted": True,
    }


async def notebook_restart_kernel(path: str) -> dict[str, Any]:
    """Restart a notebook kernel, clearing all memory-resident state."""
    relative, session, _model = await _kernel_session_for(path, create=True)
    if session is None:
        raise RuntimeError(f"Could not create a kernel session for {relative}")
    app = _serverapp()
    kernel = session.get("kernel") or {}
    kernel_id = str(kernel.get("id") or "")
    restarted = True
    if kernel_id and kernel_id in app.kernel_manager:
        await ensure_async(app.kernel_manager.restart_kernel(kernel_id))
    else:
        kernel_name = str(kernel.get("name") or "python3")
        kernel_id = await ensure_async(
            app.kernel_manager.start_kernel(path=relative, kernel_name=kernel_name)
        )
        await ensure_async(
            app.session_manager.update_session(
                str(session.get("id") or ""),
                kernel_id=kernel_id,
            )
        )
        restarted = False
    return {
        "path": relative,
        "kernelSessionId": str(session.get("id") or ""),
        "kernelId": kernel_id,
        "kernelName": str(kernel.get("name") or ""),
        "restarted": restarted,
        "startedFresh": not restarted,
        "memoryStateCleared": True,
    }


async def notebook_run_cell(
    path: str,
    cell_id: str,
    expected_source_hash: str,
    timeout: float = 120,
) -> ToolResult:
    """Execute a cell and return structured streams, errors, rich output, and images."""
    relative, room, ydoc = await _room_for(path)
    _index, cell = _find_cell(ydoc, cell_id)
    current_source = _cell_source(cell)
    current_hash = source_hash(current_source)
    if expected_source_hash != current_hash:
        raise RevisionConflict(f"revision_conflict: cell {cell_id} has source hash {current_hash}")
    session = await _ensure_kernel_session(relative, ydoc)
    # Session creation connects this exact YNotebookRoom to its kernel.
    _relative, room, ydoc = await _room_for(relative)
    _index, cell = _find_cell(ydoc, cell_id)
    current_source = _cell_source(cell)
    current_hash = source_hash(current_source)
    if expected_source_hash != current_hash:
        raise RevisionConflict(f"revision_conflict: cell {cell_id} has source hash {current_hash}")
    from jupyter_server_documents.rooms.ynotebook_room import _source_hash

    loop = asyncio.get_running_loop()
    started_at = loop.time()
    await room.execute_cell(
        cell_id,
        source_hash=_source_hash(current_source),
        clear_outputs=True,
        request_id=uuid.uuid4().hex,
    )
    deadline = loop.time() + min(max(timeout, 1), 3600)
    while str(cell.get("execution_state") or "idle") != "idle":
        if loop.time() >= deadline:
            kernel_id = str((session.get("kernel") or {}).get("id") or "")
            if kernel_id and kernel_id in _serverapp().kernel_manager:
                await ensure_async(_serverapp().kernel_manager.interrupt_kernel(kernel_id))
            raise TimeoutError(f"Cell {cell_id} did not finish within {timeout} seconds")
        await asyncio.sleep(0.1)
    await room.file_api.save(ydoc)
    value = _plain(cell)
    outputs = [
        _plain(output)
        for output in (value.get("outputs") or [])
        if isinstance(_plain(output), dict)
    ]
    payload = {
        "path": relative,
        "cellId": cell_id,
        "kernelSessionId": str(session.get("id") or ""),
        "executionState": "completed",
        "durationMs": max(0, round((loop.time() - started_at) * 1000)),
        "cell": _cell_payload(cell, include_outputs=True),
        "observation": _output_observation(outputs),
        "revision": notebook_revision(ydoc),
    }
    return _observation_result(payload, list(enumerate(outputs)))


async def notebook_read_output(
    path: str,
    cell_id: str,
    output_index: int | None = None,
    mode: Literal["auto", "text", "image", "json"] = "auto",
) -> Any:
    """Read output evidence; auto mode returns summaries and raster ImageContent."""
    relative, _room, ydoc = await _room_for(path)
    _index, cell = _find_cell(ydoc, cell_id)
    value = _plain(cell)
    indexed_outputs = [
        (index, _plain(output))
        for index, output in enumerate(value.get("outputs") or [])
        if isinstance(_plain(output), dict)
    ]
    if output_index is not None:
        if output_index < 0 or output_index >= len(indexed_outputs):
            raise IndexError(f"output_index {output_index} is out of range")
        indexed_outputs = [indexed_outputs[output_index]]

    if mode == "image":
        for _index, output in indexed_outputs:
            image = _image_content(output)
            if image is not None:
                return image
        raise LookupError(f"No supported raster image output found in cell {cell_id}")

    outputs = [output for _index, output in indexed_outputs]
    if mode == "json":
        return {"outputs": outputs}
    payload = {
        "path": relative,
        "cellId": cell_id,
        "outputs": [_output_summary(output, index) for index, output in indexed_outputs],
        "observation": _output_observation(outputs, [index for index, _output in indexed_outputs]),
    }
    if mode == "auto":
        return _observation_result(payload, indexed_outputs)
    return payload


async def notebook_save(path: str, expected_revision: str | None = None) -> dict[str, Any]:
    """Save the current YDoc, optionally requiring an exact notebook revision."""
    relative, room, ydoc = await _room_for(path)
    current_revision = notebook_revision(ydoc)
    if expected_revision is not None and expected_revision != current_revision:
        raise RevisionConflict(
            f"revision_conflict: expected {expected_revision}, current {current_revision}"
        )
    await room.file_api.save(ydoc)
    return {"path": relative, "revision": notebook_revision(ydoc), "saved": True}


def _mcp_name(function: Any, name: str) -> None:
    function.__name__ = name
    function.__qualname__ = name


_mcp_name(notebook_list_open, "notebook.list_open")
_mcp_name(notebook_read, "notebook.read")
_mcp_name(notebook_read_cell, "notebook.read_cell")
_mcp_name(notebook_create, "notebook.create")
_mcp_name(notebook_insert_cell, "notebook.insert_cell")
_mcp_name(notebook_update_cell, "notebook.update_cell")
_mcp_name(notebook_delete_cell, "notebook.delete_cell")
_mcp_name(notebook_kernel_status, "notebook.kernel_status")
_mcp_name(notebook_list_variables, "notebook.list_variables")
_mcp_name(notebook_interrupt_kernel, "notebook.interrupt_kernel")
_mcp_name(notebook_restart_kernel, "notebook.restart_kernel")
_mcp_name(notebook_run_cell, "notebook.run_cell")
_mcp_name(notebook_read_output, "notebook.read_output")
_mcp_name(notebook_save, "notebook.save")

TOOLS = [
    "geocopilot.notebook_tools:notebook_list_open",
    "geocopilot.notebook_tools:notebook_read",
    "geocopilot.notebook_tools:notebook_read_cell",
    "geocopilot.notebook_tools:notebook_create",
    "geocopilot.notebook_tools:notebook_insert_cell",
    "geocopilot.notebook_tools:notebook_update_cell",
    "geocopilot.notebook_tools:notebook_delete_cell",
    "geocopilot.notebook_tools:notebook_kernel_status",
    "geocopilot.notebook_tools:notebook_list_variables",
    "geocopilot.notebook_tools:notebook_interrupt_kernel",
    "geocopilot.notebook_tools:notebook_restart_kernel",
    "geocopilot.notebook_tools:notebook_run_cell",
    "geocopilot.notebook_tools:notebook_read_output",
    "geocopilot.notebook_tools:notebook_save",
]
