"""
Agent Modeling: "The Cognitive Bridge"
Agent建模：定义 "如何连接用户意图与平台能力"

核心概念：
- Skill Tree: 层次化技能树
- Planning Capability: 任务分解与规划能力
- Dynamic Attention: 动态注意力分配

参考：
- Xiong et al. (2023): AutoAgent 的 Reasoning 机制
- McNutt et al. (2023): Agent 的 Disambiguation (消歧) 能力
"""

from typing import Dict, List, Optional, Any, Callable
from dataclasses import dataclass, field
from enum import Enum
from datetime import datetime


class SkillCategory(Enum):
    """技能分类"""
    NOTEBOOK_OPS = "notebook_ops"       # Notebook 操作
    MODEL_INVOKE = "model_invoke"       # 模型调用
    DATA_PROCESS = "data_process"       # 数据处理
    SEARCH = "search"                   # 搜索查询
    EXPLAIN = "explain"                 # 解释说明
    DIAGNOSE = "diagnose"               # 诊断问题


class AttentionFocus(Enum):
    """注意力焦点"""
    USER_INTENT = "user_intent"         # 关注用户意图
    USER_EMOTION = "user_emotion"       # 关注用户情绪
    PLATFORM_STATE = "platform_state"   # 关注平台状态
    PLATFORM_ERROR = "platform_error"   # 关注平台错误
    TASK_PROGRESS = "task_progress"     # 关注任务进度
    DATA_QUALITY = "data_quality"       # 关注数据质量


@dataclass
class Skill:
    """
    技能定义
    """
    name: str                           # 技能名称
    description: str                    # 技能描述
    category: SkillCategory             # 技能分类
    
    # 技能能力
    tool_name: Optional[str] = None     # 对应的工具名称
    required_context: List[str] = field(default_factory=list)  # 需要的上下文
    
    # 前置条件
    preconditions: List[str] = field(default_factory=list)
    
    # 子技能
    sub_skills: List[str] = field(default_factory=list)
    
    # 使用统计
    usage_count: int = 0
    success_rate: float = 1.0
    avg_duration_ms: int = 0


@dataclass
class PlanStep:
    """
    规划步骤
    """
    step_id: int
    skill_name: str                     # 使用的技能
    description: str                    # 步骤描述
    
    # 输入输出
    inputs: Dict[str, Any] = field(default_factory=dict)
    expected_outputs: List[str] = field(default_factory=list)
    
    # 依赖
    depends_on: List[int] = field(default_factory=list)  # 依赖的步骤 ID
    
    # 执行状态
    status: str = "pending"             # pending, running, completed, failed
    actual_output: Optional[Any] = None
    error_message: Optional[str] = None


@dataclass
class ExecutionPlan:
    """
    执行计划
    """
    plan_id: str
    goal: str                           # 目标描述
    created_at: datetime = field(default_factory=datetime.now)
    
    # 步骤
    steps: List[PlanStep] = field(default_factory=list)
    
    # 状态
    current_step: int = 0
    status: str = "created"             # created, executing, completed, failed
    
    # 元信息
    estimated_duration_seconds: int = 0
    requires_user_confirmation: bool = False
    
    def get_next_step(self) -> Optional[PlanStep]:
        """获取下一个待执行的步骤"""
        for step in self.steps:
            if step.status == "pending":
                # 检查依赖是否满足
                deps_satisfied = all(
                    self.steps[dep_id].status == "completed"
                    for dep_id in step.depends_on
                )
                if deps_satisfied:
                    return step
        return None
    
    def to_markdown(self) -> str:
        """生成计划的 Markdown 描述"""
        md = f"## 执行计划: {self.goal}\n\n"
        
        for step in self.steps:
            status_icon = {
                "pending": "⬜",
                "running": "🔄",
                "completed": "✅",
                "failed": "❌"
            }.get(step.status, "⬜")
            
            md += f"{status_icon} **步骤 {step.step_id + 1}**: {step.description}\n"
            if step.depends_on:
                md += f"   └─ 依赖: 步骤 {', '.join(str(d + 1) for d in step.depends_on)}\n"
        
        return md


