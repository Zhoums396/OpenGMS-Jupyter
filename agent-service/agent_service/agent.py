"""
LangGraph Agent 定义
"""
from typing import Literal, Optional, Dict, Any, List
import os
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
from .tools import ALL_TOOLS, FRONTEND_TOOLS, BACKEND_TOOLS
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


def get_llm() -> ChatOpenAI:
    """获取 LLM 实例"""
    return ChatOpenAI(
        model=LLM_MODEL,
        base_url=LLM_BASE_URL,
        api_key=LLM_API_KEY,
        temperature=0.7,
        streaming=True,
    )


async def execute_backend_tool(tool_name: str, tool_args: Dict[str, Any]) -> str:
    """执行后端工具（如搜索模型）"""
    try:
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
        
        return f"未知工具: {tool_name}"
    except asyncio.TimeoutError:
        return f"工具执行超时: {tool_name}"
    except Exception as e:
        return f"工具执行错误: {str(e)}"


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

# ==================== Graph Nodes ====================

async def agent_node(state: AgentState) -> Dict[str, Any]:
    """Agent 节点：调用 LLM（集成三维上下文融合）"""
    llm = get_llm()
    llm_with_tools = llm.bind_tools(ALL_TOOLS)
    
    # 获取上下文信息
    context = state.get("notebook_context")
    user_name = state.get("user_name", "User")
    user_id = state.get("user_id", "default")
    
    # 获取当前用户消息（用于三维上下文分析）
    current_message = None
    messages = list(state["messages"])
    for msg in reversed(messages):
        if isinstance(msg, HumanMessage):
            current_message = msg.content
            break
    
    # ===== Tri-Space Context Fusion (使用整合后的 modeling 模块) =====
    user_model_manager = get_user_model_manager()
    vibe_suggestions = []
    
    try:
        # 1. 获取用户模型
        user_model = user_model_manager.get(user_id, user_name)
        
        # 2. 更新 Vibe 状态
        if current_message:
            # 记录交互事件
            from datetime import datetime
            event = InteractionEvent(
                timestamp=datetime.now(),
                event_type="message",
                content=current_message
            )
            user_model.record_interaction(event)
            
            # 更新 Vibe
            user_model_manager.update_vibe(user_id, current_message)
        
        # 3. 获取 Vibe 建议
        vibe_suggestions = user_model_manager.get_vibe_suggestions(user_model)
        
        # 4. 推断用户专业水平
        expertise_level = user_model_manager.infer_expertise(user_id)
        
    except Exception as e:
        print(f"[Agent] User modeling failed: {e}")
        import traceback
        traceback.print_exc()
    
    # 使用增强版 Prompt 构建器（包含 Tri-Space Context Fusion）
    try:
        system_prompt = build_enhanced_system_prompt(
            context=context,
            current_message=current_message,
            user_id=user_id,
            user_name=user_name
        )
        
        # 注入 Vibe 建议
        if vibe_suggestions:
            system_prompt += "\n\n## Agent 行为建议 (基于用户当前状态)\n" + "\n".join(f"- {s}" for s in vibe_suggestions)
            
    except Exception as e:
        # 降级到基础版本
        print(f"[Agent] Enhanced prompt failed, falling back: {e}")
        system_prompt = build_system_prompt(context)
    
    # 构建消息列表
    # 如果第一条不是 system message，添加它
    if not messages or not isinstance(messages[0], SystemMessage):
        messages.insert(0, SystemMessage(content=system_prompt))
    else:
        # 更新 system prompt（因为三维上下文可能变化）
        messages[0] = SystemMessage(content=system_prompt)
    
    # 调用 LLM
    response = await llm_with_tools.ainvoke(messages)
    
    return {"messages": [response]}


async def tool_router_node(state: AgentState) -> Dict[str, Any]:
    """工具路由节点：区分前端和后端工具"""
    import json as _json
    last_message = state["messages"][-1]
    
    if not hasattr(last_message, "tool_calls") or not last_message.tool_calls:
        return {"pending_tool_calls": [], "tool_results": []}
    
    frontend_calls = []
    tool_messages = []
    
    for tool_call in last_message.tool_calls:
        tool_name = tool_call["name"]
        
        if tool_name in FRONTEND_TOOLS:
            # 前端工具：添加到待执行列表
            # 同时添加占位 ToolMessage 以满足 LLM API 要求
            frontend_calls.append({
                "id": tool_call["id"],
                "name": tool_name,
                "arguments": _json.dumps(tool_call["args"], ensure_ascii=False)
            })
            # 占位消息 - 会在前端执行后被替换
            tool_messages.append(ToolMessage(
                content=f"[前端执行中...]",
                tool_call_id=tool_call["id"],
                name=tool_name
            ))
        elif tool_name in BACKEND_TOOLS:
            # 后端工具：直接执行
            result = await execute_backend_tool(tool_name, tool_call["args"])
            tool_messages.append(ToolMessage(
                content=result,
                tool_call_id=tool_call["id"],
                name=tool_name
            ))
    
    return {
        "messages": tool_messages,
        "pending_tool_calls": frontend_calls,
        "tool_results": []
    }


def should_continue(state: AgentState) -> Literal["tool_router", "end"]:
    """决定是否继续执行工具"""
    last_message = state["messages"][-1]
    
    # 如果有工具调用，继续
    if hasattr(last_message, "tool_calls") and last_message.tool_calls:
        return "tool_router"
    
    return "end"


def check_pending_tools(state: AgentState) -> Literal["wait_frontend", "agent", "end"]:
    """检查是否有待执行的前端工具"""
    pending = state.get("pending_tool_calls", [])
    
    if pending:
        # 有前端工具需要执行，暂停等待
        return "wait_frontend"
    
    # 检查是否有后端工具结果需要继续处理
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
