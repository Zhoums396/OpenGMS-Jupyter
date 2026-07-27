from __future__ import annotations

import importlib.util
import json
from pathlib import Path
from urllib.parse import parse_qs, urlparse

SCRIPT = (
    Path(__file__).parents[1]
    / "geocopilot"
    / "skills"
    / "opengms-data-methods"
    / "scripts"
    / "method_library_rest.py"
)
SPEC = importlib.util.spec_from_file_location("method_library_rest", SCRIPT)
assert SPEC and SPEC.loader
method_library = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(method_library)


class FakeResponse:
    def __init__(self, payload):
        self.payload = payload

    def __enter__(self):
        return self

    def __exit__(self, *_args):
        return None

    def read(self):
        return json.dumps(self.payload).encode()


class FakeOpener:
    def __init__(self, responses):
        self.responses = list(responses)
        self.requests = []

    def open(self, request, timeout):
        self.requests.append((request, timeout))
        return FakeResponse(self.responses.pop(0))


def test_catalog_uses_direct_rest_contract_without_package_import():
    source = SCRIPT.read_text(encoding="utf-8")
    assert "geocopilot" not in source
    assert "DataMethodClient" not in source
    opener = FakeOpener(
        [
            {
                "code": 0,
                "msg": "success",
                "page": {
                    "totalCount": 1344,
                    "currPage": 1,
                    "pageSize": 1,
                    "totalPage": 1344,
                    "list": [
                        {
                            "id": 34,
                            "name": "BufferRaster",
                            "description": "Maps a distance-based raster buffer.",
                            "execution": "exe",
                            "tagList": ["GIS Analysis", "Distance Tools"],
                            "params": [{"Name": "Input", "Type": "DataInput"}],
                        }
                    ],
                },
            }
        ]
    )

    result = method_library.list_methods(
        "buffer",
        limit=1,
        base_url="http://methods.test",
        token="test-token",
        opener=opener,
    )

    request, timeout = opener.requests[0]
    parsed = urlparse(request.full_url)
    assert parsed.path == "/container/method/listWithTag"
    assert parse_qs(parsed.query) == {
        "page": ["1"],
        "limit": ["1"],
        "key": ["buffer"],
    }
    assert request.headers["Token"] == "test-token"
    assert timeout == 60
    assert result["totalCount"] == 1344
    assert result["methods"][0]["name"] == "BufferRaster"
    assert result["methods"][0]["parameterCount"] == 1


def test_exact_info_and_standard_invocation_preserve_native_values():
    opener = FakeOpener(
        [
            {"code": 0, "method": {"id": 34, "params": []}},
            {
                "code": 0,
                "msg": "success",
                "output": {"result.tif": ["result-uuid"]},
            },
        ]
    )

    info = method_library.method_info(
        "BufferRaster",
        by_name=True,
        base_url="http://methods.test",
        token="test-token",
        opener=opener,
    )
    values = {
        "val0": ["input-uuid"],
        "val1": "result.tif",
        "val2": "10",
    }
    result = method_library.invoke_method(
        "34",
        values,
        base_url="http://methods.test",
        token="test-token",
        opener=opener,
    )

    assert info["method"]["id"] == 34
    info_request, _timeout = opener.requests[0]
    assert info_request.full_url.endswith(
        "/container/method/infoByName/BufferRaster"
    )
    invoke_request, _timeout = opener.requests[1]
    assert invoke_request.full_url.endswith("/container/method/invoke/34")
    assert invoke_request.method == "POST"
    assert json.loads(invoke_request.data) == values
    assert result["output"]["result.tif"] == ["result-uuid"]


def test_distributed_calls_use_minio_task_contract_without_standard_token():
    opener = FakeOpener(
        [
            {"code": 200, "data": {"taskId": "task-1"}, "message": "success"},
            {"code": 200, "data": {"status": "COMPLETE"}, "message": "success"},
            {
                "code": 200,
                "data": {"result": {"output": {"val1": ["http://minio/output.tif"]}}},
                "message": "success",
            },
        ]
    )
    method = {"id": 23, "name": "AverageOverlay", "params": []}
    values = {
        "val0": ["http://minio/input-a.tif", "http://minio/input-b.tif"],
        "val1": "http://minio/output.tif",
    }

    submitted = method_library.distributed_submit(
        method,
        values,
        "user-1",
        base_url="http://distributed.test",
        opener=opener,
    )
    status = method_library.distributed_task(
        "task-1",
        "status",
        base_url="http://distributed.test",
        opener=opener,
    )
    result = method_library.distributed_task(
        "task-1",
        "result",
        base_url="http://distributed.test",
        opener=opener,
    )

    submit_request, _timeout = opener.requests[0]
    assert submit_request.full_url == "http://distributed.test/v0/methlib"
    assert "Token" not in submit_request.headers
    assert json.loads(submit_request.data) == {
        "params": values,
        "method": method,
        "userId": "user-1",
    }
    assert submitted["data"]["taskId"] == "task-1"
    assert status["data"]["status"] == "COMPLETE"
    assert result["data"]["result"]["output"]["val1"][0].endswith("output.tif")
