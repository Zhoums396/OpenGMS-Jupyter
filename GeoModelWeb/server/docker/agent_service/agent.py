"""
LangGraph Agent 定义
"""
from typing import Literal, Optional, Dict, Any, List
import os
import json
import asyncio
import aiohttp
from pathlib import Path

# 确保 .env 在其他模块导入前加载
from dotenv import load_dotenv
env_path = Path(__file__).parent.parent / ".env"
load_dotenv(env_path)

from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage, AIMessage, SystemMessage, ToolMessage
from langgraph.graph import StateGraph, END
from langgraph.prebuilt import ToolNode
from langgraph.checkpoint.memory import MemorySaver

from .state import AgentState, NotebookContext
from .tools import ALL_TOOLS, FRONTEND_TOOLS, BACKEND_TOOLS, THINK_TOOL_NAME, FINISH_TOOL_NAME
from .workspace_tools import WorkspaceTools, WorkspaceError
from .condenser import get_condenser, LLMSummarizingCondenser
from .mcp import get_mcp_registry
from .prompts import build_system_prompt
# 增强版 Prompt 构建器（三维上下文融合）
from .prompts_enhanced import build_enhanced_system_prompt, get_prompt_builder

# 用户建模模块 - Tri-Space Context Fusion (使用 modeling 模块)
from .modeling import (
    get_user_model_manager,
    UserVibe,
    IntentType,
    InteractionEvent,
    analyze_message_vibe
)

# 配置
LLM_BASE_URL = os.getenv("LLM_BASE_URL", "https://api.aihubmix.com/v1")
LLM_API_KEY = os.getenv("LLM_API_KEY", "")
LLM_MODEL = os.getenv("LLM_MODEL", "deepseek-chat")
NODEJS_BACKEND_URL = os.getenv("NODEJS_BACKEND_URL", "http://localhost:3000")
workspace_tools = WorkspaceTools()


def _normalize_base_url(base_url: str, provider: Optional[str]) -> str:
    normalized = (base_url or LLM_BASE_URL).strip().rstrip("/")
    if provider == "aihubmix" and normalized.lower() == "https://aihubmix.com/v1":
        return "https://api.aihubmix.com/v1"
    return normalized


def get_llm(llm_config: Optional[Dict[str, Any]] = None) -> ChatOpenAI:
    """Get LLM instance with per-session overrides."""
    cfg = llm_config or {}
    provider = cfg.get("provider")
    model = cfg.get("model") or cfg.get("model_name") or LLM_MODEL
    base_url = _normalize_base_url(
        cfg.get("base_url") or cfg.get("baseUrl") or LLM_BASE_URL,
        provider
    )
    api_key = cfg.get("api_key") or cfg.get("apiKey") or LLM_API_KEY

    if not api_key and not base_url.startswith("http://localhost:11434"):
        raise ValueError("LLM API key is missing for the selected provider")

    return ChatOpenAI(
        model=model,
        base_url=base_url,
        api_key=api_key,
        temperature=0.7,
        streaming=True,
    )


