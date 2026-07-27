#!/usr/bin/env python3
"""Discover, inspect, or explicitly invoke OpenGMS models with PyGeoModel."""

from __future__ import annotations

import argparse
import json
from dataclasses import asdict, is_dataclass
from pathlib import Path
from typing import Any

from pygeomodel import GeoModeler


def _json_object(value: str) -> dict[str, Any]:
    text = Path(value[1:]).read_text(encoding="utf-8") if value.startswith("@") else value
    parsed = json.loads(text)
    if not isinstance(parsed, dict):
        raise ValueError("inputs must be a JSON object")
    return parsed


def _plain(value: Any) -> Any:
    if hasattr(value, "to_dict"):
        return value.to_dict()
    if is_dataclass(value):
        return asdict(value)
    if isinstance(value, list):
        return [_plain(item) for item in value]
    if isinstance(value, dict):
        return {key: _plain(item) for key, item in value.items()}
    return value


def _compact_model(model: Any) -> dict[str, Any]:
    return {
        "name": model.name,
        "display_name": model.display_name,
        "model_id": model.model_id,
        "description": model.description,
        "author": model.author,
        "tags": model.tags,
        "tags_en": model.tags_en,
        "inputs": [
            {
                "state": item.state,
                "name": item.name,
                "event_name": item.event_name,
                "data_type": item.data_type,
                "required": item.required,
                "description": item.description,
                "is_file": item.is_file,
            }
            for item in model.inputs
        ],
        "outputs": [
            {
                "state": item.state,
                "name": item.name,
                "event_name": item.event_name,
                "data_type": item.data_type,
                "description": item.description,
            }
            for item in model.outputs
        ],
    }


def _parser() -> argparse.ArgumentParser:
    root = argparse.ArgumentParser(description=__doc__)
    actions = root.add_subparsers(dest="action", required=True)

    discover = actions.add_parser(
        "discover",
        help="Search up to eight terms and return ranked exact metadata in one call",
    )
    discover.add_argument("queries", nargs="+")
    discover.add_argument("--limit", type=int, default=5)
    discover.add_argument("--search-limit", type=int, default=20)

    search = actions.add_parser("search", help="Search model catalog metadata")
    search.add_argument("query", nargs="?", default="")
    search.add_argument("--limit", type=int, default=10)

    info = actions.add_parser("info", help="Read exact model metadata")
    info.add_argument("name")

    invoke = actions.add_parser("invoke", help="Invoke a model with inspected inputs")
    invoke.add_argument("name")
    invoke.add_argument("--inputs", required=True, help="JSON or @path/to/inputs.json")
    invoke.add_argument("--no-wait", action="store_true")
    invoke.add_argument("--output-dir")
    invoke.add_argument("--record-path")
    return root


def main() -> int:
    args = _parser().parse_args()
    modeler = GeoModeler()
    if args.action == "discover":
        queries = [str(query).strip() for query in args.queries if str(query).strip()]
        if not queries or len(queries) > 8:
            raise ValueError("discover accepts one to eight non-empty queries")
        ranked: dict[str, tuple[int, Any]] = {}
        search_limit = max(1, min(args.search_limit, 100))
        for query in queries:
            matches = modeler.search_models(query, limit=search_limit)
            for index, match in enumerate(matches):
                score = search_limit - index
                previous = ranked.get(match.name)
                ranked[match.name] = (
                    score + (previous[0] if previous else 0),
                    match,
                )
        selected = sorted(
            ranked.values(),
            key=lambda value: (-value[0], value[1].display_name, value[1].name),
        )[: max(1, min(args.limit, 20))]
        result = [
            _compact_model(modeler.get_model(summary.name))
            for _score, summary in selected
        ]
    elif args.action == "search":
        result = modeler.search_models(args.query, limit=max(1, min(args.limit, 100)))
    elif args.action == "info":
        result = _compact_model(modeler.get_model(args.name))
    else:
        result = modeler.invoke(
            args.name,
            params=_json_object(args.inputs),
            wait=not args.no_wait,
            output_dir=args.output_dir,
            record_path=args.record_path,
        )
    print(json.dumps(_plain(result), ensure_ascii=False, indent=2, default=str))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
