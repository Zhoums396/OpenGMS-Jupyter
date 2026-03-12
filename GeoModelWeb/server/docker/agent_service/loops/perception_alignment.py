"""
Perception-Alignment Loop (感知-对齐循环)
连接：User ↔ Agent

核心功能：
1. Vibe Sensing (感应)：读取用户操作频率、历史行为，判断用户状态
2. Intent Alignment (对齐)：基于用户状态调整响应策略

参考：
- Gu et al. (2024): 不同水平用户需要不同层级的帮助
- 处理用户意图的不确定性
"""

from typing import Dict, Any, Optional, List, Tuple
from dataclasses import dataclass
from enum import Enum

from ..modeling.user_model import (
    UserModel, UserVibe, IntentVector, IntentType,
    InteractionEvent, analyze_message_vibe, detect_intent_ambiguity
)
from ..modeling.agent_model import AgentModel


class AlignmentAction(Enum):
    """对齐动作类型"""
    PROCEED = "proceed"                 # 直接执行
    CLARIFY = "clarify"                 # 需要澄清
    SUGGEST = "suggest"                 # 提供建议
    EXPLAIN = "explain"                 # 需要解释
    CONFIRM = "confirm"                 # 需要确认


@dataclass
class AlignmentResult:
    """对齐结果"""
    action: AlignmentAction
    confidence: float
    
    # 如果需要澄清
    clarification_questions: List[str] = None
    
    # 如果提供建议
    suggestions: List[str] = None
    
    # 原始意图分析
    detected_vibe: UserVibe = None
    detected_intent: IntentType = None
    ambiguity_level: float = 0.0
    
    # 响应策略
    response_style: str = "balanced"    # concise / balanced / verbose