@dataclass
class AttentionWeight:
    """
    注意力权重
    """
    focus: AttentionFocus
    weight: float                       # 0-1
    reason: str                         # 权重原因


@dataclass
class AgentCognitiveState:
    """
    Agent 认知状态 - Agent 当前的"思考"状态
    """
    # 注意力分配
    attention_weights: Dict[AttentionFocus, AttentionWeight] = field(default_factory=dict)
    
    # 当前规划
    current_plan: Optional[ExecutionPlan] = None
    
    # 不确定性处理
    pending_clarifications: List[str] = field(default_factory=list)
    disambiguation_attempts: int = 0
    
    # 上下文记忆
    working_memory: Dict[str, Any] = field(default_factory=dict)  # 短期工作记忆
    
    def set_attention(self, focus: AttentionFocus, weight: float, reason: str):
        """设置注意力权重"""
        self.attention_weights[focus] = AttentionWeight(focus, weight, reason)
    
    def get_primary_focus(self) -> Optional[AttentionFocus]:
        """获取主要关注点"""
        if not self.attention_weights:
            return None
        return max(self.attention_weights.values(), key=lambda x: x.weight).focus


@dataclass
class AgentModel:
    """
    Agent 模型 - 完整的 Agent 能力描述
    """
    # 技能树
    skill_tree: Dict[str, Skill] = field(default_factory=dict)
    
    # 认知状态
    cognitive_state: AgentCognitiveState = field(default_factory=AgentCognitiveState)
    
    # 规划历史
    plan_history: List[ExecutionPlan] = field(default_factory=list)
    
    def register_skill(self, skill: Skill):
        """注册技能"""
        self.skill_tree[skill.name] = skill
    
    def get_skills_by_category(self, category: SkillCategory) -> List[Skill]:
        """按分类获取技能"""
        return [s for s in self.skill_tree.values() if s.category == category]
    
    def create_plan(self, goal: str, steps: List[Dict[str, Any]]) -> ExecutionPlan:
        """创建执行计划"""
        plan = ExecutionPlan(
            plan_id=f"plan_{datetime.now().timestamp()}",
            goal=goal,
            steps=[
                PlanStep(
                    step_id=i,
                    skill_name=s.get("skill", ""),
                    description=s.get("description", ""),
                    inputs=s.get("inputs", {}),
                    depends_on=s.get("depends_on", [])
                )
                for i, s in enumerate(steps)
            ]
        )
        self.cognitive_state.current_plan = plan
        return plan
    
    def update_attention_for_context(self, user_vibe: str, has_error: bool, 
                                     task_in_progress: bool):
        """
        基于上下文动态调整注意力
        这是 Dynamic Attention 的核心逻辑
        """
        self.cognitive_state.attention_weights.clear()
        
        # 基础注意力分配
        if has_error:
            # 有错误时，优先关注错误和用户情绪
            self.cognitive_state.set_attention(
                AttentionFocus.PLATFORM_ERROR, 0.4, "检测到执行错误"
            )
            self.cognitive_state.set_attention(
                AttentionFocus.USER_EMOTION, 0.3, "用户可能感到沮丧"
            )
            self.cognitive_state.set_attention(
                AttentionFocus.USER_INTENT, 0.2, "理解用户原始目标"
            )
        elif user_vibe == "debugging":
            # 调试模式
            self.cognitive_state.set_attention(
                AttentionFocus.PLATFORM_ERROR, 0.35, "用户正在调试"
            )
            self.cognitive_state.set_attention(
                AttentionFocus.PLATFORM_STATE, 0.35, "检查平台状态"
            )
            self.cognitive_state.set_attention(
                AttentionFocus.USER_INTENT, 0.2, "理解调试目标"
            )
        elif user_vibe == "exploratory":
            # 探索模式
            self.cognitive_state.set_attention(
                AttentionFocus.USER_INTENT, 0.4, "理解探索方向"
            )
            self.cognitive_state.set_attention(
                AttentionFocus.PLATFORM_STATE, 0.3, "展示可用能力"
            )
        elif user_vibe == "production":
            # 生产模式
            self.cognitive_state.set_attention(
                AttentionFocus.TASK_PROGRESS, 0.4, "高效执行任务"
            )
            self.cognitive_state.set_attention(
                AttentionFocus.USER_INTENT, 0.3, "确保执行正确"
            )
        else:
            # 默认：平衡关注
            self.cognitive_state.set_attention(
                AttentionFocus.USER_INTENT, 0.4, "理解用户需求"
            )
            self.cognitive_state.set_attention(
                AttentionFocus.PLATFORM_STATE, 0.3, "了解当前状态"
            )
    
    def should_ask_clarification(self, ambiguity_level: float, 
                                 vibe: str) -> bool:
        """
        决定是否应该询问澄清
        基于 McNutt et al. (2023) 的 Disambiguation 策略
        """
        # 生产模式下，高阈值（避免打断）
        if vibe == "production":
            return ambiguity_level > 0.7
        
        # 调试模式下，中等阈值
        if vibe == "debugging":
            return ambiguity_level > 0.5
        
        # 探索/学习模式下，低阈值（鼓励对话）
        if vibe in ["exploratory", "learning"]:
            return ambiguity_level > 0.4
        
        # 默认中等阈值
        return ambiguity_level > 0.5
    
    def to_context_string(self) -> str:
        """生成用于调试的上下文描述"""
        ctx = "## Agent 状态\n\n"
        
        # 注意力分配
        ctx += "### 注意力分配\n"
        for focus, weight in self.cognitive_state.attention_weights.items():
            bar = "█" * int(weight.weight * 10) + "░" * (10 - int(weight.weight * 10))
            ctx += f"- {focus.value}: [{bar}] {weight.weight:.0%} - {weight.reason}\n"
        
        # 当前计划
        if self.cognitive_state.current_plan:
            ctx += f"\n### 当前计划\n"
            ctx += self.cognitive_state.current_plan.to_markdown()
        
        # 待澄清项
        if self.cognitive_state.pending_clarifications:
            ctx += f"\n### 待澄清\n"
            for c in self.cognitive_state.pending_clarifications:
                ctx += f"- {c}\n"
        
        return ctx


