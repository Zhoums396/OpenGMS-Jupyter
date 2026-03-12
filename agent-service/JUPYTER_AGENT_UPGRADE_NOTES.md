# Jupyter Agent Upgrade Notes

## Upgrade History

### Round 2: OpenHands-Inspired Enhancement (Latest)

**Goal**: Make the agent support longer reflection-iteration chains for complete project generation, with easy MCP/Skills integration.

**Open-source references**:

1. **OpenHands (All-Hands-AI/OpenHands)** — 50k+ stars
   - `codeact_agent.py`: Agent loop with pending_actions deque, MCP tool integration
   - `tools/str_replace_editor.py`: Unified file tool (view/create/str_replace/insert/undo_edit)
   - `tools/think.py`: ThinkTool for explicit reasoning between actions
   - `tools/finish.py`: FinishTool for explicit task completion with summary
   - `memory/condenser/`: LLM-based history condensation (LLMSummarizingCondenser, RecentEventsCondenser)
   - `memory/view.py`: View abstraction for condensed event history

2. **openclaw-mini** (local reference)
   - `src/agent-loop.ts`: Dual-layer loop with steering, context window guard
   - `src/tools/builtin.ts`: Edit/grep/terminal tools with sandbox
   - `src/context-window-guard.ts`: Three-layer pruning strategy

**What was implemented**:

| Feature | File(s) | Inspired by |
|---------|---------|-------------|
| ThinkTool | `tools.py` | OpenHands `tools/think.py` |
| FinishTool | `tools.py` | OpenHands `tools/finish.py` |
| insert_project_lines | `tools.py`, `workspace_tools.py` | OpenHands str_replace_editor `insert` command |
| undo_project_edit | `tools.py`, `workspace_tools.py` | OpenHands str_replace_editor `undo_edit` command |
| LLM Condenser | `condenser.py` (new) | OpenHands `memory/condenser/impl/llm_summarizing_condenser.py` |
| Window Condenser | `condenser.py` (new) | OpenHands `memory/condenser/impl/recent_events_condenser.py` |
| MCP Integration | `mcp.py` (new) | OpenHands `MCPAction` + MCP tool binding |
| Longer iteration chains | `agent.py` | MAX_ITERATIONS 25→50, condenser integration |
| Enhanced prompts | `prompts_enhanced.py`, `prompts.py` | OpenHands agent identity + autonomous workflow |
| 5 demo cases | `data/agent_cases.json` | Self-designed for new capabilities |

**Key architecture decisions**:

1. **Condenser integrates with LangGraph's message list** — when `_estimate_messages_chars()` exceeds 120K chars, the `LLMSummarizingCondenser` uses the same LLM to produce a structured summary of older messages, replacing them with a compact `SystemMessage`. This allows 50+ iteration chains without context overflow.

2. **ThinkTool is a "no-op" tool** — it returns immediately with the logged thought. This gives the LLM an explicit mechanism to reason between actions, improving quality on complex multi-step tasks.

3. **FinishTool triggers loop termination** — `check_pending_tools()` looks for a `ToolMessage` with `name=="finish"` and `content.startswith("FINISH:")` to signal graceful completion.

4. **MCP Registry is a singleton** — `get_mcp_registry()` returns a global registry. External MCP servers register via `register_server(name, url, tools)`. The agent's `agent_node()` auto-includes MCP tools in `bind_tools()`. The `tool_router_node()` checks `is_mcp_tool()` and delegates to `MCPToolRegistry.execute()`.

5. **Undo history is in-memory per WorkspaceTools instance** — `_save_undo()` stores file content before each edit/insert, capped at 10 entries per file. This is session-scoped (resets on server restart).

---

### Round 1: Project-Scoped Terminal Agent (Previous)

**Goal**: Upgrade the existing Jupyter agent so it can operate like a coding agent inside the current project directory.

**Open-source references**:

1. **OpenHands** — Agent actions grounded in a real runtime with command execution
2. **aider** — File-aware editing in real repositories, command-driven verify loops
3. **openclaw-mini** — Terminal timeout, output truncation, workspace boundary enforcement

**What was implemented**:

1. Project-scoped workspace tools (`workspace_tools.py`) — resolves `user/project` workspace, enforces path boundary
2. Backend tools: `run_terminal_command`, `list_project_files`, `read_project_file`, `write_project_file`, `edit_project_file`, `grep_project_files`
3. Tool router integration with state context
4. Context management: trimming, retry with exponential backoff, circuit breaker
5. 3 complete demo cases (Project Bootstrap, Codebase Audit, OGMS Pipeline)

## Current Capability Summary

- **15 tools total**: 2 frontend (notebook cells), 13 backend (workspace + search + reflection + control)
- **MCP extensibility**: Register external tool servers dynamically
- **50-step iteration chains**: With LLM condensation for context management
- **Reflection**: ThinkTool for explicit reasoning, FinishTool for structured completion
- **Undo support**: Revert edits/inserts when verification fails
- **5 demo cases**: Bootstrap, Audit, OGMS Pipeline, Multi-File Refactor, Data Pipeline

## Security Boundary

- Full command/file permissions inside the resolved project directory
- Path traversal outside project root is blocked
- Command execution has timeout (120s default) and output truncation guards
- Undo history is session-scoped (in-memory)
