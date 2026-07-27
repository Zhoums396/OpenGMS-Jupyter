# OpenGMS Method Library REST API

This reference records the Method Library contract supplied by the platform.
Use live responses as the source of truth when resource metadata changes.

## Contents

1. Service environments and authentication
2. Catalog and exact metadata
3. Parameter mapping
4. Standard invocation and file identifiers
5. User-facing Notebook Python
6. Distributed MinIO invocation
7. Failure handling

## 1. Service environments and authentication

Standard Method Library environments:

```text
Development: http://223.2.34.7:8080
Production:  http://172.21.252.222:8080
```

Use production unless the task explicitly targets development. Standard
catalog, metadata, and invocation requests send this header:

```text
token: 883ada2fc996ab9487bed7a3ba21d2f1
Accept: application/json
```

No OpenGMS or GeoCopilot Python package is required. The bundled REST helper
contains these service defaults, disables proxy use for private-network
requests, and can be replaced by an equivalent direct HTTP request.

## 2. Catalog and exact metadata

### Catalog

```http
GET /container/method/listWithTag?page=1&limit=10&key=buffer
```

Parameters:

- `page`: page number.
- `limit`: page size, maximum 500.
- `key`: optional textual search term; use an empty value for an overview.

A successful response has `code: 0` and a `page` object containing
`totalCount`, `pageSize`, `totalPage`, `currPage`, and `list`.

Catalog records can contain:

- `id`, `name`, `description`, and `longDesc`;
- `uuid`, `type`, and `execution`;
- `params`, `tagList`, `inputSchema`, and `outputSchema`.

### Metadata by ID

```http
GET /container/method/info/34
```

Use this endpoint for exact method metadata when the numeric ID is known.

### Metadata by name

```http
GET /container/method/infoByName/BufferRaster
```

This response can additionally contain `paramType`, whose `FileInput`,
`Output`, and `ParamInput` arrays identify positional keys such as `val0`.

## 3. Parameter mapping

The ordered `method.params` array defines the invocation keys:

```text
params[0] -> val0
params[1] -> val1
params[2] -> val2
```

Do not renumber later parameters when an optional value is omitted.

Important fields on each parameter:

- `Name`: display name.
- `Type`: `DataInput`, `DataOutput`, or `ParamInput`.
- `Optional`: whether the value may be omitted.
- `Description`: parameter meaning.
- `default_value`: documented default.
- `parameter_type`: concrete file, scalar, Boolean, or option type.

Examples of `parameter_type` include:

```json
{"ExistingFile":"Raster"}
{"FileList":{"Vector":"Any"}}
{"NewFile":"Raster"}
{"OptionList":["mean","sum","maximum","minimum","range"]}
"Integer"
"Float"
"Boolean"
```

## 4. Standard invocation and file identifiers

Invoke a standard method:

```http
POST /container/method/invoke/285
Content-Type: application/json

{
  "val0": [
    "input-file-uuid-1",
    "input-file-uuid-2"
  ],
  "val1": "result.shp"
}
```

For the standard interface:

- `DataInput` values are data-transfer-server UUIDs, or lists of UUIDs for
  `FileList`.
- `DataOutput` values are requested output filenames.
- `ParamInput` values follow the inspected scalar or option type.
- Successful `output` values contain returned file UUIDs.

The supplied Method Library document does not define the upload or download
endpoint for the data-transfer server. Never invent it. If the user supplies
only local files, locate a separately configured transfer service or ask for
the missing upload mechanism before invoking.

Persist the complete response when executing. A successful response commonly
contains:

```json
{
  "msg": "success",
  "code": 0,
  "output": {
    "result.tif": ["returned-file-uuid"]
  },
  "info": "execution log"
}
```

## 5. User-facing Notebook Python

The Method Library public interface is the REST request itself. The bundled
`method_library_rest.py` helper is private Agent tooling: never expose its path,
CLI syntax, or subprocess invocation in a response, notebook, or user script.

When the user explicitly asks for executable Notebook Python, use a direct
request such as:

```python
import requests

METHOD_LIBRARY_URL = "http://172.21.252.222:8080"
METHOD_LIBRARY_TOKEN = "883ada2fc996ab9487bed7a3ba21d2f1"

response = requests.post(
    f"{METHOD_LIBRARY_URL}/container/method/invoke/34",
    headers={"token": METHOD_LIBRARY_TOKEN},
    json={
        "val0": ["input-file-uuid"],
        "val1": "result.tif",
        "val2": "10",
    },
    timeout=300,
)
response.raise_for_status()
result = response.json()
result
```

Replace the method ID and `valN` values only after inspecting live metadata.
Keep this explicit REST form: do not add a custom `invoke_method()` wrapper,
import a Skill script, launch a subprocess, or save a second JSON file unless
the user specifically requests file persistence.

If the user requests invocation examples but not executable Python, present
the endpoint and JSON body without adding implementation code.

## 6. Distributed MinIO invocation

The distributed environment is designed for MinIO-hosted inputs and outputs:

```text
API root:          http://223.2.34.8:30050
MinIO console:     http://223.2.34.8:30901
MinIO file access: http://223.2.34.8:30090
```

Submit a task:

```http
POST /v0/methlib
Content-Type: application/json

{
  "params": {
    "val0": [
      "http://minio-host/bucket/input-a.tif",
      "http://minio-host/bucket/input-b.tif"
    ],
    "val1": "http://minio-host/bucket/output.tif"
  },
  "method": {
    "id": 23,
    "name": "AverageOverlay",
    "params": []
  },
  "userId": "user-identifier"
}
```

Send the complete live method object returned by the catalog or metadata
endpoint; do not reconstruct a partial method object from memory.

The submit response returns `data.taskId`. Poll:

```http
GET /v0/task/status?id=task-id
```

Continue only while the documented status indicates pending or running work.
After `COMPLETE`, fetch:

```http
GET /v0/task/result?id=task-id
```

Distributed results contain MinIO URLs. Do not treat them as standard-interface
file UUIDs.

## 7. Failure handling

- Report HTTP status and the service's `msg` or `message`.
- A package import failure is unrelated to Method Library availability.
- Do not claim execution success from `code` alone; inspect outputs and logs.
- Do not retry broad catalog searches repeatedly.
- Do not print the token in notebook output or execution logs.
