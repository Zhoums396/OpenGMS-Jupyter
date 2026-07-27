#!/usr/bin/env python3
"""Call the OpenGMS Method Library REST service without package dependencies."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import quote, urlencode
from urllib.request import OpenerDirector, ProxyHandler, Request, build_opener

DEFAULT_API_URL = "http://172.21.252.222:8080"
DEFAULT_DISTRIBUTED_URL = "http://223.2.34.8:30050"
DEFAULT_TOKEN = "883ada2fc996ab9487bed7a3ba21d2f1"


class MethodLibraryError(RuntimeError):
    """Raised when the Method Library rejects or cannot answer a request."""


def _json_object(value: str) -> dict[str, Any]:
    text = Path(value[1:]).read_text(encoding="utf-8") if value.startswith("@") else value
    payload = json.loads(text)
    if not isinstance(payload, dict):
        raise ValueError("The supplied JSON must be an object")
    return payload


def _request_json(
    path: str,
    *,
    method: str = "GET",
    payload: dict[str, Any] | None = None,
    base_url: str = DEFAULT_API_URL,
    token: str = DEFAULT_TOKEN,
    timeout: float = 60,
    opener: OpenerDirector | None = None,
) -> dict[str, Any]:
    url = f"{base_url.rstrip('/')}/{path.lstrip('/')}"
    headers = {"Accept": "application/json"}
    if token:
        headers["token"] = token
    data = None
    if payload is not None:
        data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        headers["Content-Type"] = "application/json"
    request = Request(url, data=data, headers=headers, method=method)
    direct_opener = opener or build_opener(ProxyHandler({}))
    try:
        with direct_opener.open(request, timeout=timeout) as response:
            body = response.read()
    except HTTPError as exc:
        detail = exc.read().decode("utf-8", "replace").strip()
        raise MethodLibraryError(
            f"Method Library returned HTTP {exc.code}: {detail or exc.reason}"
        ) from exc
    except URLError as exc:
        raise MethodLibraryError(f"Method Library request failed: {exc.reason}") from exc
    try:
        result = json.loads(body.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise MethodLibraryError("Method Library returned invalid JSON") from exc
    if not isinstance(result, dict):
        raise MethodLibraryError("Method Library returned a non-object response")
    code = result.get("code")
    if code is not None and code not in {0, 200}:
        message = result.get("msg") or result.get("message") or "request rejected"
        raise MethodLibraryError(f"Method Library error {code}: {message}")
    return result


def _compact_method(method: dict[str, Any]) -> dict[str, Any]:
    tags = method.get("tagList") or method.get("tags") or []
    if not isinstance(tags, list):
        tags = [tags]
    params = method.get("params")
    return {
        "id": method.get("id"),
        "name": method.get("name"),
        "description": method.get("description") or method.get("longDesc") or "",
        "execution": method.get("execution"),
        "tags": tags,
        "parameterCount": len(params) if isinstance(params, list) else 0,
    }


def list_methods(
    query: str = "",
    *,
    page: int = 1,
    limit: int = 10,
    base_url: str = DEFAULT_API_URL,
    token: str = DEFAULT_TOKEN,
    timeout: float = 60,
    opener: OpenerDirector | None = None,
) -> dict[str, Any]:
    params = urlencode(
        {
            "page": max(1, page),
            "limit": min(max(1, limit), 500),
            "key": query.strip(),
        }
    )
    result = _request_json(
        f"/container/method/listWithTag?{params}",
        base_url=base_url,
        token=token,
        timeout=timeout,
        opener=opener,
    )
    page_data = result.get("page")
    if not isinstance(page_data, dict) or not isinstance(page_data.get("list"), list):
        raise MethodLibraryError("Catalog response has no page.list")
    return {
        "code": result.get("code"),
        "msg": result.get("msg"),
        "query": query,
        "page": page_data.get("currPage"),
        "pageSize": page_data.get("pageSize"),
        "totalPages": page_data.get("totalPage"),
        "totalCount": page_data.get("totalCount"),
        "methods": [
            _compact_method(method)
            for method in page_data["list"]
            if isinstance(method, dict)
        ],
    }


def method_info(
    identifier: str,
    *,
    by_name: bool = False,
    base_url: str = DEFAULT_API_URL,
    token: str = DEFAULT_TOKEN,
    timeout: float = 60,
    opener: OpenerDirector | None = None,
) -> dict[str, Any]:
    value = identifier.strip()
    if not value:
        raise ValueError("A method ID or name is required")
    segment = "infoByName" if by_name else "info"
    return _request_json(
        f"/container/method/{segment}/{quote(value, safe='')}",
        base_url=base_url,
        token=token,
        timeout=timeout,
        opener=opener,
    )


def invoke_method(
    method_id: str,
    values: dict[str, Any],
    *,
    base_url: str = DEFAULT_API_URL,
    token: str = DEFAULT_TOKEN,
    timeout: float = 60,
    opener: OpenerDirector | None = None,
) -> dict[str, Any]:
    value = method_id.strip()
    if not value:
        raise ValueError("A method ID is required")
    invalid = [key for key in values if not str(key).startswith("val")]
    if invalid:
        raise ValueError("Invocation keys must use the positional val0, val1, ... form")
    return _request_json(
        f"/container/method/invoke/{quote(value, safe='')}",
        method="POST",
        payload=values,
        base_url=base_url,
        token=token,
        timeout=timeout,
        opener=opener,
    )


def distributed_submit(
    method: dict[str, Any],
    values: dict[str, Any],
    user_id: str,
    *,
    base_url: str = DEFAULT_DISTRIBUTED_URL,
    timeout: float = 60,
    opener: OpenerDirector | None = None,
) -> dict[str, Any]:
    if not user_id.strip():
        raise ValueError("A user ID is required")
    return _request_json(
        "/v0/methlib",
        method="POST",
        payload={"params": values, "method": method, "userId": user_id},
        base_url=base_url,
        token="",
        timeout=timeout,
        opener=opener,
    )


def distributed_task(
    task_id: str,
    action: str,
    *,
    base_url: str = DEFAULT_DISTRIBUTED_URL,
    timeout: float = 60,
    opener: OpenerDirector | None = None,
) -> dict[str, Any]:
    value = task_id.strip()
    if not value:
        raise ValueError("A task ID is required")
    return _request_json(
        f"/v0/task/{action}?{urlencode({'id': value})}",
        base_url=base_url,
        token="",
        timeout=timeout,
        opener=opener,
    )


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--api-url", default=DEFAULT_API_URL)
    parser.add_argument("--token", default=DEFAULT_TOKEN)
    parser.add_argument("--distributed-url", default=DEFAULT_DISTRIBUTED_URL)
    parser.add_argument("--timeout", type=float, default=60)
    actions = parser.add_subparsers(dest="action", required=True)

    catalog = actions.add_parser("list", help="List or search live catalog resources")
    catalog.add_argument("query", nargs="?", default="")
    catalog.add_argument("--page", type=int, default=1)
    catalog.add_argument("--limit", type=int, default=10)

    info = actions.add_parser("info", help="Read exact metadata by ID or name")
    info.add_argument("identifier")
    info.add_argument("--by-name", action="store_true")

    invoke = actions.add_parser("invoke", help="Invoke the standard UUID-based service")
    invoke.add_argument("method_id")
    invoke.add_argument("--values", required=True, help="JSON object or @path")
    invoke.add_argument("--save")

    submit = actions.add_parser(
        "distributed-submit",
        help="Submit a MinIO URL-based distributed task",
    )
    submit.add_argument("--method", required=True, help="Full method JSON or @path")
    submit.add_argument("--values", required=True, help="valN JSON object or @path")
    submit.add_argument("--user-id", required=True)

    status = actions.add_parser("distributed-status", help="Read distributed task status")
    status.add_argument("task_id")

    result = actions.add_parser("distributed-result", help="Read distributed task result")
    result.add_argument("task_id")
    return parser


def main() -> int:
    args = _parser().parse_args()
    try:
        if args.action == "list":
            result = list_methods(
                args.query,
                page=args.page,
                limit=args.limit,
                base_url=args.api_url,
                token=args.token,
                timeout=args.timeout,
            )
        elif args.action == "info":
            result = method_info(
                args.identifier,
                by_name=args.by_name,
                base_url=args.api_url,
                token=args.token,
                timeout=args.timeout,
            )
        elif args.action == "invoke":
            result = invoke_method(
                args.method_id,
                _json_object(args.values),
                base_url=args.api_url,
                token=args.token,
                timeout=args.timeout,
            )
            if args.save:
                target = Path(args.save)
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_text(
                    json.dumps(result, ensure_ascii=False, indent=2),
                    encoding="utf-8",
                )
        elif args.action == "distributed-submit":
            result = distributed_submit(
                _json_object(args.method),
                _json_object(args.values),
                args.user_id,
                base_url=args.distributed_url,
                timeout=args.timeout,
            )
        else:
            action = "status" if args.action == "distributed-status" else "result"
            result = distributed_task(
                args.task_id,
                action,
                base_url=args.distributed_url,
                timeout=args.timeout,
            )
    except (MethodLibraryError, OSError, ValueError, json.JSONDecodeError) as exc:
        print(json.dumps({"error": str(exc)}, ensure_ascii=False), file=sys.stderr)
        return 2
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
