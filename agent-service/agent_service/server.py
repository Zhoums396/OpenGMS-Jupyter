"""
FastAPI 服务器
"""
import os
import json
import uuid
from typing import Optional, List, Dict, Any
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sse_starlette.sse import EventSourceResponse
from dotenv import load_dotenv

from langchain_core.messages import HumanMessage, ToolMessage

from .agent import get_agent
from .state import NotebookContext
from .history import (
    get_conversation_store, 
    ChatMessage, 
    MessageRole,
    generate_title_from_message
)

# 加载环境变量
load_dotenv()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """应用生命周期管理"""
    # 启动时初始化 agent
    print("🚀 Initializing LangGraph Agent...")
    get_agent()
    print("✅ Agent ready!")
    yield
    print("👋 Shutting down...")


app = FastAPI(
    title="GeoModel Agent Service",
    description="LangGraph-based AI Agent for OpenGeoLab",
    version="0.1.0",
    lifespan=lifespan
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ==================== Request/Response Models ====================

class ChatRequest(BaseModel):
    """聊天请求"""
    message: str
    session_id: Optional[str] = None
    user_id: Optional[str] = None
    user_name: Optional[str] = None
    project_name: Optional[str] = None
    context: Optional[Dict[str, Any]] = None


class ToolResultRequest(BaseModel):
    """工具执行结果"""
    session_id: str
    tool_results: List[Dict[str, str]]  # [{"tool_call_id": "xxx", "result": "xxx"}]


class ChatResponse(BaseModel):
    """聊天响应"""
    session_id: str
    content: str
    tool_calls: Optional[List[Dict[str, Any]]] = None
    is_complete: bool = True


# ==================== API Endpoints ====================

@app.get("/health")
async def health_check():
    """健康检查"""
    return {"status": "ok", "service": "geomodel-agent"}


@app.post("/api/agent/chat")
async def chat(request: ChatRequest):
    """
    聊天接口 - SSE 流式响应
    """
    agent = get_agent()
    
    # 生成或使用现有 session_id
    session_id = request.session_id or str(uuid.uuid4())
    
    # 构建初始状态
    config = {"configurable": {"thread_id": session_id}}
    
    async def event_generator():
        try:
            # 构建输入
            input_state = {
                "messages": [HumanMessage(content=request.message)],
                "user_id": request.user_id,
                "user_name": request.user_name,
                "project_name": request.project_name,
                "notebook_context": request.context,
                "pending_tool_calls": [],
                "tool_results": [],
                "session_id": session_id,
            }
            
            # 流式执行
            full_content = ""
            pending_tools = []
            
            async for event in agent.astream_events(input_state, config, version="v2"):
                kind = event["event"]
                
                if kind == "on_chat_model_stream":
                    # 流式文本
                    chunk = event["data"]["chunk"]
                    if hasattr(chunk, "content") and chunk.content:
                        full_content += chunk.content
                        yield {
                            "event": "text",
                            "data": json.dumps({
                                "type": "text",
                                "content": chunk.content
                            }, ensure_ascii=False)
                        }
                
                elif kind == "on_chat_model_end":
                    # LLM 调用结束，检查工具调用
                    output = event["data"]["output"]
                    if hasattr(output, "tool_calls") and output.tool_calls:
                        for tool_call in output.tool_calls:
                            tool_data = {
                                "id": tool_call["id"],
                                "name": tool_call["name"],
                                "arguments": json.dumps(tool_call["args"], ensure_ascii=False)
                            }
                            pending_tools.append(tool_data)
                            yield {
                                "event": "tool_call",
                                "data": json.dumps({
                                    "type": "tool_call",
                                    "tool": tool_data
                                }, ensure_ascii=False)
                            }
            
            # 获取最终状态
            final_state = await agent.aget_state(config)
            pending_from_state = final_state.values.get("pending_tool_calls", [])
            
            # 发送完成事件
            yield {
                "event": "done",
                "data": json.dumps({
                    "type": "done",
                    "sessionId": session_id,
                    "content": full_content,
                    "toolCalls": pending_from_state or pending_tools,
                    "isComplete": len(pending_from_state) == 0
                }, ensure_ascii=False)
            }
            
        except Exception as e:
            import traceback
            traceback.print_exc()
            yield {
                "event": "error",
                "data": json.dumps({
                    "type": "error",
                    "error": str(e)
                }, ensure_ascii=False)
            }
    
    return EventSourceResponse(event_generator())


@app.post("/api/agent/tool-results")
async def submit_tool_results(request: ToolResultRequest):
    """
    提交前端工具执行结果，继续对话
    """
    agent = get_agent()
    config = {"configurable": {"thread_id": request.session_id}}
    
    async def event_generator():
        try:
            # 获取当前状态
            current_state = await agent.aget_state(config)
            current_messages = list(current_state.values.get("messages", []))
            
            # 创建 tool_call_id -> result 的映射
            result_map = {r["tool_call_id"]: r["result"] for r in request.tool_results}
            
            # 找到需要替换的占位消息，获取其 ID
            tool_messages_to_add = []
            for msg in current_messages:
                if isinstance(msg, ToolMessage) and msg.tool_call_id in result_map:
                    # 使用相同的消息 ID 来替换原有消息
                    tool_messages_to_add.append(ToolMessage(
                        content=result_map[msg.tool_call_id],
                        tool_call_id=msg.tool_call_id,
                        name=getattr(msg, 'name', None),
                        id=msg.id  # 使用相同的 ID 来触发 add_messages 的替换逻辑
                    ))
            
            if not tool_messages_to_add:
                yield {
                    "event": "error",
                    "data": json.dumps({
                        "type": "error",
                        "error": "No matching placeholder messages found"
                    }, ensure_ascii=False)
                }
                return
            
            # 使用 aupdate_state 更新状态
            # add_messages reducer 会根据 id 替换相同 ID 的消息
            await agent.aupdate_state(
                config,
                {
                    "messages": tool_messages_to_add,
                    "pending_tool_calls": [],
                },
                as_node="tool_router"
            )
            
            # 从当前位置继续执行图（None 表示继续）
            full_content = ""
            pending_tools = []
            
            async for event in agent.astream_events(None, config, version="v2"):
                kind = event["event"]
                
                if kind == "on_chat_model_stream":
                    chunk = event["data"]["chunk"]
                    if hasattr(chunk, "content") and chunk.content:
                        full_content += chunk.content
                        yield {
                            "event": "text",
                            "data": json.dumps({
                                "type": "text",
                                "content": chunk.content
                            }, ensure_ascii=False)
                        }
                
                elif kind == "on_chat_model_end":
                    output = event["data"]["output"]
                    if hasattr(output, "tool_calls") and output.tool_calls:
                        for tool_call in output.tool_calls:
                            tool_data = {
                                "id": tool_call["id"],
                                "name": tool_call["name"],
                                "arguments": json.dumps(tool_call["args"], ensure_ascii=False)
                            }
                            pending_tools.append(tool_data)
                            yield {
                                "event": "tool_call",
                                "data": json.dumps({
                                    "type": "tool_call",
                                    "tool": tool_data
                                }, ensure_ascii=False)
                            }
            
            # 获取最终状态
            final_state = await agent.aget_state(config)
            pending_from_state = final_state.values.get("pending_tool_calls", [])
            
            yield {
                "event": "done",
                "data": json.dumps({
                    "type": "done",
                    "sessionId": request.session_id,
                    "content": full_content,
                    "toolCalls": pending_from_state or pending_tools,
                    "isComplete": len(pending_from_state) == 0
                }, ensure_ascii=False)
            }
            
        except Exception as e:
            import traceback
            traceback.print_exc()
            yield {
                "event": "error",
                "data": json.dumps({
                    "type": "error",
                    "error": str(e)
                }, ensure_ascii=False)
            }
    
    return EventSourceResponse(event_generator())


@app.get("/api/agent/session/{session_id}")
async def get_session(session_id: str):
    """获取会话状态"""
    agent = get_agent()
    config = {"configurable": {"thread_id": session_id}}
    
    try:
        state = await agent.aget_state(config)
        if state.values:
            messages = []
            for msg in state.values.get("messages", []):
                messages.append({
                    "role": msg.__class__.__name__.replace("Message", "").lower(),
                    "content": getattr(msg, "content", ""),
                })
            return {
                "session_id": session_id,
                "messages": messages,
                "pending_tool_calls": state.values.get("pending_tool_calls", [])
            }
        return {"session_id": session_id, "messages": [], "pending_tool_calls": []}
    except Exception as e:
        raise HTTPException(status_code=404, detail=f"Session not found: {e}")


@app.delete("/api/agent/session/{session_id}")
async def delete_session(session_id: str):
    """删除会话"""
    # MemorySaver 不支持删除，返回成功即可
    return {"status": "ok", "message": f"Session {session_id} cleared"}


# ==================== 对话历史 API ====================

class CreateConversationRequest(BaseModel):
    """创建对话请求"""
    user_id: Optional[str] = "default"
    title: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None


class UpdateTitleRequest(BaseModel):
    """更新标题请求"""
    title: str


@app.get("/api/conversations")
async def list_conversations(
    user_id: str = "default",
    limit: int = 50,
    offset: int = 0
):
    """
    获取对话列表
    """
    store = get_conversation_store()
    conversations = store.list_conversations(user_id, limit, offset)
    return {
        "conversations": conversations,
        "total": len(conversations),
        "limit": limit,
        "offset": offset
    }


@app.post("/api/conversations")
async def create_conversation(request: CreateConversationRequest):
    """
    创建新对话
    """
    store = get_conversation_store()
    conversation = store.create(
        user_id=request.user_id or "default",
        title=request.title or "新对话",
        metadata=request.metadata
    )
    return conversation.get_summary()


@app.get("/api/conversations/{conversation_id}")
async def get_conversation(conversation_id: str, user_id: str = "default"):
    """
    获取对话详情（包含所有消息）
    """
    store = get_conversation_store()
    conversation = store.get(conversation_id, user_id)
    
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    return conversation.to_dict()


class AddMessageRequest(BaseModel):
    """添加消息请求"""
    role: str
    content: str
    user_id: str = "default"


@app.post("/api/conversations/{conversation_id}/messages")
async def add_message_to_conversation(
    conversation_id: str,
    request: AddMessageRequest
):
    """
    向对话添加消息
    """
    store = get_conversation_store()
    
    message = ChatMessage(
        role=MessageRole(request.role),
        content=request.content
    )
    
    conversation = store.add_message(conversation_id, message, request.user_id)
    
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    return {"status": "ok", "message_count": len(conversation.messages)}


@app.put("/api/conversations/{conversation_id}/title")
async def update_conversation_title(
    conversation_id: str, 
    request: UpdateTitleRequest,
    user_id: str = "default"
):
    """
    更新对话标题
    """
    store = get_conversation_store()
    conversation = store.update_title(conversation_id, request.title, user_id)
    
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    return conversation.get_summary()


@app.delete("/api/conversations/{conversation_id}")
async def delete_conversation(conversation_id: str, user_id: str = "default"):
    """
    删除对话
    """
    store = get_conversation_store()
    success = store.delete(conversation_id, user_id)
    
    if not success:
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    return {"status": "ok", "message": f"Conversation {conversation_id} deleted"}


@app.get("/api/conversations/search")
async def search_conversations(
    q: str,
    user_id: str = "default",
    limit: int = 20
):
    """
    搜索对话
    """
    store = get_conversation_store()
    results = store.search(q, user_id, limit)
    return {
        "query": q,
        "results": results,
        "total": len(results)
    }


# ==================== 集成对话历史的聊天 ====================

class ChatWithHistoryRequest(BaseModel):
    """带历史记录的聊天请求"""
    message: str
    conversation_id: Optional[str] = None  # 如果为空则创建新对话
    user_id: Optional[str] = "default"
    user_name: Optional[str] = None
    project_name: Optional[str] = None
    context: Optional[Dict[str, Any]] = None


@app.post("/api/agent/chat-with-history")
async def chat_with_history(request: ChatWithHistoryRequest):
    """
    带历史记录的聊天接口
    会自动保存对话历史
    """
    agent = get_agent()
    store = get_conversation_store()
    
    user_id = request.user_id or "default"
    
    # 获取或创建对话
    if request.conversation_id:
        conversation = store.get(request.conversation_id, user_id)
        if not conversation:
            raise HTTPException(status_code=404, detail="Conversation not found")
    else:
        # 创建新对话，使用第一条消息生成标题
        title = generate_title_from_message(request.message)
        conversation = store.create(
            user_id=user_id,
            title=title,
            metadata={
                "project_name": request.project_name,
                "user_name": request.user_name
            }
        )
    
    # 保存用户消息
    user_message = ChatMessage(
        role=MessageRole.USER,
        content=request.message
    )
    store.add_message(conversation.id, user_message, user_id)
    
    # 使用 conversation.id 作为 session_id
    session_id = conversation.id
    config = {"configurable": {"thread_id": session_id}}
    
    async def event_generator():
        try:
            # 构建输入
            input_state = {
                "messages": [HumanMessage(content=request.message)],
                "user_id": user_id,
                "user_name": request.user_name,
                "project_name": request.project_name,
                "notebook_context": request.context,
                "pending_tool_calls": [],
                "tool_results": [],
                "session_id": session_id,
            }
            
            # 流式执行
            full_content = ""
            pending_tools = []
            
            async for event in agent.astream_events(input_state, config, version="v2"):
                kind = event["event"]
                
                if kind == "on_chat_model_stream":
                    chunk = event["data"]["chunk"]
                    if hasattr(chunk, "content") and chunk.content:
                        full_content += chunk.content
                        yield {
                            "event": "text",
                            "data": json.dumps({
                                "type": "text",
                                "content": chunk.content
                            }, ensure_ascii=False)
                        }
                
                elif kind == "on_chat_model_end":
                    output = event["data"]["output"]
                    if hasattr(output, "tool_calls") and output.tool_calls:
                        for tool_call in output.tool_calls:
                            tool_data = {
                                "id": tool_call["id"],
                                "name": tool_call["name"],
                                "arguments": json.dumps(tool_call["args"], ensure_ascii=False)
                            }
                            pending_tools.append(tool_data)
                            yield {
                                "event": "tool_call",
                                "data": json.dumps({
                                    "type": "tool_call",
                                    "tool": tool_data
                                }, ensure_ascii=False)
                            }
            
            # 保存助手响应
            if full_content:
                assistant_message = ChatMessage(
                    role=MessageRole.ASSISTANT,
                    content=full_content,
                    tool_calls=pending_tools if pending_tools else None
                )
                store.add_message(conversation.id, assistant_message, user_id)
            
            # 获取最终状态
            final_state = await agent.aget_state(config)
            pending_from_state = final_state.values.get("pending_tool_calls", [])
            
            # 发送完成事件
            yield {
                "event": "done",
                "data": json.dumps({
                    "type": "done",
                    "conversationId": conversation.id,
                    "sessionId": session_id,
                    "content": full_content,
                    "toolCalls": pending_from_state or pending_tools,
                    "isComplete": len(pending_from_state) == 0
                }, ensure_ascii=False)
            }
            
        except Exception as e:
            import traceback
            traceback.print_exc()
            yield {
                "event": "error",
                "data": json.dumps({
                    "type": "error",
                    "error": str(e)
                }, ensure_ascii=False)
            }
    
    return EventSourceResponse(event_generator())


# ==================== User Modeling APIs (整合后的版本) ====================

from .modeling import (
    get_user_model_manager,
    UserVibe,
    ExpertiseLevel
)


@app.get("/api/user/vibe")
async def get_vibe_state(user_id: str = "default"):
    """
    获取当前用户的 Vibe 状态
    用于调试和前端展示
    """
    try:
        manager = get_user_model_manager()
        user_model = manager.get(user_id)
        suggestions = manager.get_vibe_suggestions(user_model)
        
        return {
            "success": True,
            "data": {
                "state": user_model.current_vibe.value,
                "confidence": user_model.vibe_confidence,
                "suggestions": suggestions
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/user/profile/{user_id}")
async def get_user_profile(user_id: str):
    """
    获取用户画像
    """
    try:
        manager = get_user_model_manager()
        user_model = manager.get(user_id)
        profile = user_model.profile
        
        return {
            "success": True,
            "data": {
                "user_id": profile.user_id,
                "user_name": profile.user_name,
                "expertise_level": profile.expertise_level.value,
                "domain_knowledge": profile.domain_knowledge,
                "total_sessions": profile.total_sessions,
                "total_interactions": profile.total_interactions,
                "successful_model_runs": profile.successful_model_runs,
                "favorite_models": profile.favorite_models,
                "recent_files": profile.recent_files,
                "vibe": {
                    "current": user_model.current_vibe.value,
                    "confidence": user_model.vibe_confidence
                }
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


class UpdateProfileRequest(BaseModel):
    """更新用户画像请求"""
    user_name: Optional[str] = None
    expertise_level: Optional[str] = None
    domain_knowledge: Optional[List[str]] = None


@app.put("/api/user/profile/{user_id}")
async def update_user_profile(user_id: str, request: UpdateProfileRequest):
    """
    更新用户画像
    """
    try:
        manager = get_user_model_manager()
        user_model = manager.get(user_id)
        
        if request.user_name:
            user_model.profile.user_name = request.user_name
        if request.expertise_level:
            try:
                user_model.profile.expertise_level = ExpertiseLevel(request.expertise_level)
            except ValueError:
                pass
        if request.domain_knowledge:
            user_model.profile.domain_knowledge = request.domain_knowledge
        
        manager.save(user_model)
        
        return {
            "success": True,
            "data": {
                "user_id": user_model.profile.user_id,
                "expertise_level": user_model.profile.expertise_level.value
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/user/modeling/status")
async def get_user_modeling_status(user_id: str = "default"):
    """
    获取完整的用户建模状态
    包含 Vibe、Profile、Intent 信息
    """
    try:
        manager = get_user_model_manager()
        user_model = manager.get(user_id)
        suggestions = manager.get_vibe_suggestions(user_model)
        
        # Vibe 状态解释
        vibe_desc = {
            UserVibe.EXPLORATORY: "探索模式 - 用户正在尝试新想法",
            UserVibe.DEBUGGING: "调试模式 - 用户遇到问题需要帮助",
            UserVibe.PRODUCTION: "生产模式 - 用户目标明确，需要高效执行",
            UserVibe.LEARNING: "学习模式 - 用户想了解原理",
            UserVibe.UNCERTAIN: "待定 - 需要更多交互来判断"
        }
        
        return {
            "success": True,
            "data": {
                "vibe": {
                    "state": user_model.current_vibe.value,
                    "description": vibe_desc.get(user_model.current_vibe, ""),
                    "confidence": user_model.vibe_confidence,
                    "suggestions": suggestions
                },
                "profile": {
                    "expertiseLevel": user_model.profile.expertise_level.value,
                    "statistics": {
                        "sessions": user_model.profile.total_sessions,
                        "interactions": user_model.profile.total_interactions,
                        "successfulRuns": user_model.profile.successful_model_runs
                    }
                },
                "intent": {
                    "current": user_model.current_intent.primary_intent.value if user_model.current_intent else None,
                    "ambiguity": user_model.current_intent.ambiguity_level if user_model.current_intent else 0,
                    "clarificationNeeded": user_model.current_intent.clarification_needed if user_model.current_intent else []
                },
                "session": {
                    "consecutiveErrors": user_model.consecutive_errors,
                    "lastSuccess": user_model.last_successful_action
                }
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ==================== Main ====================

if __name__ == "__main__":
    import uvicorn
    
    host = os.getenv("HOST", "0.0.0.0")
    port = int(os.getenv("PORT", 8000))
    
    uvicorn.run(app, host=host, port=port)
