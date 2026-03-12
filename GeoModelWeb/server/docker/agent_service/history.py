"""
对话历史管理模块
提供对话历史的持久化存储和检索
"""

import os
import json
import uuid
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Any, Optional
from dataclasses import dataclass, field, asdict
from enum import Enum


class MessageRole(str, Enum):
    """消息角色"""
    USER = "user"
    ASSISTANT = "assistant"
    SYSTEM = "system"
    TOOL = "tool"


@dataclass
class ChatMessage:
    """聊天消息"""
    role: MessageRole
    content: str
    timestamp: str = field(default_factory=lambda: datetime.now().isoformat())
    tool_calls: Optional[List[Dict]] = None      # AI 发起的工具调用
    tool_call_id: Optional[str] = None           # 工具结果对应的调用 ID
    tool_name: Optional[str] = None              # 工具名称
    
    def to_dict(self) -> Dict:
        data = {
            "role": self.role.value if isinstance(self.role, MessageRole) else self.role,
            "content": self.content,
            "timestamp": self.timestamp
        }
        if self.tool_calls:
            data["tool_calls"] = self.tool_calls
        if self.tool_call_id:
            data["tool_call_id"] = self.tool_call_id
        if self.tool_name:
            data["tool_name"] = self.tool_name
        return data
    
    @classmethod
    def from_dict(cls, data: Dict) -> "ChatMessage":
        role = data.get("role", "user")
        if isinstance(role, str):
            try:
                role = MessageRole(role)
            except ValueError:
                role = MessageRole.USER
        
        return cls(
            role=role,
            content=data.get("content", ""),
            timestamp=data.get("timestamp", datetime.now().isoformat()),
            tool_calls=data.get("tool_calls"),
            tool_call_id=data.get("tool_call_id"),
            tool_name=data.get("tool_name")
        )


@dataclass
class Conversation:
    """对话记录"""
    id: str
    title: str
    created_at: str
    updated_at: str
    user_id: str = "default"
    messages: List[ChatMessage] = field(default_factory=list)
    metadata: Dict[str, Any] = field(default_factory=dict)
    # metadata 可包含: project_name, notebook_name, tags 等
    
    def to_dict(self) -> Dict:
        return {
            "id": self.id,
            "title": self.title,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
            "user_id": self.user_id,
            "messages": [m.to_dict() for m in self.messages],
            "metadata": self.metadata
        }
    
    @classmethod
    def from_dict(cls, data: Dict) -> "Conversation":
        messages = [ChatMessage.from_dict(m) for m in data.get("messages", [])]
        return cls(
            id=data.get("id", str(uuid.uuid4())),
            title=data.get("title", "新对话"),
            created_at=data.get("created_at", datetime.now().isoformat()),
            updated_at=data.get("updated_at", datetime.now().isoformat()),
            user_id=data.get("user_id", "default"),
            messages=messages,
            metadata=data.get("metadata", {})
        )
    
    def add_message(self, message: ChatMessage):
        """添加消息并更新时间"""
        self.messages.append(message)
        self.updated_at = datetime.now().isoformat()
    
    def get_summary(self) -> Dict:
        """获取对话摘要（不含完整消息）"""
        return {
            "id": self.id,
            "title": self.title,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
            "user_id": self.user_id,
            "message_count": len(self.messages),
            "metadata": self.metadata
        }


