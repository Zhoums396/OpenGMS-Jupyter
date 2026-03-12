"""
User Modeling: "The Flow of Intent"
用户建模：定义 "为了什么做" 以及 "以什么状态做"

核心概念：
- Static Profile: 显性画像（用户专业水平）
- Vibe/State: 隐性神韵（探索/调试/生产状态）
- Interaction Trace: 交互历史（意图连续性）

参考：
- Ray (2025): Vibe Coding 概念
- Gu et al. (2024): 不同水平用户需要不同层级帮助
- Dourish (2004): 上下文是交互性的
"""

from typing import Dict, List, Optional, Any, Deque
from dataclasses import dataclass, field
from enum import Enum
from datetime import datetime
from collections import deque
import json


class ExpertiseLevel(Enum):
    """用户专业水平"""
    NOVICE = "novice"           # 新手：需要详细解释和引导
    INTERMEDIATE = "intermediate"  # 中级：需要建议但能独立操作
    EXPERT = "expert"           # 专家：只需简洁执行


class UserVibe(Enum):
    """
    用户神韵/状态 (Vibe)
    基于 Ray (2025) 的 Vibe Coding 概念
    """
    EXPLORATORY = "exploratory"     # 探索模式：尝试新想法，需要建议和选项
    DEBUGGING = "debugging"         # 调试模式：遇到问题，需要诊断和修复
    PRODUCTION = "production"       # 生产模式：目标明确，需要高效执行
    LEARNING = "learning"           # 学习模式：想了解原理，需要解释
    UNCERTAIN = "uncertain"         # 不确定：需要澄清意图


class IntentType(Enum):
    """意图类型"""
    QUERY = "query"                 # 查询信息
    EXECUTE = "execute"             # 执行操作
    ANALYZE = "analyze"             # 分析数据
    DEBUG = "debug"                 # 调试问题
    LEARN = "learn"                 # 学习知识
    EXPLORE = "explore"             # 探索可能性


@dataclass
class InteractionEvent:
    """
    交互事件 - 记录单次用户交互
    """
    timestamp: datetime
    event_type: str                 # message, cell_run, file_upload, error
    content: str                    # 事件内容
    intent_type: Optional[IntentType] = None
    
    # 上下文
    notebook_cell_index: Optional[int] = None
    execution_result: Optional[str] = None  # success, error, timeout
    error_message: Optional[str] = None
    
    # 元数据
    duration_ms: Optional[int] = None
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class IntentVector:
    """
    意图向量 - 时变的用户意图表示
    """
    primary_intent: IntentType
    confidence: float               # 0-1，意图识别置信度
    
    # 意图参数
    target_object: Optional[str] = None    # 操作目标（模型名、文件名等）
    target_action: Optional[str] = None    # 期望动作
    
    # 模糊性指标
    ambiguity_level: float = 0.0           # 0-1，意图模糊程度
    clarification_needed: List[str] = field(default_factory=list)  # 需要澄清的点
    
    # 时间衰减
    timestamp: datetime = field(default_factory=datetime.now)


@dataclass
class StaticProfile:
    """
    显性用户画像
    """
    user_id: str
    user_name: str
    
    # 专业水平
    expertise_level: ExpertiseLevel = ExpertiseLevel.INTERMEDIATE
    domain_knowledge: List[str] = field(default_factory=list)  # ["GIS", "遥感", "水文"]
    
    # 偏好设置
    preferred_language: str = "zh-CN"
    code_style: str = "detailed"    # detailed / concise
    explanation_level: str = "moderate"  # minimal / moderate / verbose
    
    # 历史统计
    total_sessions: int = 0
    total_interactions: int = 0
    successful_model_runs: int = 0
    
    # 常用模型/方法
    favorite_models: List[str] = field(default_factory=list)
    recent_files: List[str] = field(default_factory=list)


