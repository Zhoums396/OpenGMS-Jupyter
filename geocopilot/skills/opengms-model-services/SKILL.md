---
name: opengms-model-services
description: Discover, inspect, and invoke reusable online geographic model services with PyGeoModel. Use when the user wants to know which geographic models are available, find an existing model for a scientific process, compare remote modelling resources, inspect exact model inputs and outputs, or include or run a reusable model service in a notebook or script—even when they do not name OpenGMS. Do not use for ordinary local model development or GIS analysis that local Python tools already solve well.
---

# OpenGMS Model Services

Use `PyGeoModel` as the supported catalog and execution client. Keep discovery,
explanation, code generation, and optional execution in the current Codex turn.

## Choose the service deliberately

Use this Skill when an existing online geographic model could satisfy the
scientific need or when the user asks what reusable modelling resources exist.
Do not invoke a remote model merely because a request contains general words
such as model, simulation, geography, or processing.

If local workspace code, Python, GDAL, GeoPandas, or another already-available
tool is sufficient, proceed locally. It is valid to use local tools first and
consult the model catalog later if the task develops a genuine service need.

## Discover before selecting

For a multi-candidate resource request, prefer one deterministic batch call:

```bash
python scripts/opengms_models.py discover hydrology runoff rainfall flood \
  watershed SCS 水文 径流 --limit 7
```

Pass up to eight short scientific process or domain terms in the same command.
Mix precise English and Chinese terms when useful. The command searches each
term, deduplicates the results, ranks them across searches, and calls
`get_model()` for the final candidates.

For an overview request, call `discover` once and inspect at most seven detailed
candidates. Do not repeat broad discovery with separate query groups. If the
single batch has no suitable result, report that catalog limitation and ask for
a narrower scientific process instead of brute-force searching.

When writing reusable Python code rather than doing one-time discovery:

```python
from pygeomodel import GeoModeler

modeler = GeoModeler()
matches = modeler.search_models("hydrology", limit=10)
for match in matches:
    print(match.name, match.display_name, match.description)

model = modeler.get_model(matches[0].name)
print(model.to_dict())
```

If initial results are weak, try one precise synonym or the Chinese/English
counterpart. Search is textual, not semantic.

Use the catalog's canonical `name` in later calls. Never invent a model ID,
input name, output, or availability claim.

## Explain or invoke

If the user only asks which resources are available, answer from inspected
metadata and stop. Include the resource name, purpose, relevant inputs and
outputs, and any uncertainty that affects suitability.

Invoke only when the user asks to run or integrate a service and real inputs
are available. Build `params` from the exact `model.inputs` metadata; required
file inputs must point to real workspace files.

```python
result = modeler.invoke(
    model.name,
    params={
        # Exact input or event names from model.inputs.
    },
    wait=True,
    output_dir="outputs/model-run",
    record_path="outputs/model-run.json",
)
print(result.status, result.downloaded_outputs)
```

Write reproducible calls into the user's notebook or script when the result is
part of a workflow. Inspect `result.status`, returned outputs, and saved paths
before claiming success. Report service errors as service errors; do not
silently substitute fabricated output.

## Included resources

- Run `scripts/opengms_models.py` for batched deterministic discovery,
  metadata inspection, or an explicitly requested invocation.
- Read `references/pygeomodel-api.md` for the supported object fields and
  parameter-mapping rules.

The script is deterministic and its interface is documented here. Run it
directly; do not list the Skill directory or read the script source first.
