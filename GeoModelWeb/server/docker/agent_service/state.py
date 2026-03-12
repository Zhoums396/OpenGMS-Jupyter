"""
Agent State 定义
增强版：支持三维上下文融合 (Tri-Space Context Fusion)
"""
from typing import TypedDict, Annotated, Sequence, Optional, List, Dict, Any
from langchain_core.messages import BaseMessage
from langgraph.graph.message import add_messages


class WorkspaceFile(TypedDict):
    """工作目录文件"""
    name: str
    path: str
    extension: str
    size: int
    type: str  # vector, raster, table, other


class WorkspaceContext(TypedDict):
    """工作目录上下文"""
    totalFiles: int
    vector: List[WorkspaceFile]
    raster: List[WorkspaceFile]
    table: List[WorkspaceFile]
    other: List[WorkspaceFile]


class NotebookContext(TypedDict):
    """Notebook 上下文"""
    notebookName: Optional[str]
    currentCellCode: Optional[str]
    selectedText: Optional[str]
    workingDirectory: Optional[str]
    projectName: Optional[str]
    userName: Optional[str]
    workspaceFiles: Optional[WorkspaceContext]


class LLMConfigState(TypedDict):
    """Per-session LLM runtime config."""
    provider: Optional[str]
    model: Optional[str]
    base_url: Optional[str]
    api_key: Optional[str]


# ==================== 三维上下文状态 ====================

class UserContextState(TypedDict):
    """用户维度状态 (User Modeling)"""
    expertise_level: Optional[str]      # novice, intermediate, expert
    current_vibe: Optional[str]         # exploratory, debugging, production, learning, uncertain
    vibe_confidence: Optional[float]    # 0-1
    intent_type: Optional[str]          # query, execute, analyze, debug, learn, explore
    intent_ambiguity: Optional[float]   # 0-1
    consecutive_errors: Optional[int]


class PlatformContextState(TypedDict):
    """平台维度状态 (Platform Modeling)"""
    available_services: Optional[List[str]]
    data_file_count: Optional[int]
    active_constraints: Optional[List[str]]


class AgentContextState(TypedDict):
    """Agent 维度状态 (Agent Modeling)"""
    primary_attention: Optional[str]    # user_intent, user_emotion, platform_state, etc.
    current_plan_goal: Optional[str]
    pending_clarifications: Optional[List[str]]


class TriSpaceContext(TypedDict):
    """三维上下文融合状态"""
    user: Optional[UserContextState]
    platform: Optional[PlatformContextState]
    agent: Optional[AgentContextState]
    
    # 对齐结果
    alignment_action: Optional[str]     # proceed, clarify, suggest, explain, confirm
    response_style: Optional[str]       # concise, balanced, verbose


# ==================== 主 Agent 状态 ====================

class AgentState(TypedDict):
    """Agent 状态定义（增强版）"""
    # 消息历史（自动累积）
    messages: Annotated[Sequence[BaseMessage], add_messages]
    
    # 用户上下文
    user_id: Optional[str]
    user_name: Optional[str]
    project_name: Optional[str]
    
    # Notebook 上下文
    notebook_context: Optional[NotebookContext]

    # LLM runtime config (provided by Node backend per request)
    llm_config: Optional[LLMConfigState]
    
    # 三维上下文状态（新增）
    tri_space_context: Optional[TriSpaceContext]
    
    # 会话 ID
    session_id: Optional[str]
    
    # 待执行的工具调用（前端执行）
    pending_tool_calls: List[Dict[str, Any]]
    
    # 工具执行结果
    tool_results: List[Dict[str, Any]]

    # Agent loop internals
    _consecutive_tool_errors: Optional[int]