@dataclass
class UserModel:
    """
    用户模型 - 完整的用户状态表示
    """
    # 静态画像
    profile: StaticProfile
    
    # 动态状态
    current_vibe: UserVibe = UserVibe.UNCERTAIN
    vibe_confidence: float = 0.5
    
    # 意图流
    current_intent: Optional[IntentVector] = None
    intent_history: Deque[IntentVector] = field(default_factory=lambda: deque(maxlen=10))
    
    # 交互历史
    interaction_trace: Deque[InteractionEvent] = field(default_factory=lambda: deque(maxlen=50))
    
    # 会话状态
    session_start_time: datetime = field(default_factory=datetime.now)
    consecutive_errors: int = 0
    last_successful_action: Optional[str] = None
    
    def record_interaction(self, event: InteractionEvent):
        """记录交互事件"""
        self.interaction_trace.append(event)
        
        # 更新错误计数
        if event.execution_result == "error":
            self.consecutive_errors += 1
        elif event.execution_result == "success":
            self.consecutive_errors = 0
            self.last_successful_action = event.content[:100]
    
    def update_intent(self, intent: IntentVector):
        """更新意图向量"""
        if self.current_intent:
            self.intent_history.append(self.current_intent)
        self.current_intent = intent
    
    def infer_vibe(self) -> UserVibe:
        """
        基于交互历史推断用户当前 Vibe
        这是 Vibe Sensing 的核心逻辑
        """
        if not self.interaction_trace:
            return UserVibe.UNCERTAIN
        
        recent_events = list(self.interaction_trace)[-10:]  # 最近10个事件
        
        # 检测调试模式：连续错误
        if self.consecutive_errors >= 2:
            self.current_vibe = UserVibe.DEBUGGING
            self.vibe_confidence = min(0.9, 0.5 + self.consecutive_errors * 0.15)
            return self.current_vibe
        
        # 分析事件模式
        error_count = sum(1 for e in recent_events if e.execution_result == "error")
        query_count = sum(1 for e in recent_events if e.intent_type == IntentType.QUERY)
        execute_count = sum(1 for e in recent_events if e.intent_type == IntentType.EXECUTE)
        
        # 探索模式：大量查询，较少执行
        if query_count > execute_count * 2:
            self.current_vibe = UserVibe.EXPLORATORY
            self.vibe_confidence = 0.7
        
        # 生产模式：连续成功执行
        elif execute_count >= 3 and error_count == 0:
            self.current_vibe = UserVibe.PRODUCTION
            self.vibe_confidence = 0.8
        
        # 学习模式：检测学习相关关键词
        recent_messages = [e.content.lower() for e in recent_events if e.event_type == "message"]
        learning_keywords = ["什么是", "为什么", "怎么", "解释", "原理", "介绍"]
        if any(kw in msg for msg in recent_messages for kw in learning_keywords):
            self.current_vibe = UserVibe.LEARNING
            self.vibe_confidence = 0.75
        
        return self.current_vibe
    
    def get_intent_continuity_score(self) -> float:
        """
        计算意图连续性分数
        高分表示用户有明确的持续目标
        """
        if len(self.intent_history) < 2:
            return 0.5
        
        recent_intents = list(self.intent_history)[-5:]
        
        # 检查意图类型一致性
        intent_types = [i.primary_intent for i in recent_intents]
        most_common = max(set(intent_types), key=intent_types.count)
        consistency = intent_types.count(most_common) / len(intent_types)
        
        # 检查目标对象一致性
        targets = [i.target_object for i in recent_intents if i.target_object]
        if targets:
            target_consistency = len(set(targets)) / len(targets)
            target_consistency = 1 - target_consistency  # 越少越一致
        else:
            target_consistency = 0.5
        
        return (consistency + target_consistency) / 2
    
    def to_context_string(self) -> str:
        """生成用于 LLM 的用户上下文描述"""
        ctx = "## 用户状态 (User Context)\n\n"
        
        # 基础信息
        ctx += f"**用户**: {self.profile.user_name}\n"
        ctx += f"**专业水平**: {self.profile.expertise_level.value}\n"
        if self.profile.domain_knowledge:
            ctx += f"**领域知识**: {', '.join(self.profile.domain_knowledge)}\n"
        
        # 当前状态
        ctx += f"\n**当前状态 (Vibe)**: {self.current_vibe.value} "
        ctx += f"(置信度: {self.vibe_confidence:.0%})\n"
        
        # 状态解释
        vibe_explanations = {
            UserVibe.EXPLORATORY: "用户正在探索，需要提供多个选项和建议",
            UserVibe.DEBUGGING: "用户遇到问题，需要诊断和修复帮助",
            UserVibe.PRODUCTION: "用户目标明确，需要高效简洁的执行",
            UserVibe.LEARNING: "用户想学习，需要详细解释和原理说明",
            UserVibe.UNCERTAIN: "用户意图不明确，需要主动询问澄清"
        }
        ctx += f"→ {vibe_explanations.get(self.current_vibe, '')}\n"
        
        # 当前意图
        if self.current_intent:
            ctx += f"\n**当前意图**: {self.current_intent.primary_intent.value}"
            if self.current_intent.target_object:
                ctx += f" - 目标: {self.current_intent.target_object}"
            if self.current_intent.ambiguity_level > 0.5:
                ctx += f"\n⚠️ 意图模糊度高 ({self.current_intent.ambiguity_level:.0%})"
                if self.current_intent.clarification_needed:
                    ctx += f"，需澄清: {', '.join(self.current_intent.clarification_needed)}"
            ctx += "\n"
        
        # 会话状态
        if self.consecutive_errors > 0:
            ctx += f"\n⚠️ 连续 {self.consecutive_errors} 次错误，用户可能需要帮助\n"
        
        # 意图连续性
        continuity = self.get_intent_continuity_score()
        if continuity > 0.7:
            ctx += "\n📌 用户有明确的持续目标，保持上下文连贯\n"
        
        return ctx