class PerceptionAlignmentLoop:
    """
    感知-对齐循环
    
    工作流程：
    1. 感知用户消息 → 分析 Vibe 和意图
    2. 检测不确定性 → 判断是否需要澄清
    3. 对齐响应策略 → 决定如何响应
    """
    
    def __init__(self, user_model: UserModel, agent_model: AgentModel):
        self.user = user_model
        self.agent = agent_model
        
        # 对齐阈值配置
        self.clarification_threshold = 0.5      # 模糊度超过此值需要澄清
        self.suggestion_threshold = 0.3         # 模糊度超过此值提供建议
    
    def perceive(self, message: str) -> Tuple[UserVibe, IntentVector]:
        """
        感知阶段：分析用户消息
        
        Returns:
            (detected_vibe, intent_vector)
        """
        # 1. 分析消息的 Vibe 和意图
        vibe, vibe_confidence, intent_type = analyze_message_vibe(message)
        
        # 2. 检测意图模糊度
        ambiguity, clarifications = detect_intent_ambiguity(message)
        
        # 3. 构建意图向量
        intent = IntentVector(
            primary_intent=intent_type,
            confidence=vibe_confidence,
            ambiguity_level=ambiguity,
            clarification_needed=clarifications
        )
        
        # 4. 更新用户模型
        self.user.current_vibe = vibe
        self.user.vibe_confidence = vibe_confidence
        self.user.update_intent(intent)
        
        # 5. 结合历史推断更准确的 Vibe
        inferred_vibe = self.user.infer_vibe()
        
        return inferred_vibe, intent
    
    def align(self, vibe: UserVibe, intent: IntentVector) -> AlignmentResult:
        """
        对齐阶段：决定响应策略
        
        基于 Vibe 和意图的模糊度，决定：
        - 是否直接执行
        - 是否需要澄清
        - 是否提供建议
        - 响应的详细程度
        """
        result = AlignmentResult(
            action=AlignmentAction.PROCEED,
            confidence=intent.confidence,
            detected_vibe=vibe,
            detected_intent=intent.primary_intent,
            ambiguity_level=intent.ambiguity_level
        )
        
        # 根据 Vibe 调整策略
        if vibe == UserVibe.UNCERTAIN:
            # 意图不明确：优先澄清
            result.action = AlignmentAction.CLARIFY
            result.clarification_questions = intent.clarification_needed or [
                "您能具体说明一下想要做什么吗？",
                "您是想查询信息，还是执行某个操作？"
            ]
            result.response_style = "verbose"
        
        elif vibe == UserVibe.EXPLORATORY:
            # 探索模式：提供建议选项
            if intent.ambiguity_level > self.suggestion_threshold:
                result.action = AlignmentAction.SUGGEST
                result.suggestions = self._generate_exploration_suggestions(intent)
            else:
                result.action = AlignmentAction.PROCEED
            result.response_style = "balanced"
        
        elif vibe == UserVibe.DEBUGGING:
            # 调试模式：需要详细解释
            result.action = AlignmentAction.EXPLAIN
            result.response_style = "verbose"
        
        elif vibe == UserVibe.PRODUCTION:
            # 生产模式：快速执行
            if intent.ambiguity_level > self.clarification_threshold:
                # 模糊度太高还是要确认
                result.action = AlignmentAction.CONFIRM
                result.clarification_questions = intent.clarification_needed
            else:
                result.action = AlignmentAction.PROCEED
            result.response_style = "concise"
        
        elif vibe == UserVibe.LEARNING:
            # 学习模式：详细解释
            result.action = AlignmentAction.EXPLAIN
            result.response_style = "verbose"
        
        # 检查是否需要强制澄清（高模糊度）
        if intent.ambiguity_level > 0.7 and result.action == AlignmentAction.PROCEED:
            result.action = AlignmentAction.CLARIFY
            result.clarification_questions = intent.clarification_needed
        
        return result
    
    def _generate_exploration_suggestions(self, intent: IntentVector) -> List[str]:
        """生成探索性建议"""
        suggestions = []
        
        if intent.primary_intent == IntentType.QUERY:
            suggestions = [
                "搜索相关的地理计算模型",
                "浏览可用的数据处理方法",
                "查看工作目录中的数据文件"
            ]
        elif intent.primary_intent == IntentType.ANALYZE:
            suggestions = [
                "使用 Buffer 缓冲区分析",
                "使用 Intersect 叠加分析",
                "使用模型进行预测分析"
            ]
        elif intent.primary_intent == IntentType.EXECUTE:
            suggestions = [
                "先搜索合适的模型",
                "查看模型参数要求",
                "检查数据文件格式"
            ]
        else:
            suggestions = [
                "搜索模型或数据方法",
                "查看示例代码",
                "获取帮助文档"
            ]
        
        return suggestions
    
    def run(self, message: str) -> AlignmentResult:
        """
        运行完整的感知-对齐循环
        """
        # Step 1: 感知
        vibe, intent = self.perceive(message)
        
        # Step 2: 对齐
        result = self.align(vibe, intent)
        
        # Step 3: 更新 Agent 注意力
        self._update_agent_attention(vibe, result)
        
        return result
    
    def _update_agent_attention(self, vibe: UserVibe, alignment: AlignmentResult):
        """基于对齐结果更新 Agent 注意力"""
        has_error = self.user.consecutive_errors > 0
        
        self.agent.update_attention_for_context(
            user_vibe=vibe.value,
            has_error=has_error,
            task_in_progress=self.agent.cognitive_state.current_plan is not None
        )
    
    def generate_alignment_prompt_section(self, result: AlignmentResult) -> str:
        """
        生成对齐结果的 Prompt 片段
        用于注入到 System Prompt 中
        """
        sections = []
        
        sections.append("## 感知-对齐分析 (Perception-Alignment)")
        sections.append(f"- 检测到的用户状态: **{result.detected_vibe.value}**")
        sections.append(f"- 意图类型: {result.detected_intent.value}")
        sections.append(f"- 意图模糊度: {result.ambiguity_level:.0%}")
        sections.append(f"- 响应风格: {result.response_style}")
        
        # 行动指令
        sections.append(f"\n**对齐动作: {result.action.value.upper()}**")
        
        if result.action == AlignmentAction.CLARIFY:
            sections.append("\n⚠️ 请先澄清用户意图，不要直接执行！")
            sections.append("建议询问:")
            for q in (result.clarification_questions or []):
                sections.append(f"  - {q}")
        
        elif result.action == AlignmentAction.SUGGEST:
            sections.append("\n💡 用户在探索，请提供建议选项:")
            for s in (result.suggestions or []):
                sections.append(f"  - {s}")
        
        elif result.action == AlignmentAction.EXPLAIN:
            sections.append("\n📚 用户需要详细解释，请:")
            sections.append("  - 解释概念原理")
            sections.append("  - 说明操作步骤")
            sections.append("  - 提供相关背景")
        
        elif result.action == AlignmentAction.CONFIRM:
            sections.append("\n✅ 执行前请确认理解:")
            for q in (result.clarification_questions or []):
                sections.append(f"  - {q}")
        
        elif result.action == AlignmentAction.PROCEED:
            sections.append("\n✅ 可以直接执行用户请求")
            if result.response_style == "concise":
                sections.append("  - 保持简洁，专注结果")
            elif result.response_style == "verbose":
                sections.append("  - 提供详细说明")
        
        return "\n".join(sections)