class ConversationStore:
    """
    对话存储
    基于文件系统的简单持久化
    """
    
    def __init__(self, storage_dir: Optional[str] = None):
        if storage_dir:
            self.storage_dir = Path(storage_dir)
        else:
            # 默认存储在项目目录的 data/conversations 下
            self.storage_dir = Path(__file__).parent.parent / "data" / "conversations"
        
        self.storage_dir.mkdir(parents=True, exist_ok=True)
        
        # 内存缓存
        self._cache: Dict[str, Conversation] = {}
    
    def _get_user_dir(self, user_id: str) -> Path:
        """获取用户的存储目录"""
        user_dir = self.storage_dir / user_id
        user_dir.mkdir(parents=True, exist_ok=True)
        return user_dir
    
    def _get_conversation_path(self, user_id: str, conversation_id: str) -> Path:
        """获取对话文件路径"""
        return self._get_user_dir(user_id) / f"{conversation_id}.json"
    
    def create(self, user_id: str = "default", title: str = "新对话", 
               metadata: Optional[Dict] = None) -> Conversation:
        """创建新对话"""
        now = datetime.now().isoformat()
        conversation = Conversation(
            id=str(uuid.uuid4()),
            title=title,
            created_at=now,
            updated_at=now,
            user_id=user_id,
            messages=[],
            metadata=metadata or {}
        )
        
        # 保存到文件
        self.save(conversation)
        
        # 缓存
        self._cache[conversation.id] = conversation
        
        return conversation
    
    def get(self, conversation_id: str, user_id: str = "default") -> Optional[Conversation]:
        """获取对话"""
        # 先查缓存
        if conversation_id in self._cache:
            return self._cache[conversation_id]
        
        # 从文件加载
        path = self._get_conversation_path(user_id, conversation_id)
        if path.exists():
            with open(path, "r", encoding="utf-8") as f:
                data = json.load(f)
                conversation = Conversation.from_dict(data)
                self._cache[conversation_id] = conversation
                return conversation
        
        return None
    
    def save(self, conversation: Conversation):
        """保存对话"""
        path = self._get_conversation_path(conversation.user_id, conversation.id)
        with open(path, "w", encoding="utf-8") as f:
            json.dump(conversation.to_dict(), f, ensure_ascii=False, indent=2)
        
        # 更新缓存
        self._cache[conversation.id] = conversation
    
    def delete(self, conversation_id: str, user_id: str = "default") -> bool:
        """删除对话"""
        path = self._get_conversation_path(user_id, conversation_id)
        if path.exists():
            path.unlink()
            if conversation_id in self._cache:
                del self._cache[conversation_id]
            return True
        return False
    
    def list_conversations(self, user_id: str = "default", 
                          limit: int = 50, 
                          offset: int = 0) -> List[Dict]:
        """
        列出用户的所有对话（摘要）
        按更新时间倒序
        """
        user_dir = self._get_user_dir(user_id)
        conversations = []
        
        for file_path in user_dir.glob("*.json"):
            try:
                with open(file_path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    conv = Conversation.from_dict(data)
                    conversations.append(conv.get_summary())
            except Exception as e:
                print(f"Error loading conversation {file_path}: {e}")
                continue
        
        # 按更新时间倒序排序
        conversations.sort(key=lambda x: x["updated_at"], reverse=True)
        
        # 分页
        return conversations[offset:offset + limit]
    
    def add_message(self, conversation_id: str, message: ChatMessage, 
                    user_id: str = "default") -> Optional[Conversation]:
        """向对话添加消息"""
        conversation = self.get(conversation_id, user_id)
        if conversation:
            conversation.add_message(message)
            self.save(conversation)
            return conversation
        return None
    
    def update_title(self, conversation_id: str, title: str, 
                     user_id: str = "default") -> Optional[Conversation]:
        """更新对话标题"""
        conversation = self.get(conversation_id, user_id)
        if conversation:
            conversation.title = title
            conversation.updated_at = datetime.now().isoformat()
            self.save(conversation)
            return conversation
        return None
    
    def search(self, query: str, user_id: str = "default", 
               limit: int = 20) -> List[Dict]:
        """
        搜索对话（简单的关键词搜索）
        """
        results = []
        user_dir = self._get_user_dir(user_id)
        
        for file_path in user_dir.glob("*.json"):
            try:
                with open(file_path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    
                    # 搜索标题
                    if query.lower() in data.get("title", "").lower():
                        conv = Conversation.from_dict(data)
                        results.append(conv.get_summary())
                        continue
                    
                    # 搜索消息内容
                    for msg in data.get("messages", []):
                        if query.lower() in msg.get("content", "").lower():
                            conv = Conversation.from_dict(data)
                            results.append(conv.get_summary())
                            break
                            
            except Exception as e:
                continue
        
        # 按更新时间倒序
        results.sort(key=lambda x: x["updated_at"], reverse=True)
        return results[:limit]


# ==================== 全局实例 ====================

_store: Optional[ConversationStore] = None


def get_conversation_store() -> ConversationStore:
    """获取全局对话存储实例"""
    global _store
    if _store is None:
        _store = ConversationStore()
    return _store


# ==================== 辅助函数 ====================

def generate_title_from_message(message: str, max_length: int = 30) -> str:
    """
    从第一条消息生成对话标题
    """
    # 清理消息
    title = message.strip()
    
    # 移除换行
    title = title.replace("\n", " ")
    
    # 截断
    if len(title) > max_length:
        title = title[:max_length] + "..."
    
    return title or "新对话"