# ==================== Vibe 感知工具函数 ====================

def analyze_message_vibe(message: str) -> tuple[UserVibe, float, IntentType]:
    """
    分析用户消息，推断 Vibe 和意图
    返回: (vibe, confidence, intent_type)
    """
    message_lower = message.lower()
    
    # 调试模式指标
    debug_keywords = ["错误", "失败", "不工作", "报错", "exception", "error", "bug", "问题"]
    if any(kw in message_lower for kw in debug_keywords):
        return UserVibe.DEBUGGING, 0.85, IntentType.DEBUG
    
    # 学习模式指标
    learning_keywords = ["什么是", "为什么", "怎么", "如何", "解释", "原理", "介绍", "区别"]
    if any(kw in message_lower for kw in learning_keywords):
        return UserVibe.LEARNING, 0.8, IntentType.LEARN
    
    # 探索模式指标
    explore_keywords = ["有哪些", "推荐", "建议", "可以", "能不能", "试试", "看看"]
    if any(kw in message_lower for kw in explore_keywords):
        return UserVibe.EXPLORATORY, 0.75, IntentType.EXPLORE
    
    # 生产模式指标（明确的执行指令）
    execute_keywords = ["帮我", "调用", "运行", "执行", "生成", "创建", "下载"]
    if any(kw in message_lower for kw in execute_keywords):
        return UserVibe.PRODUCTION, 0.7, IntentType.EXECUTE
    
    # 查询模式
    query_keywords = ["查询", "搜索", "找", "获取", "列出"]
    if any(kw in message_lower for kw in query_keywords):
        return UserVibe.EXPLORATORY, 0.65, IntentType.QUERY
    
    return UserVibe.UNCERTAIN, 0.5, IntentType.QUERY


def detect_intent_ambiguity(message: str) -> tuple[float, List[str]]:
    """
    检测意图模糊度，返回 (模糊度分数, 需要澄清的点)
    """
    clarifications = []
    ambiguity = 0.0
    
    # 检查是否缺少具体对象
    vague_references = ["这个", "那个", "它", "数据", "模型", "文件"]
    if any(ref in message for ref in vague_references):
        has_specific = any(ext in message.lower() for ext in [".shp", ".tif", ".csv", "模型名"])
        if not has_specific:
            ambiguity += 0.3
            clarifications.append("具体操作对象是什么？")
    
    # 检查是否有多个可能的解释
    ambiguous_verbs = ["处理", "分析", "看看"]
    if any(verb in message for verb in ambiguous_verbs):
        ambiguity += 0.2
        clarifications.append("期望的具体操作是什么？")
    
    # 消息过短
    if len(message) < 10:
        ambiguity += 0.3
        clarifications.append("能否提供更多细节？")
    
    return min(ambiguity, 1.0), clarifications


