# GeoCopilot 0.4.14

GeoCopilot is a notebook-native, Codex-powered general agent embedded in
JupyterLab. It keeps Codex's native shell and file capabilities, adds
revision-safe notebook tools through Jupyter MCP, and makes OpenGMS resources
available as a standard Codex skill.

This is a clean 1.0 implementation. The previous 0.x plugin is not a dependency
and none of its intent routing or browser-executed task machinery is used here.

## Product guarantees

- One persistent Codex thread and at most one active turn for each Jupyter user.
- One user message maps directly to one `turn/start`; there is no classifier call.
- Native Codex shell, file editing, search, Git, and patch capabilities remain available.
- Notebook operations use root-safe paths, stable cell IDs, YDocs, source hashes,
  revisions, and server-side kernels.
- Browser disconnects do not own or cancel the active turn.
- OpenGMS capability selection is made by Codex from the Skill description, not
  by keywords, regular expressions, or a host-side router.
- There is no read-only mode or per-command approval UI. Production safety comes
  from the isolated, non-root, per-user container.

## Development

Requirements:

- Python 3.10–3.13
- JupyterLab 4.5.x
- Node.js 20 LTS
- Codex CLI 0.142.2

```bash
python -m pip install -e ".[test,dev]"
npm install
npm run build
jupyter lab
```

Run the verification suite:

```bash
pytest
npm run lint
npm run build:prod
```

The right sidebar contains one persistent conversation. While a turn is
running, new input is disabled and the turn can be interrupted with **Stop turn**.
Closing the browser does not stop the server-side turn.

## Notebook execution and observation

Notebook work follows the implementation patterns used by current Jupyter
agents rather than a separate GeoCopilot task router:

- [Notebook Intelligence](https://github.com/plmbr/notebook-intelligence)
  provides the exploratory-versus-construction workflow baseline.
- [Jupyter AI Jupyternaut](https://github.com/jupyter-ai-contrib/jupyter-ai-jupyternaut)
  provides the execute, inspect, repair, and bounded-retry behavior.
- [Jupyter AI Tools](https://github.com/jupyter-ai-contrib/jupyter-ai-tools)
  and [Datalayer Jupyter MCP Server](https://github.com/datalayer/jupyter-mcp-server)
  provide the output-fidelity and native MCP `ImageContent` patterns.

`notebook.run_cell` returns one MCP result containing structured stdout,
stderr, errors, MIME metadata, execution timing, and up to three raster outputs
as native image blocks. Kernel completion is therefore an execution fact, not
an automatic claim that the scientific or visual result is valid. Codex
examines the returned evidence in the same turn and decides whether to
continue, repair, or ask the user.

Kernel awareness remains notebook-scoped and server-side:

- `notebook.kernel_status` reports the notebook session, kernel identity,
  execution state, connections, and last activity without starting a kernel.
- `notebook.list_variables` performs a private, history-free kernel probe and
  returns bounded variable metadata such as type, shape, dtype, columns, and
  CRS. It does not serialize complete in-memory objects.
- `notebook.interrupt_kernel` interrupts a live notebook kernel.
- `notebook.restart_kernel` restarts the path-specific kernel and explicitly
  reports that memory-resident state has been cleared.

These tools follow the server-side kernel-management pattern used by Datalayer
Jupyter MCP Server. Cell execution also interrupts the kernel when its timeout
is reached, instead of leaving an orphaned computation running.

## Runtime model

Production deployments run one non-root Jupyter Server container per user.
GeoCopilot starts one private `codex app-server` process over stdio, uses the
Jupyter Server root as its working directory, and runs with full filesystem
access inside that isolated container.

On Windows only, Jupyter Server uses an event loop that cannot create asyncio
subprocess transports. GeoCopilot therefore starts Codex with `subprocess.Popen`;
the stdout/stderr reader threads enqueue JSON-RPC events for one async dispatcher
on Jupyter's main event loop. macOS and Linux retain the native asyncio subprocess
transport. GeoCopilot never alters Jupyter's global event-loop policy.

API keys are write-only in the UI and are stored outside the Jupyter workspace.
No prompt classifier or keyword-based skill router exists in this project.
When a custom Base URL is configured, GeoCopilot defines a dedicated Codex
model provider with `env_key = "OPENAI_API_KEY"` and
`wire_api = "responses"`. This avoids mixing third-party endpoint credentials
with Codex's built-in OpenAI authentication state.

The extension uses these fixed runtime defaults:

```toml
approval_policy = "never"
sandbox_mode = "danger-full-access"
```

JupyterLab is currently constrained to 4.5.x because the fixed
`jupyter-server-documents==0.3.1` frontend packages require JupyterLab 4.5 and
target `@jupyter/ydoc` 3.x. The bounds prevent pip from producing incompatible
JupyterLab 4.4 or 4.6 environments; they can be lifted when that upstream stack
publishes a compatible release.

The Codex working directory is always the Jupyter Server `root_dir`. Settings
are saved under Jupyter's per-user config/data directories, while user notebooks
and data remain in the workspace.

## OpenGMS resources

Model-service code uses `PyGeoModel>=1.0.16,<2` directly. The data-processing
method client contains the internal production service address and token from
the Method Library specification, so it works without deployment environment
variables. Explicit constructor arguments remain available for tests.

The two platform Skills live in `geocopilot/skills/opengms-model-services` and
`geocopilot/skills/opengms-data-methods`. Production images also install them
under `/etc/codex/skills`. At local startup GeoCopilot copies the packaged
Skills into its private `CODEX_HOME` and verifies them through Codex
`skills/list`; startup fails clearly rather than silently running without the
resource capabilities. Users can also install their own Skills under
`~/.agents/skills`.

## Container

Build the non-root single-user image from the repository root:

```bash
docker build -f docker/Dockerfile -t opengeolab/geocopilot:0.4.14 .
```

The image pins Codex CLI 0.142.2, JupyterLab 4.5.10, and Notebook 7.5.7,
exposes Jupyter on port 8888, and uses `/home/jovyan/work` as both the mounted
workspace and `ServerApp.root_dir`.

## Protocol compatibility

The generated Codex App Server schemas for 0.142.2 are checked into
`schema/codex-0.142.2`. Regenerate them before any Codex upgrade and run the
contract suite:

```bash
scripts/regenerate_codex_schema.sh
pytest tests/test_contracts.py
```

`jupyter-server-mcp==0.2.1` exposes Streamable HTTP but does not ship the
stdio proxy present on its unreleased development branch. GeoCopilot therefore
connects Codex directly to `http://127.0.0.1:3001/mcp`; the port remains private
inside each single-user container. Override it with `GEOCOPILOT_MCP_URL` only
when the matching Jupyter MCP port is changed.
