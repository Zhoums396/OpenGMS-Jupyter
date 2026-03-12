"""
Modeling 模块
三维上下文建模：平台建模、用户建模、Agent建模
"""

from .platform_model import (
    PlatformModel,
    ServiceAffordance,
    DataNode,
    DataType,
    CoordinateSystem,
    PlatformConstraint,
    create_default_platform_model
)

from .user_model import (
    UserModel,
    StaticProfile,
    UserVibe,
    ExpertiseLevel,
    IntentType,
    IntentVector,
    InteractionEvent,
    analyze_message_vibe,
    detect_intent_ambiguity,
    UserModelManager,
    get_user_model_manager
)

from .agent_model import (
    AgentModel,
    Skill,
    SkillCategory,
    PlanStep,
    ExecutionPlan,
    AttentionFocus,
    AgentCognitiveState,
    create_default_agent_model
)

from .context_fusion import (
    ContextFusionEngine,
    FusedContext,
    create_fusion_engine
)

__all__ = [
    # Platform
    "PlatformModel",
    "ServiceAffordance",
    "DataNode",
    "DataType",
    "CoordinateSystem",
    "PlatformConstraint",
    "create_default_platform_model",
    
    # User
    "UserModel",
    "StaticProfile",
    "UserVibe",
    "ExpertiseLevel",
    "IntentType",
    "IntentVector",
    "InteractionEvent",
    "analyze_message_vibe",
    "detect_intent_ambiguity",
    "UserModelManager",
    "get_user_model_manager",
    
    # Agent
    "AgentModel",
    "Skill",
    "SkillCategory",
    "PlanStep",
    "ExecutionPlan",
    "AttentionFocus",
    "AgentCognitiveState",
    "create_default_agent_model",
    
    # Fusion
    "ContextFusionEngine",
    "FusedContext",
    "create_fusion_engine"
]