async def execute_backend_tool(
    tool_name: str,
    tool_args: Dict[str, Any],
    state: Optional[AgentState] = None
) -> str:
    """执行后端工具（如搜索模型）"""
    try:
        state = state or {}

        # ---- Reflection & control tools (OpenHands pattern) ----
        if tool_name == "think":
            thought = tool_args.get("thought", "")
            print(f"[Agent Think] {thought[:200]}")
            return f"Thought logged: {thought[:500]}"

        if tool_name == "finish":
            message = tool_args.get("message", "Task completed.")
            return f"FINISH: {message}"

        # ---- Web search & download tools ----
        if tool_name == "web_search":
            return await _execute_web_search(
                query=tool_args.get("query", ""),
                max_results=int(tool_args.get("max_results", 5)),
            )

        if tool_name == "download_file":
            notebook_context = state.get("notebook_context") or {}
            resolved_user_name = state.get("user_name") or notebook_context.get("userName")
            resolved_project_name = state.get("project_name") or notebook_context.get("projectName")
            workspace = workspace_tools.resolve_project_workspace(
                user_name=resolved_user_name,
                project_name=resolved_project_name,
                working_directory=notebook_context.get("workingDirectory")
            )
            return await _execute_download_file(
                workspace=workspace,
                url=tool_args.get("url", ""),
                save_path=tool_args.get("save_path", ""),
                timeout_seconds=int(tool_args.get("timeout_seconds", 120)),
            )

        if tool_name in {"run_terminal_command", "list_project_files", "read_project_file",
                        "write_project_file", "edit_project_file", "insert_project_lines",
                        "undo_project_edit", "grep_project_files"}:
            notebook_context = state.get("notebook_context") or {}
            resolved_user_name = state.get("user_name") or notebook_context.get("userName")
            resolved_project_name = state.get("project_name") or notebook_context.get("projectName")
            workspace = workspace_tools.resolve_project_workspace(
                user_name=resolved_user_name,
                project_name=resolved_project_name,
                working_directory=tool_args.get("working_directory") or notebook_context.get("workingDirectory")
            )

            if tool_name == "run_terminal_command":
                result = await workspace_tools.run_command(
                    workspace=workspace,
                    command=tool_args.get("command", ""),
                    timeout_seconds=int(tool_args.get("timeout_seconds", 120)),
                )
                return _format_workspace_result(result)

            if tool_name == "list_project_files":
                result = workspace_tools.list_files(
                    workspace=workspace,
                    target_path=tool_args.get("target_path", "."),
                    max_depth=int(tool_args.get("max_depth", 3)),
                    max_entries=int(tool_args.get("max_entries", 300)),
                )
                return _format_workspace_result(result)

            if tool_name == "read_project_file":
                result = workspace_tools.read_file(
                    workspace=workspace,
                    file_path=tool_args.get("file_path", ""),
                    max_chars=int(tool_args.get("max_chars", 12000)),
                )
                return _format_workspace_result(result)

            if tool_name == "write_project_file":
                result = workspace_tools.write_file(
                    workspace=workspace,
                    file_path=tool_args.get("file_path", ""),
                    content=tool_args.get("content", ""),
                    append=bool(tool_args.get("append", False)),
                )
                return _format_workspace_result(result)

            if tool_name == "edit_project_file":
                result = workspace_tools.edit_file(
                    workspace=workspace,
                    file_path=tool_args.get("file_path", ""),
                    old_string=tool_args.get("old_string", ""),
                    new_string=tool_args.get("new_string", ""),
                )
                return _format_workspace_result(result)

            if tool_name == "grep_project_files":
                result = workspace_tools.grep_files(
                    workspace=workspace,
                    pattern=tool_args.get("pattern", ""),
                    target_path=tool_args.get("target_path", "."),
                    is_regex=bool(tool_args.get("is_regex", False)),
                    include_glob=tool_args.get("include_glob") or None,
                    max_results=int(tool_args.get("max_results", 50)),
                )
                return _format_workspace_result(result)

            if tool_name == "insert_project_lines":
                result = workspace_tools.insert_lines(
                    workspace=workspace,
                    file_path=tool_args.get("file_path", ""),
                    insert_line=int(tool_args.get("insert_line", 0)),
                    new_string=tool_args.get("new_string", ""),
                )
                return _format_workspace_result(result)

            if tool_name == "undo_project_edit":
                result = workspace_tools.undo_edit(
                    workspace=workspace,
                    file_path=tool_args.get("file_path", ""),
                )
                return _format_workspace_result(result)

        timeout = aiohttp.ClientTimeout(total=15)
        async with aiohttp.ClientSession(timeout=timeout) as session:
            if tool_name == "search_models":
                async with session.get(
                    f"{NODEJS_BACKEND_URL}/api/ogms/models",
                    params={"q": tool_args.get("query", ""), "limit": tool_args.get("limit", 10)}
                ) as response:
                    if response.status == 200:
                        data = await response.json()
                        models = data.get("data", [])
                        if models:
                            result = f"找到 {len(models)} 个相关模型:\n"
                            for m in models[:10]:
                                desc = m.get("description", "无描述")[:80]
                                result += f"- **{m['name']}**: {desc}\n"
                            return result
                        return "未找到相关模型"
                    return f"搜索失败: {response.status}"
            
            elif tool_name == "search_data_methods":
                async with session.get(
                    f"{NODEJS_BACKEND_URL}/api/datamethods",
                    params={"q": tool_args.get("query", ""), "limit": tool_args.get("limit", 10)}
                ) as response:
                    if response.status == 200:
                        data = await response.json()
                        methods = data.get("data", [])
                        if methods:
                            result = f"找到 {len(methods)} 个数据方法:\n"
                            for m in methods[:10]:
                                desc = m.get("description", "无描述")[:80]
                                result += f"- **{m['name']}**: {desc}\n"
                            return result
                        return "未找到相关数据方法"
                    return f"搜索失败: {response.status}"
            
            elif tool_name == "get_model_info":
                model_name = tool_args.get("model_name", "")
                async with session.get(
                    f"{NODEJS_BACKEND_URL}/api/ogms/models/{model_name}"
                ) as response:
                    if response.status == 200:
                        data = await response.json()
                        return parse_model_info(data)
                    return f"获取模型信息失败: {response.status}"
        
        return f"Unknown backend tool: {tool_name}"
    except WorkspaceError as e:
        return f"Workspace access error: {e}"
    except asyncio.TimeoutError:
        return f"工具执行超时: {tool_name}"
    except Exception as e:
        return f"工具执行错误: {str(e)}"


