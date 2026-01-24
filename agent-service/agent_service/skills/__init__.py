"""
Skills 模块
真正可执行的 Agent 技能系统

这是一个完整的技能系统，包含：
- Skill: 抽象基类，定义技能接口（带 execute() 方法）
- SkillRegistry: 技能注册表，管理所有技能
- SkillRouter: 技能路由器，根据意图选择技能
- 具体技能实现：Notebook、模型搜索、模型调用、错误诊断、数据操作
"""

from .base import (
    Skill,
    SkillResult,
    SkillContext,
    SkillStatus,
    ParamSpec,
    ParamType
)

from .registry import (
    SkillRegistry,
    get_skill_registry,
    register_skill,
    skill_decorator
)

from .router import (
    SkillRouter,
    RoutingDecision,
    RoutingStrategy,
    create_router
)

# 导入所有具体技能
from .implementations import (
    # Notebook
    InsertCodeSkill,
    InsertMarkdownSkill,
    ExecuteCellSkill,
    ClearOutputSkill,
    
    # Search
    SearchModelsSkill,
    GetModelInfoSkill,
    ListAvailableModelsSkill,
    
    # Model
    InvokeModelSkill,
    CheckTaskStatusSkill,
    DownloadResultSkill,
    
    # Diagnostic
    DiagnoseErrorSkill,
    SuggestImportsSkill,
    ExplainCodeSkill,
    
    # Data
    ListFilesSkill,
    ReadDataSkill,
    DataPreviewSkill,
    SaveDataSkill,
    
    # All skill classes
    ALL_SKILL_CLASSES
)


def register_all_skills():
    """注册所有内置技能"""
    registry = get_skill_registry()
    for skill_class in ALL_SKILL_CLASSES:
        registry.register_class(skill_class)
    return registry


__all__ = [
    # Base
    "Skill",
    "SkillResult",
    "SkillContext",
    "SkillStatus",
    "ParamSpec",
    "ParamType",
    
    # Registry
    "SkillRegistry",
    "get_skill_registry",
    "register_skill",
    "skill_decorator",
    "register_all_skills",
    
    # Router
    "SkillRouter",
    "RoutingDecision",
    "RoutingStrategy",
    "create_router",
    
    # Notebook Skills
    "InsertCodeSkill",
    "InsertMarkdownSkill",
    "ExecuteCellSkill",
    "ClearOutputSkill",
    
    # Search Skills
    "SearchModelsSkill",
    "GetModelInfoSkill",
    "ListAvailableModelsSkill",
    
    # Model Skills
    "InvokeModelSkill",
    "CheckTaskStatusSkill",
    "DownloadResultSkill",
    
    # Diagnostic Skills
    "DiagnoseErrorSkill",
    "SuggestImportsSkill",
    "ExplainCodeSkill",
    
    # Data Skills
    "ListFilesSkill",
    "ReadDataSkill",
    "DataPreviewSkill",
    "SaveDataSkill",
    
    # Utilities
    "ALL_SKILL_CLASSES"
]