# ==================== 默认技能树 ====================

def create_default_agent_model() -> AgentModel:
    """创建默认的 Agent 模型，注册所有技能"""
    agent = AgentModel()
    
    # 注册 Notebook 操作技能
    agent.register_skill(Skill(
        name="insert_code",
        description="向 Notebook 插入并运行代码",
        category=SkillCategory.NOTEBOOK_OPS,
        tool_name="add_code_cell",
        required_context=["notebook_active"]
    ))
    
    agent.register_skill(Skill(
        name="insert_explanation",
        description="向 Notebook 插入 Markdown 解释",
        category=SkillCategory.NOTEBOOK_OPS,
        tool_name="add_markdown_cell",
        required_context=["notebook_active"]
    ))
    
    # 注册搜索技能
    agent.register_skill(Skill(
        name="search_models",
        description="搜索 OpenGMS 地理计算模型",
        category=SkillCategory.SEARCH,
        tool_name="search_models"
    ))
    
    agent.register_skill(Skill(
        name="get_model_details",
        description="获取模型的详细参数信息",
        category=SkillCategory.SEARCH,
        tool_name="get_model_info",
        preconditions=["model_name_known"]
    ))
    
    # 注册模型调用技能
    agent.register_skill(Skill(
        name="invoke_ogms_model",
        description="调用 OpenGMS 模型执行分析",
        category=SkillCategory.MODEL_INVOKE,
        tool_name="add_code_cell",  # 通过生成代码实现
        preconditions=["model_info_known", "data_files_available"],
        sub_skills=["get_model_details", "match_data_to_params", "generate_code"]
    ))
    
    # 注册解释技能
    agent.register_skill(Skill(
        name="explain_concept",
        description="解释 GIS/地理建模概念",
        category=SkillCategory.EXPLAIN,
        tool_name="add_markdown_cell"
    ))
    
    agent.register_skill(Skill(
        name="explain_error",
        description="解释错误原因并提供修复建议",
        category=SkillCategory.DIAGNOSE,
        required_context=["error_message"]
    ))
    
    return agent