def _format_workspace_result(data: Dict[str, Any]) -> str:
    return json.dumps(data, ensure_ascii=False, indent=2)


def parse_model_info(model_data: Dict[str, Any]) -> str:
    """解析模型信息，提取输入输出参数"""
    import re
    
    name = model_data.get("name", "未知模型")
    mdl = model_data.get("mdl", "")
    
    result = f"## 模型: {name}\n\n"
    
    # 解析描述
    desc_list = model_data.get("localizationList", [])
    if desc_list:
        desc = desc_list[0].get("description", "")
        # 去除 HTML 标签
        desc = re.sub(r'<[^>]+>', '', desc)
        result += f"**描述**: {desc[:200]}\n\n"
    
    # 从 MDL XML 中提取 Event（这是实际调用时使用的参数名）
    inputs = []
    outputs = []
    
    # 匹配 Event 定义
    event_pattern = r'<Event\s+name="([^"]+)"\s+type="([^"]+)"\s+description="([^"]*)"[^>]*optional="([^"]*)"'
    event_matches = re.findall(event_pattern, mdl)
    
    for event_name, event_type, event_desc, optional in event_matches:
        is_optional = optional.lower() == "true"
        opt_text = "(可选)" if is_optional else "(必需)"
        
        if event_type == "response":
            # 输入参数
            # 检查是否是文件参数
            param_ref_pattern = rf'<Event\s+name="{event_name}"[^>]*>.*?<ResponseParameter[^>]*description="([^"]*)"'
            param_match = re.search(param_ref_pattern, mdl, re.DOTALL)
            param_detail = param_match.group(1) if param_match else ""
            
            # 判断类型：tif/shapefile 是文件，否则可能是数值
            if "tif" in param_detail.lower() or "shapefile" in param_detail.lower() or "zip" in param_detail.lower():
                inputs.append((event_name, "file", event_desc, opt_text))
            elif "multiplier" in event_name.lower() or "factor" in event_desc.lower():
                inputs.append((event_name, "number", event_desc, opt_text))
            else:
                inputs.append((event_name, "file", event_desc, opt_text))
        elif event_type == "noresponse":
            # 输出参数
            outputs.append((event_name, event_desc))
    
    result += "### 输入参数 (params 中需要填写这些):\n"
    if inputs:
        for param_name, param_type, param_desc, opt_text in inputs:
            if param_type == "file":
                result += f"- **{param_name}** (文件) {opt_text}: {param_desc}\n"
            else:
                result += f"- **{param_name}** (数值) {opt_text}: {param_desc}\n"
    else:
        # 备用：从 DatasetItem 解析
        dataset_pattern = r'<DatasetItem\s+name="([^"]+)"\s+type="([^"]+)"\s+description="([^"]*)"'
        dataset_matches = re.findall(dataset_pattern, mdl)
        for ds_name, ds_type, ds_desc in dataset_matches:
            if ds_name.startswith("input"):
                result += f"- **{ds_name}** ({ds_type}): {ds_desc}\n"
    
    result += "\n### 输出:\n"
    if outputs:
        for param_name, param_desc in outputs:
            result += f"- **{param_name}**: {param_desc}\n"
    else:
        result += "- 模型结果文件\n"
    
    # 生成代码模板
    result += "\n### 代码模板 (请将文件路径替换为工作目录中的实际文件):\n"
    result += "```python\n"
    result += f'model = OGMSAccess("{name}", token=TOKEN)\n'
    result += "params = {\n"
    result += '    "InputData": {\n'
    for param_name, param_type, param_desc, opt_text in inputs:
        if param_type == "file":
            result += f'        "{param_name}": "./文件路径",  # {param_desc} {opt_text}\n'
        else:
            result += f'        "{param_name}": 20,  # {param_desc} {opt_text}\n'
    result += "    }\n"
    result += "}\n"
    result += "outputs = model.createTask(params)\n"
    result += "```\n"
    
    return result

