"""
Tri-Space Context Fusion
三维上下文融合器

核心概念：
上下文并非静态的信息孤岛，而是由"用户意图"、"平台能力"和"Agent认知"
三者在交互中动态生成的产物。

本模块负责：
1. 融合三维上下文
2. 生成用于 LLM 的动态 System Prompt
3. 协调两个核心循环的上下文传递
"""

from typing import Dict, Any, Optional, List
from dataclasses import dataclass, field
from datetime import datetime

from .platform_model import PlatformModel, DataNode, DataType
from .user_model import UserModel, UserVibe, IntentVector, analyze_message_vibe, detect_intent_ambiguity
from .agent_model import AgentModel, AttentionFocus


@dataclass
class FusedContext:
    """
    融合后的三维上下文
    """
    # 三维模型引用
    platform: PlatformModel
    user: UserModel
    agent: AgentModel
    
    # 融合元信息
    fusion_timestamp: datetime = field(default_factory=datetime.now)
    fusion_quality: float = 1.0         # 融合质量评分
    
    # 上下文摘要
    platform_summary: str = ""
    user_summary: str = ""
    agent_summary: str = ""
    
    # 行动建议
    suggested_actions: List[str] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)


class ContextFusionEngine:
    """
    上下文融合引擎
    """
    
    def __init__(self, platform: PlatformModel, user: UserModel, agent: AgentModel):
        self.platform = platform
        self.user = user
        self.agent = agent
    
    def fuse(self, current_message: Optional[str] = None) -> FusedContext:
        """
        执行三维上下文融合
        """
        # 1. 如果有新消息，更新用户模型
        if current_message:
            self._update_user_state(current_message)
        
        # 2. 基于用户状态更新 Agent 注意力
        self._update_agent_attention()
        
        # 3. 创建融合上下文
        fused = FusedContext(
            platform=self.platform,
            user=self.user,
            agent=self.agent
        )
        
        # 4. 生成摘要
        fused.platform_summary = self._generate_platform_summary()
        fused.user_summary = self._generate_user_summary()
        fused.agent_summary = self._generate_agent_summary()
        
        # 5. 生成建议和警告
        fused.suggested_actions = self._generate_suggestions()
        fused.warnings = self._generate_warnings()
        
        return fused
    
    def _update_user_state(self, message: str):
        """基于消息更新用户状态"""
        # 分析消息 Vibe
        vibe, confidence, intent_type = analyze_message_vibe(message)
        self.user.current_vibe = vibe
        self.user.vibe_confidence = confidence
        
        # 检测意图模糊度
        ambiguity, clarifications = detect_intent_ambiguity(message)
        
        # 更新意图向量
        intent = IntentVector(
            primary_intent=intent_type,
            confidence=confidence,
            ambiguity_level=ambiguity,
            clarification_needed=clarifications
        )
        self.user.update_intent(intent)
        
        # 推断 Vibe（结合历史）
        self.user.infer_vibe()
    
    def _update_agent_attention(self):
        """基于用户状态更新 Agent 注意力"""
        has_error = self.user.consecutive_errors > 0
        task_in_progress = self.agent.cognitive_state.current_plan is not None
        
        self.agent.update_attention_for_context(
            user_vibe=self.user.current_vibe.value,
            has_error=has_error,
            task_in_progress=task_in_progress
        )
    
    def _generate_platform_summary(self) -> str:
        """生成平台上下文摘要"""
        summary = []
        
        # 可用数据
        data_count = len(self.platform.data_topology)
        if data_count > 0:
            summary.append(f"工作目录有 {data_count} 个数据文件可用")
            
            # 按类型统计
            type_counts = {}
            for node in self.platform.data_topology.values():
                type_counts[node.data_type.value] = type_counts.get(node.data_type.value, 0) + 1
            summary.append(f"数据类型: {type_counts}")
        else:
            summary.append("⚠️ 工作目录为空，需要用户上传数据")
        
        # 可用服务
        service_count = len(self.platform.services)
        summary.append(f"有 {service_count} 个服务能力可用")
        
        return "; ".join(summary)
    
    def _generate_user_summary(self) -> str:
        """生成用户上下文摘要"""
        summary = []
        
        # Vibe 状态
        vibe_desc = {
            UserVibe.EXPLORATORY: "正在探索",
            UserVibe.DEBUGGING: "正在调试",
            UserVibe.PRODUCTION: "目标明确",
            UserVibe.LEARNING: "想要学习",
            UserVibe.UNCERTAIN: "意图不明确"
        }
        summary.append(f"用户状态: {vibe_desc.get(self.user.current_vibe, '未知')}")
        
        # 意图
        if self.user.current_intent:
            summary.append(f"意图: {self.user.current_intent.primary_intent.value}")
            if self.user.current_intent.ambiguity_level > 0.5:
                summary.append("⚠️ 意图模糊，可能需要澄清")
        
        # 错误状态
        if self.user.consecutive_errors > 0:
            summary.append(f"连续 {self.user.consecutive_errors} 次错误")
        
        return "; ".join(summary)
    
    def _generate_agent_summary(self) -> str:
        """生成 Agent 状态摘要"""
        summary = []
        
        # 主要关注点
        focus = self.agent.cognitive_state.get_primary_focus()
        if focus:
            focus_desc = {
                AttentionFocus.USER_INTENT: "理解用户意图",
                AttentionFocus.USER_EMOTION: "关注用户情绪",
                AttentionFocus.PLATFORM_STATE: "检查平台状态",
                AttentionFocus.PLATFORM_ERROR: "处理错误",
                AttentionFocus.TASK_PROGRESS: "执行任务"
            }
            summary.append(f"关注: {focus_desc.get(focus, focus.value)}")
        
        # 当前计划
        if self.agent.cognitive_state.current_plan:
            plan = self.agent.cognitive_state.current_plan
            summary.append(f"执行计划: {plan.goal} ({plan.status})")
        
        return "; ".join(summary)
    
    def _generate_suggestions(self) -> List[str]:
        """基于融合上下文生成行动建议"""
        suggestions = []
        
        vibe = self.user.current_vibe
        
        if vibe == UserVibe.EXPLORATORY:
            suggestions.append("提供多个选项供用户选择")
            suggestions.append("主动介绍相关能力")
        
        elif vibe == UserVibe.DEBUGGING:
            suggestions.append("先诊断问题根因")
            suggestions.append("提供修复建议")
            suggestions.append("解释错误原因")
        
        elif vibe == UserVibe.PRODUCTION:
            suggestions.append("简洁高效执行")
            suggestions.append("减少不必要的解释")
        
        elif vibe == UserVibe.LEARNING:
            suggestions.append("详细解释概念和原理")
            suggestions.append("提供学习资源")
        
        elif vibe == UserVibe.UNCERTAIN:
            suggestions.append("主动询问澄清意图")
            suggestions.append("提供常见用例参考")
        
        return suggestions
    
    def _generate_warnings(self) -> List[str]:
        """生成警告信息"""
        warnings = []
        
        # 用户意图模糊
        if self.user.current_intent and self.user.current_intent.ambiguity_level > 0.6:
            warnings.append("用户意图模糊，建议先确认理解")
        
        # 连续错误
        if self.user.consecutive_errors >= 2:
            warnings.append("用户遇到连续错误，可能需要额外帮助")
        
        # 数据为空
        if len(self.platform.data_topology) == 0:
            warnings.append("工作目录无数据文件")
        
        return warnings
    
    def generate_system_prompt(self, base_prompt: str = "") -> str:
        """
        生成融合后的 System Prompt
        这是三维上下文融合的最终输出
        """
        fused = self.fuse()
        
        prompt_parts = []
        
        # 基础 Prompt
        if base_prompt:
            prompt_parts.append(base_prompt)
        
        prompt_parts.append("\n\n" + "="*50)
        prompt_parts.append("## 🧠 三维上下文融合 (Tri-Space Context)")
        prompt_parts.append("="*50)
        
        # 用户维度
        prompt_parts.append("\n### 👤 用户维度 (User Modeling)")
        prompt_parts.append(self.user.to_context_string())
        
        # 平台维度
        prompt_parts.append("\n### 🖥️ 平台维度 (Platform Modeling)")
        prompt_parts.append(self.platform.to_context_string())
        
        # Agent 维度
        prompt_parts.append("\n### 🤖 Agent 认知状态")
        prompt_parts.append(self.agent.to_context_string())
        
        # 行动指导
        prompt_parts.append("\n### 🎯 行动指导")
        
        if fused.warnings:
            prompt_parts.append("\n**⚠️ 警告:**")
            for w in fused.warnings:
                prompt_parts.append(f"- {w}")
        
        if fused.suggested_actions:
            prompt_parts.append("\n**💡 建议策略:**")
            for s in fused.suggested_actions:
                prompt_parts.append(f"- {s}")
        
        # Vibe 特定指令
        vibe_instructions = self._get_vibe_specific_instructions()
        if vibe_instructions:
            prompt_parts.append(f"\n**📌 当前模式指令:**\n{vibe_instructions}")
        
        return "\n".join(prompt_parts)
    
    def _get_vibe_specific_instructions(self) -> str:
        """获取基于 Vibe 的特定指令"""
        vibe = self.user.current_vibe
        
        instructions = {
            UserVibe.EXPLORATORY: """
用户处于**探索模式**：
1. 不要直接执行，先展示选项
2. 使用 search_models 或 search_data_methods 展示可能性
3. 询问用户偏好
4. 提供 2-3 个建议方向""",
            
            UserVibe.DEBUGGING: """
用户处于**调试模式**：
1. 先分析错误原因
2. 检查数据文件是否存在、格式是否正确
3. 提供具体的修复代码
4. 解释为什么会出错""",
            
            UserVibe.PRODUCTION: """
用户处于**生产模式**：
1. 直接执行，减少询问
2. 使用 add_code_cell 快速插入代码
3. 简洁回复，专注结果
4. 只在关键决策点才确认""",
            
            UserVibe.LEARNING: """
用户处于**学习模式**：
1. 详细解释每个步骤的原理
2. 使用 add_markdown_cell 添加说明
3. 提供背景知识
4. 推荐学习资源""",
            
            UserVibe.UNCERTAIN: """
用户意图**不明确**：
1. 先询问澄清："您是想要...还是...?"
2. 提供常见用例参考
3. 不要假设，不要直接执行
4. 等待用户确认后再行动"""
        }
        
        return instructions.get(vibe, "")


