---
name: opengms-data-methods
description: Discover, explain, and use reusable online geospatial data-processing methods exposed by the OpenGMS Method Library REST service. Use when the user wants to find existing processing capabilities, browse method resources, inspect exact parameters, or connect a notebook or script to an online method—even when they describe the need without naming OpenGMS. Prefer ordinary local Python, GDAL, or GeoPandas when a remote reusable method adds no value.
---

# OpenGMS Data Methods

Treat the live Method Library REST metadata as authoritative. The service does
not require a GeoCopilot Python package or a `DataMethodClient`. Never interpret
a Python import failure as evidence that the Method Library is unavailable.

## Keep internal tooling out of user-facing work

Use `scripts/method_library_rest.py` only as deterministic internal Agent
tooling. It is not the Method Library's public invocation interface.

- Never paste the helper command, its resolved filesystem path, or its CLI
  arguments into a response or notebook.
- Never import or call the helper from a notebook or user script.
- Never present a shell command as Python notebook code.
- Do not create an `invoke_method()` wrapper or another custom client merely to
  shorten the documented REST request.

When the user asks only for available resources or invocation examples, explain
the selected method, its method ID, exact parameter mapping, endpoint, and JSON
request body. Do not show an internal command.

When the user explicitly asks for executable notebook or Python code, write a
direct `requests.post()` call to the documented REST endpoint. Define the
documented production base URL and token in the code that must run; do not leave
undefined configuration placeholders. Assign the decoded response to a Python
variable so the notebook can inspect it directly. Do not add `--save`, a
subprocess call, an absolute Skill path, or an extra convenience API.

## Discover resources efficiently

For a general resource overview, make one unfiltered catalog request
internally:

```bash
python scripts/method_library_rest.py list --limit 10
```

Report the live total, representative method names, purposes, and tags. Explain
that the catalog is larger than the sample and invite the user to name a
scientific operation or data type. Do not launch a battery of speculative
keyword searches.

For a specific processing need, make one concise catalog search internally:

```bash
python scripts/method_library_rest.py list "buffer" --limit 10
```

Use at most one precise synonym if the first search is empty. Do not substitute
remembered algorithms for live catalog results. If the user only asks what is
available, answer from the returned metadata and stop.

The bundled script sends direct HTTP requests to the documented service. It is
self-contained, uses only the Python standard library, and is an internal
convenience tool rather than a package or service prerequisite. Do not inspect
Python environments, search for `geocopilot` modules, or locate alternative
clients before using it.

## Inspect exact parameters

Read exact metadata internally only for candidates that need closer comparison
or use:

```bash
python scripts/method_library_rest.py info 34
python scripts/method_library_rest.py info BufferRaster --by-name
```

Derive every parameter from the returned `params` array. Parameter position
determines its invocation key: the first parameter is `val0`, the second is
`val1`, and so on. Preserve gaps when optional parameters are omitted.

Interpret the main parameter categories as follows:

- `DataInput`: a file UUID or UUID list already present in the data-transfer
  service for the standard interface.
- `DataOutput`: the requested output filename.
- `ParamInput`: a scalar, Boolean, option, or other value described by
  `parameter_type`.

Never send an arbitrary local filesystem path where the service expects a file
UUID. If only a local file exists and no upload mechanism is available, explain
that missing transfer step instead of pretending the method can run.

## Invoke only on request

Invoke a method internally only when the user asks for execution and all
required values are known:

```bash
python scripts/method_library_rest.py invoke 34 \
  --values '{"val0":["input-file-uuid"],"val1":"result.tif","val2":"10"}'
```

Check `code`, `msg`, `output`, and `info` before reporting success. Returned
standard-interface outputs are file UUIDs, not automatically downloaded local
files. Record the method ID, exact parameter mapping, response, and any
remaining transfer step in the notebook or script. If reproducible notebook
code is requested, use the direct `requests.post()` form in
`references/method-library-api.md`, not the internal command above.

When the workflow uses MinIO URLs and asynchronous task polling, use the
distributed interface described in
`references/method-library-api.md`. Do not mix its URL-based inputs with the
standard interface's UUID-based inputs.

## Resources

- Use `scripts/method_library_rest.py` internally for deterministic catalog,
  metadata, invocation, and distributed-task REST requests.
- Read `references/method-library-api.md` when binding parameters, transferring
  files, producing user-facing Python, invoking a method, or using the
  distributed interface.