# ==================== Web Search & Download ====================

async def _execute_web_search(query: str, max_results: int = 5) -> str:
    """Search the web using DuckDuckGo HTML (no API key needed)."""
    import urllib.parse
    import re as _re

    search_url = "https://html.duckduckgo.com/html/"
    params = {"q": query}

    try:
        timeout = aiohttp.ClientTimeout(total=15)
        async with aiohttp.ClientSession(timeout=timeout) as session:
            async with session.post(
                search_url,
                data=params,
                headers={
                    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
                },
            ) as resp:
                if resp.status != 200:
                    return f"Web search failed with status {resp.status}"
                html = await resp.text()

        # Parse results from DuckDuckGo HTML response
        results = []

        # Extract result blocks: <a rel="nofollow" class="result__a" href="...">title</a>
        # and <a class="result__snippet" href="...">snippet</a>
        link_pattern = _re.compile(
            r'class="result__a"[^>]*href="([^"]*)"[^>]*>(.*?)</a>',
            _re.DOTALL,
        )
        snippet_pattern = _re.compile(
            r'class="result__snippet"[^>]*>(.*?)</a>',
            _re.DOTALL,
        )

        links = link_pattern.findall(html)
        snippets = snippet_pattern.findall(html)

        for i, (raw_url, raw_title) in enumerate(links[:max_results]):
            title = _re.sub(r"<[^>]+>", "", raw_title).strip()
            # DuckDuckGo wraps URLs in a redirect; extract the actual URL
            if "uddg=" in raw_url:
                url_match = _re.search(r"uddg=([^&]+)", raw_url)
                url = urllib.parse.unquote(url_match.group(1)) if url_match else raw_url
            else:
                url = raw_url

            snippet = ""
            if i < len(snippets):
                snippet = _re.sub(r"<[^>]+>", "", snippets[i]).strip()

            results.append(f"**{i+1}. {title}**\n   URL: {url}\n   {snippet}")

        if not results:
            return f"No results found for: {query}"

        return f"Found {len(results)} results for \"{query}\":\n\n" + "\n\n".join(results)

    except Exception as e:
        return f"Web search error: {e}"


async def _execute_download_file(
    workspace,
    url: str,
    save_path: str,
    timeout_seconds: int = 120,
) -> str:
    """Download a file from a URL into the project workspace."""
    from pathlib import Path as _Path

    if not url or not save_path:
        return "Error: url and save_path are required"

    # Resolve full path inside workspace
    target = (workspace.root / save_path).resolve()
    # Security: ensure target stays inside workspace
    if not str(target).startswith(str(workspace.root)):
        return f"Error: save_path escapes project workspace: {save_path}"

    # Create parent directories
    target.parent.mkdir(parents=True, exist_ok=True)

    try:
        timeout = aiohttp.ClientTimeout(total=timeout_seconds)
        async with aiohttp.ClientSession(timeout=timeout) as session:
            async with session.get(
                url,
                headers={
                    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
                },
                allow_redirects=True,
            ) as resp:
                if resp.status != 200:
                    return f"Download failed: HTTP {resp.status} from {url}"

                content_length = resp.headers.get("Content-Length")
                size_hint = f" ({int(content_length) // 1024} KB)" if content_length else ""
                print(f"[Download] {url} → {save_path}{size_hint}")

                total_bytes = 0
                with open(target, "wb") as f:
                    async for chunk in resp.content.iter_chunked(8192):
                        f.write(chunk)
                        total_bytes += len(chunk)

        size_kb = total_bytes / 1024
        if size_kb > 1024:
            size_str = f"{size_kb / 1024:.1f} MB"
        else:
            size_str = f"{size_kb:.1f} KB"

        return f"✅ Downloaded successfully: {save_path} ({size_str})"

    except asyncio.TimeoutError:
        return f"Download timed out after {timeout_seconds}s: {url}"
    except Exception as e:
        return f"Download error: {e}"