# ==================== 便捷函数 ====================

def create_fusion_engine(workspace_files: Dict = None, 
                        user_id: str = "default",
                        user_name: str = "User") -> ContextFusionEngine:
    """
    创建上下文融合引擎的便捷函数
    """
    from .platform_model import create_default_platform_model, DataNode, DataType
    from .user_model import StaticProfile, ExpertiseLevel
    from .agent_model import create_default_agent_model
    
    # 创建平台模型
    platform = create_default_platform_model()
    
    # 如果有工作目录文件，添加到平台模型
    if workspace_files:
        _populate_platform_data(platform, workspace_files)
    
    # 创建用户模型
    profile = StaticProfile(
        user_id=user_id,
        user_name=user_name,
        expertise_level=ExpertiseLevel.INTERMEDIATE
    )
    user = UserModel(profile=profile)
    
    # 创建 Agent 模型
    agent = create_default_agent_model()
    
    return ContextFusionEngine(platform, user, agent)


def _populate_platform_data(platform: PlatformModel, workspace_files: Dict):
    """将工作目录文件填充到平台模型"""
    type_mapping = {
        "vector": DataType.VECTOR,
        "raster": DataType.RASTER,
        "table": DataType.TABLE,
        "other": DataType.OTHER
    }
    
    for file_type, files in workspace_files.items():
        if file_type in type_mapping and isinstance(files, list):
            for f in files:
                node = DataNode(
                    id=f.get("path", f.get("name", "")),
                    name=f.get("name", ""),
                    path=f.get("path", ""),
                    data_type=type_mapping[file_type],
                    size_bytes=f.get("size", 0)
                )
                platform.add_data_node(node)
