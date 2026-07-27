from __future__ import annotations

import pytest
from fastmcp.tools import ToolResult
from mcp.types import ImageContent
from traitlets.config import Config

from geocopilot.notebook_tools import (
    notebook_create,
    notebook_insert_cell,
    notebook_kernel_status,
    notebook_list_variables,
    notebook_read,
    notebook_read_output,
    notebook_restart_kernel,
    notebook_run_cell,
)

pytest_plugins = ("pytest_jupyter.jupyter_server",)

_ONE_PIXEL_PNG = (
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII="
)


@pytest.fixture
def jp_server_config() -> Config:
    return Config(
        {
            "ServerApp": {
                "jpserver_extensions": {
                    "geocopilot": True,
                    "jupyter_server_documents": True,
                    "jupyter_server_fileid": True,
                    "jupyter_server_mcp": True,
                    "jupyter_server_terminals": True,
                }
            },
            "MCPExtensionApp": {
                "mcp_port": 0,
                "use_tool_discovery": True,
            },
        }
    )


@pytest.mark.asyncio
async def test_real_jupyter_ydoc_kernel_and_image_output(jp_serverapp):
    created = await notebook_create("integration.ipynb")
    source = (
        "import sys\n"
        "from IPython.display import display\n"
        "workspace_value = 42\n"
        f"display({{'image/png': '{_ONE_PIXEL_PNG}', 'text/plain': 'pixel'}}, raw=True)\n"
        "print(42)\n"
        "print('check this warning', file=sys.stderr)"
    )
    inserted = await notebook_insert_cell(
        "integration.ipynb",
        "code",
        source,
        created["revision"],
    )
    executed = await notebook_run_cell(
        "integration.ipynb",
        inserted["cellId"],
        inserted["sourceHash"],
        timeout=30,
    )
    read = await notebook_read("integration.ipynb", include_outputs=True)
    image = await notebook_read_output(
        "integration.ipynb",
        inserted["cellId"],
        output_index=0,
        mode="image",
    )
    status = await notebook_kernel_status("integration.ipynb")
    variables = await notebook_list_variables("integration.ipynb")

    assert isinstance(executed, ToolResult)
    assert executed.structured_content["cell"]["executionCount"] == 1
    assert executed.structured_content["observation"]["hasStderr"] is True
    assert executed.structured_content["observation"]["hasImages"] is True
    assert any(
        output.get("streamName") == "stderr"
        for output in executed.structured_content["cell"]["outputs"]
    )
    assert any(
        output.get("text") == "42\n" for output in executed.structured_content["cell"]["outputs"]
    )
    assert any(isinstance(block, ImageContent) for block in executed.content)
    assert read["cells"][-1]["cellId"] == inserted["cellId"]
    assert isinstance(image, ImageContent)
    assert image.mimeType == "image/png"
    assert status["kernelStatus"] == "idle"
    assert any(
        variable["name"] == "workspace_value" and variable["type"] == "int"
        for variable in variables["variables"]
    )

    restarted = await notebook_restart_kernel("integration.ipynb")
    assert restarted["memoryStateCleared"] is True
    variables_after_restart = await notebook_list_variables("integration.ipynb")
    assert not any(
        variable["name"] == "workspace_value" for variable in variables_after_restart["variables"]
    )