# ==================== Graph Nodes ====================

# Agent loop limits (inspired by OpenHands + openclaw-mini)
MAX_AGENT_ITERATIONS = 50        # Safety cap — max LLM round-trips per user turn (doubled for longer chains)
MAX_TOOL_ERRORS_BEFORE_STOP = 8  # Consecutive tool errors before giving up
TOKEN_CHAR_RATIO = 4             # ~4 chars per token (simplified estimate)
CONTEXT_SOFT_LIMIT_CHARS = 100_000  # ~25k tokens — start trimming tool results
CONTEXT_HARD_LIMIT_CHARS = 200_000  # ~50k tokens — aggressively trim
CONDENSER_TRIGGER_CHARS = 120_000   # Trigger LLM condensation above this


def _estimate_messages_chars(messages) -> int:
    """Estimate total character count of messages for context management."""
    total = 0
    for msg in messages:
        content = getattr(msg, "content", "")
        if isinstance(content, str):
            total += len(content)
        elif isinstance(content, list):
            for block in content:
                if isinstance(block, dict):
                    total += len(str(block.get("text", "")))
    return total


def _trim_tool_results(messages, mode: str = "soft") -> list:
    """
    Trim tool result messages to reduce context size.
    Inspired by openclaw-mini's three-layer pruning strategy.

    mode='soft': keep head+tail of long tool results
    mode='hard': replace long tool results with short summaries
    """
    result = []
    for msg in messages:
        if isinstance(msg, ToolMessage):
            content = msg.content or ""
            if mode == "soft" and len(content) > 3000:
                # Keep first 1500 + last 500 chars
                trimmed = content[:1500] + "\n\n... [trimmed] ...\n\n" + content[-500:]
                result.append(ToolMessage(
                    content=trimmed,
                    tool_call_id=msg.tool_call_id,
                    name=getattr(msg, "name", None),
                    id=msg.id,
                ))
            elif mode == "hard" and len(content) > 500:
                trimmed = content[:300] + "\n[... output truncated ...]"
                result.append(ToolMessage(
                    content=trimmed,
                    tool_call_id=msg.tool_call_id,
                    name=getattr(msg, "name", None),
                    id=msg.id,
                ))
            else:
                result.append(msg)
        else:
            result.append(msg)
    return result