# ==================== 持久化管理器 ====================

from pathlib import Path


class UserModelManager:
    """
    用户模型管理器 - 提供持久化和全局访问
    """
    
    def __init__(self, storage_dir: Optional[str] = None):
        if storage_dir:
            self.storage_dir = Path(storage_dir)
        else:
            self.storage_dir = Path(__file__).parent.parent.parent / "data" / "users"
        
        self.storage_dir.mkdir(parents=True, exist_ok=True)
        self._cache: Dict[str, UserModel] = {}
    
    def _get_user_path(self, user_id: str) -> Path:
        """获取用户数据文件路径"""
        return self.storage_dir / f"{user_id}.json"
    
    def _profile_to_dict(self, profile: StaticProfile) -> Dict:
        """StaticProfile 转 dict"""
        return {
            "user_id": profile.user_id,
            "user_name": profile.user_name,
            "expertise_level": profile.expertise_level.value,
            "domain_knowledge": profile.domain_knowledge,
            "preferred_language": profile.preferred_language,
            "code_style": profile.code_style,
            "explanation_level": profile.explanation_level,
            "total_sessions": profile.total_sessions,
            "total_interactions": profile.total_interactions,
            "successful_model_runs": profile.successful_model_runs,
            "favorite_models": profile.favorite_models,
            "recent_files": profile.recent_files
        }
    
    def _dict_to_profile(self, data: Dict) -> StaticProfile:
        """dict 转 StaticProfile"""
        return StaticProfile(
            user_id=data.get("user_id", "unknown"),
            user_name=data.get("user_name", "User"),
            expertise_level=ExpertiseLevel(data.get("expertise_level", "intermediate")),
            domain_knowledge=data.get("domain_knowledge", []),
            preferred_language=data.get("preferred_language", "zh-CN"),
            code_style=data.get("code_style", "detailed"),
            explanation_level=data.get("explanation_level", "moderate"),
            total_sessions=data.get("total_sessions", 0),
            total_interactions=data.get("total_interactions", 0),
            successful_model_runs=data.get("successful_model_runs", 0),
            favorite_models=data.get("favorite_models", []),
            recent_files=data.get("recent_files", [])
        )
    
    def get(self, user_id: str, user_name: str = "User") -> UserModel:
        """获取用户模型（不存在则创建）"""
        # 先查缓存
        if user_id in self._cache:
            return self._cache[user_id]
        
        # 从文件加载
        path = self._get_user_path(user_id)
        if path.exists():
            try:
                with open(path, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    profile = self._dict_to_profile(data.get("profile", {}))
                    user_model = UserModel(profile=profile)
                    user_model.current_vibe = UserVibe(data.get("current_vibe", "uncertain"))
                    user_model.vibe_confidence = data.get("vibe_confidence", 0.5)
                    user_model.consecutive_errors = data.get("consecutive_errors", 0)
                    self._cache[user_id] = user_model
                    return user_model
            except Exception as e:
                print(f"[UserModelManager] Error loading user {user_id}: {e}")
        
        # 创建新用户模型
        profile = StaticProfile(user_id=user_id, user_name=user_name)
        user_model = UserModel(profile=profile)
        self._cache[user_id] = user_model
        self.save(user_model)
        return user_model
    
    def save(self, user_model: UserModel):
        """保存用户模型"""
        user_id = user_model.profile.user_id
        path = self._get_user_path(user_id)
        
        data = {
            "profile": self._profile_to_dict(user_model.profile),
            "current_vibe": user_model.current_vibe.value,
            "vibe_confidence": user_model.vibe_confidence,
            "consecutive_errors": user_model.consecutive_errors,
            "last_successful_action": user_model.last_successful_action,
            "updated_at": datetime.now().isoformat()
        }
        
        with open(path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        
        self._cache[user_id] = user_model
    
    def update_interaction(self, user_id: str, event: InteractionEvent):
        """记录用户交互"""
        user_model = self.get(user_id)
        user_model.record_interaction(event)
        user_model.profile.total_interactions += 1
        self.save(user_model)
    
    def update_vibe(self, user_id: str, message: str) -> UserVibe:
        """更新用户 Vibe 状态"""
        user_model = self.get(user_id)
        
        # 分析消息
        vibe, confidence, intent_type = analyze_message_vibe(message)
        user_model.current_vibe = vibe
        user_model.vibe_confidence = confidence
        
        # 更新意图
        ambiguity, clarifications = detect_intent_ambiguity(message)
        intent = IntentVector(
            primary_intent=intent_type,
            confidence=confidence,
            ambiguity_level=ambiguity,
            clarification_needed=clarifications
        )
        user_model.update_intent(intent)
        
        # 结合历史推断
        inferred_vibe = user_model.infer_vibe()
        
        self.save(user_model)
        return inferred_vibe
    
    def get_vibe_suggestions(self, user_model: UserModel) -> List[str]:
        """根据 Vibe 状态获取 Agent 行为建议"""
        vibe = user_model.current_vibe
        
        if vibe == UserVibe.EXPLORATORY:
            return [
                "提供多个可选方案而非直接执行",
                "主动介绍相关功能和概念",
                "询问用户偏好以缩小范围"
            ]
        elif vibe == UserVibe.DEBUGGING:
            return [
                "重点关注错误信息的分析",
                "提供详细的排查步骤",
                "主动检查常见问题（路径、格式、权限等）",
                "保持耐心，用户可能感到沮丧"
            ]
        elif vibe == UserVibe.PRODUCTION:
            return [
                "快速执行，减少确认步骤",
                "自动处理常规问题",
                "提供批量操作选项",
                "简洁回复，避免冗长解释"
            ]
        elif vibe == UserVibe.LEARNING:
            return [
                "提供详细解释和原理说明",
                "给出示例代码并解释每一步",
                "推荐相关学习资源",
                "耐心回答追问"
            ]
        else:  # UNCERTAIN
            return [
                "通过提问澄清用户意图",
                "提供几个可能的方向",
                "耐心引导用户表达需求"
            ]
    
    def infer_expertise(self, user_id: str) -> ExpertiseLevel:
        """基于交互历史推断用户专业水平"""
        user_model = self.get(user_id)
        stats = user_model.profile
        
        score = 0.0
        
        # 会话数量
        if stats.total_sessions > 50:
            score += 0.3
        elif stats.total_sessions > 20:
            score += 0.2
        elif stats.total_sessions > 5:
            score += 0.1
        
        # 成功率
        if stats.total_interactions > 0:
            success_rate = stats.successful_model_runs / max(stats.total_interactions, 1)
            if success_rate > 0.8:
                score += 0.3
            elif success_rate > 0.5:
                score += 0.2
        
        # 领域知识
        if len(stats.domain_knowledge) > 3:
            score += 0.2
        elif len(stats.domain_knowledge) > 1:
            score += 0.1
        
        # 判断等级
        if score >= 0.6:
            level = ExpertiseLevel.EXPERT
        elif score >= 0.3:
            level = ExpertiseLevel.INTERMEDIATE
        else:
            level = ExpertiseLevel.NOVICE
        
        # 更新
        if level != stats.expertise_level:
            stats.expertise_level = level
            self.save(user_model)
        
        return level
    
    def delete(self, user_id: str) -> bool:
        """删除用户数据"""
        path = self._get_user_path(user_id)
        if path.exists():
            path.unlink()
        if user_id in self._cache:
            del self._cache[user_id]
        return True
    
    def list_users(self) -> List[str]:
        """列出所有用户"""
        return [p.stem for p in self.storage_dir.glob("*.json")]


# 全局实例
_user_model_manager: Optional[UserModelManager] = None


def get_user_model_manager() -> UserModelManager:
    """获取全局用户模型管理器"""
    global _user_model_manager
    if _user_model_manager is None:
        _user_model_manager = UserModelManager()
    return _user_model_manager
