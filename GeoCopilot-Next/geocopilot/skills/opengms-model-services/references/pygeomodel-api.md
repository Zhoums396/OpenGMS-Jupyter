# PyGeoModel API reference

Import the supported entry point:

```python
from pygeomodel import GeoModeler
```

## Discovery

```python
modeler = GeoModeler()
matches = modeler.search_models(query="", limit=20)
```

`search_models()` returns `ModelSummary` objects. Useful fields are `name`,
`display_name`, `description`, `author`, `tags`, `model_id`, and `md5`. Search
matches literal substrings across catalog metadata. Use a concise term and
inspect results rather than passing a long natural-language question.

## Exact metadata

```python
model = modeler.get_model(matches[0].name)
metadata = model.to_dict()
```

`ModelService.inputs` contains `ModelInput` objects with `state`, `name`,
`event_name`, `data_type`, `required`, `description`, and `is_file`.
`ModelService.outputs` exposes corresponding output metadata.

For a single input on an event, `params` may use either its `event_name` or
`name`. When an event has multiple child inputs, use each child `name`, or
provide the event as a mapping containing those names. PyGeoModel normalizes
and validates this mapping before submission.

## Invocation and persistence

```python
result = modeler.invoke(
    model_name=model.name,
    params=params,
    wait=True,
    output_dir="outputs/model-run",
    record_path="outputs/model-run.json",
)
```

`invoke()` returns `TaskResult`. Inspect `status`, `task_id`, `outputs`,
`downloaded_outputs`, and `execution_time`. When paths are not supplied to
`invoke()`, call `result.save(output_dir=..., record_path=...)` later.

Invocation uses the endpoint configuration owned by PyGeoModel. Do not create
a parallel catalog, gateway, or substitute request protocol.