async def agent_node(state: AgentState) -> Dict[str, Any]:
    """Agent node: call LLM with tools, with context management and MCP support."""
    llm = get_llm(state.get("llm_config"))

    # Bind built-in tools + any registered MCP tools
    mcp_registry = get_mcp_registry()
    mcp_tools = mcp_registry.get_langchain_tools()
    all_tools = ALL_TOOLS + mcp_tools
    llm_with_tools = llm.bind_tools(all_tools)
    
    # Get context info
    context = state.get("notebook_context")
    user_name = state.get("user_name", "User")
    user_id = state.get("user_id", "default")
    
    # Get current user message for tri-space analysis
    current_message = None
    messages = list(state["messages"])
    for msg in reversed(messages):
        if isinstance(msg, HumanMessage):
            current_message = msg.content
            break
    
    # ===== Tri-Space Context Fusion =====
    user_model_manager = get_user_model_manager()
    vibe_suggestions = []
    
    try:
        user_model = user_model_manager.get(user_id, user_name)
        if current_message:
            from datetime import datetime
            event = InteractionEvent(
                timestamp=datetime.now(),
                event_type="message",
                content=current_message
            )
            user_model.record_interaction(event)
            user_model_manager.update_vibe(user_id, current_message)
        vibe_suggestions = user_model_manager.get_vibe_suggestions(user_model)
    except Exception as e:
        print(f"[Agent] User modeling failed: {e}")
    
    # Build system prompt
    try:
        system_prompt = build_enhanced_system_prompt(
            context=context,
            current_message=current_message,
            user_id=user_id,
            user_name=user_name
        )
        if vibe_suggestions:
            system_prompt += "\n\n## Agent Behavioral Hints\n" + "\n".join(f"- {s}" for s in vibe_suggestions)
    except Exception as e:
        print(f"[Agent] Enhanced prompt failed, falling back: {e}")
        system_prompt = build_system_prompt(context)
    
    # === Context management: Condenser + pruning (OpenHands + openclaw-mini) ===
    if not messages or not isinstance(messages[0], SystemMessage):
        messages.insert(0, SystemMessage(content=system_prompt))
    else:
        messages[0] = SystemMessage(content=system_prompt)

    # Step 1: Try LLM condensation if context is very large
    total_chars = _estimate_messages_chars(messages)
    if total_chars > CONDENSER_TRIGGER_CHARS:
        try:
            condenser = get_condenser(
                strategy="llm_summarizing",
                llm_config=state.get("llm_config"),
                trigger_chars=CONDENSER_TRIGGER_CHARS,
                keep_first=2,
                keep_last=24,
            )
            messages = await condenser.async_maybe_condense(messages)
            total_chars = _estimate_messages_chars(messages)
            print(f"[Agent] After condensation: {total_chars} chars")
        except Exception as e:
            print(f"[Agent] Condensation failed, falling back to trimming: {e}")

    # Step 2: Trim tool results if still too large
    if total_chars > CONTEXT_HARD_LIMIT_CHARS:
        messages = [messages[0]] + _trim_tool_results(messages[1:], mode="hard")
    elif total_chars > CONTEXT_SOFT_LIMIT_CHARS:
        messages = [messages[0]] + _trim_tool_results(messages[1:], mode="soft")
    
    # Call LLM (with retry on transient errors)
    retry_count = 0
    max_retries = 2
    while True:
        try:
            response = await llm_with_tools.ainvoke(messages)
            break
        except Exception as e:
            error_str = str(e).lower()
            is_retryable = any(kw in error_str for kw in ["rate_limit", "429", "timeout", "503", "overloaded"])
            if is_retryable and retry_count < max_retries:
                retry_count += 1
                wait = 2 ** retry_count
                print(f"[Agent] Retryable error, waiting {wait}s (attempt {retry_count}): {e}")
                await asyncio.sleep(wait)
                continue
            raise
    
    return {"messages": [response]}


async def tool_router_node(state: AgentState) -> Dict[str, Any]:
    """Tool router: split frontend vs backend tools, execute backend tools with error handling."""
    import json as _json
    last_message = state["messages"][-1]
    
    if not hasattr(last_message, "tool_calls") or not last_message.tool_calls:
        return {"pending_tool_calls": [], "tool_results": []}
    
    frontend_calls = []
    tool_messages = []
    consecutive_errors = state.get("_consecutive_tool_errors", 0)
    
    for tool_call in last_message.tool_calls:
        tool_name = tool_call["name"]
        
        if tool_name in FRONTEND_TOOLS:
            frontend_calls.append({
                "id": tool_call["id"],
                "name": tool_name,
                "arguments": _json.dumps(tool_call["args"], ensure_ascii=False)
            })
            tool_messages.append(ToolMessage(
                content="[前端执行中...]",
                tool_call_id=tool_call["id"],
                name=tool_name
            ))
        elif tool_name in BACKEND_TOOLS:
            result = await execute_backend_tool(tool_name, tool_call["args"], state)
            # Track error streaks for circuit breaker
            is_error = result.startswith(("工具执行错误", "工具执行超时", "Workspace access error", "Unknown backend tool"))
            if is_error:
                consecutive_errors += 1
            else:
                consecutive_errors = 0
            tool_messages.append(ToolMessage(
                content=result,
                tool_call_id=tool_call["id"],
                name=tool_name
            ))
        elif get_mcp_registry().is_mcp_tool(tool_name):
            # MCP tool — delegate to the MCP registry
            server_name = get_mcp_registry().get_tool_server(tool_name)
            try:
                result = await get_mcp_registry().execute(server_name, tool_name, tool_call["args"])
                consecutive_errors = 0
            except Exception as e:
                result = f"MCP tool error: {e}"
                consecutive_errors += 1
            tool_messages.append(ToolMessage(
                content=result,
                tool_call_id=tool_call["id"],
                name=tool_name
            ))
        else:
            # Unknown tool — synthesize error result (openclaw-mini ToolResultGuard pattern)
            tool_messages.append(ToolMessage(
                content=f"Error: Unknown tool '{tool_name}'. Available tools: {', '.join(t.name for t in ALL_TOOLS)}",
                tool_call_id=tool_call["id"],
                name=tool_name
            ))
            consecutive_errors += 1
    
    return {
        "messages": tool_messages,
        "pending_tool_calls": frontend_calls,
        "tool_results": [],
        "_consecutive_tool_errors": consecutive_errors,
    }


def should_continue(state: AgentState) -> Literal["tool_router", "end"]:
    """Decide whether to continue executing tools."""
    last_message = state["messages"][-1]
    
    if hasattr(last_message, "tool_calls") and last_message.tool_calls:
        # Check if the only tool call is 'finish' — if so, execute it then stop
        return "tool_router"
    
    return "end"


def check_pending_tools(state: AgentState) -> Literal["wait_frontend", "agent", "end"]:
    """Check frontend tools, finish signal, and circuit breaker."""
    pending = state.get("pending_tool_calls", [])
    
    if pending:
        return "wait_frontend"
    
    # Check if the agent called 'finish' — that means we should stop
    messages = state["messages"]
    for msg in reversed(messages[-5:]):  # Check recent messages only
        if isinstance(msg, ToolMessage) and getattr(msg, "name", "") == FINISH_TOOL_NAME:
            content = msg.content or ""
            if content.startswith("FINISH:"):
                print(f"[Agent] Finish tool called, ending loop.")
                return "end"
    
    # Circuit breaker: stop if too many consecutive tool errors
    consecutive_errors = state.get("_consecutive_tool_errors", 0)
    if consecutive_errors >= MAX_TOOL_ERRORS_BEFORE_STOP:
        print(f"[Agent] Circuit breaker: {consecutive_errors} consecutive tool errors, stopping.")
        return "end"
    
    # Safety cap on iterations (increased to support longer chains)
    tool_msg_count = sum(1 for m in state["messages"] if isinstance(m, ToolMessage))
    if tool_msg_count >= MAX_AGENT_ITERATIONS * 2:
        print(f"[Agent] Safety cap: {tool_msg_count} tool messages, stopping.")
        return "end"

    last_message = state["messages"][-1]
    if isinstance(last_message, ToolMessage):
        return "agent"
    
    return "end"


# ==================== Build Graph ====================

def create_agent_graph():
    """创建 Agent Graph"""
    # 创建图
    graph = StateGraph(AgentState)
    
    # 添加节点
    graph.add_node("agent", agent_node)
    graph.add_node("tool_router", tool_router_node)
    
    # 设置入口
    graph.set_entry_point("agent")
    
    # 添加边
    graph.add_conditional_edges(
        "agent",
        should_continue,
        {
            "tool_router": "tool_router",
            "end": END
        }
    )
    
    graph.add_conditional_edges(
        "tool_router",
        check_pending_tools,
        {
            "wait_frontend": END,  # 暂停，等待前端执行工具
            "agent": "agent",      # 后端工具已执行，继续
            "end": END
        }
    )
    
    # 使用内存 checkpointer
    memory = MemorySaver()
    
    return graph.compile(checkpointer=memory)


# 全局 agent 实例
agent_graph = None


def get_agent():
    """获取或创建 agent 实例"""
    global agent_graph
    if agent_graph is None:
        agent_graph = create_agent_graph()
    return agent_graph
