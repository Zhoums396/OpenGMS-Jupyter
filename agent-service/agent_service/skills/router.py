"""
技能路由器
根据用户意图和上下文选择合适的技能
"""

from typing import Dict, List, Optional, Any
from dataclasses import dataclass, field
from enum import Enum

from .base import Skill, SkillContext, SkillResult, SkillStatus
from .registry import SkillRegistry, get_skill_registry


class RoutingStrategy(Enum):
    """路由策略"""
    EXACT_MATCH = "exact_match"         # 精确匹配技能名
    KEYWORD_MATCH = "keyword_match"     # 关键词匹配
    LLM_DECISION = "llm_decision"       # LLM 决定
    COMPOSITE = "composite"             # 组合多个技能


@dataclass
class RoutingDecision:
    """路由决策结果"""
    strategy_used: RoutingStrategy
    selected_skills: List[str]          # 选中的技能名称列表
    skill_params: Dict[str, Dict[str, Any]] = field(default_factory=dict)
    # {"skill_name": {"param1": value1, ...}}
    
    confidence: float = 1.0             # 决策置信度
    reasoning: str = ""                 # 决策理由
    
    # 是否需要用户确认
    needs_confirmation: bool = False
    confirmation_prompt: str = ""
    
    @property
    def is_single_skill(self) -> bool:
        return len(self.selected_skills) == 1
    
    @property
    def is_composite(self) -> bool:
        return len(self.selected_skills) > 1
    
    @property
    def primary_skill(self) -> Optional[str]:
        return self.selected_skills[0] if self.selected_skills else None


class SkillRouter:
    """
    技能路由器
    根据用户输入和上下文选择执行哪个技能
    """
    
    # 意图到技能的映射
    INTENT_SKILL_MAP = {
        # Notebook 操作
        "add_code": ["insert_code"],
        "insert_code": ["insert_code"],
        "write_code": ["insert_code"],
        "代码": ["insert_code"],
        
        "add_markdown": ["insert_markdown"],
        "insert_markdown": ["insert_markdown"],
        "说明": ["insert_markdown"],
        
        # 模型操作
        "search_model": ["search_models"],
        "find_model": ["search_models"],
        "搜索模型": ["search_models"],
        "查找模型": ["search_models"],
        
        "model_info": ["get_model_info"],
        "模型信息": ["get_model_info"],
        "模型详情": ["get_model_info"],
        
        "run_model": ["invoke_model"],
        "invoke_model": ["invoke_model"],
        "execute_model": ["invoke_model"],
        "运行模型": ["invoke_model"],
        "调用模型": ["invoke_model"],
        
        # 错误诊断
        "error": ["diagnose_error"],
        "debug": ["diagnose_error"],
        "fix": ["diagnose_error"],
        "错误": ["diagnose_error"],
        "报错": ["diagnose_error"],
    }
    
    def __init__(self, registry: Optional[SkillRegistry] = None):
        self.registry = registry or get_skill_registry()
    
    def route(
        self,
        user_input: str,
        context: SkillContext,
        explicit_skill: Optional[str] = None,
        explicit_params: Optional[Dict[str, Any]] = None
    ) -> RoutingDecision:
        """
        路由用户请求到适当的技能
        
        Args:
            user_input: 用户输入
            context: 技能执行上下文
            explicit_skill: 明确指定的技能（优先级最高）
            explicit_params: 明确指定的参数
        
        Returns:
            RoutingDecision: 路由决策
        """
        # 1. 如果明确指定了技能
        if explicit_skill:
            skill = self.registry.get(explicit_skill)
            if skill:
                return RoutingDecision(
                    strategy_used=RoutingStrategy.EXACT_MATCH,
                    selected_skills=[explicit_skill],
                    skill_params={explicit_skill: explicit_params or {}},
                    confidence=1.0,
                    reasoning=f"用户明确指定使用 {explicit_skill} 技能"
                )
        
        # 2. 关键词匹配
        decision = self._keyword_route(user_input, context)
        if decision.selected_skills:
            return decision
        
        # 3. 上下文推断
        decision = self._context_route(user_input, context)
        if decision.selected_skills:
            return decision
        
        # 4. 无法确定，返回空决策
        return RoutingDecision(
            strategy_used=RoutingStrategy.KEYWORD_MATCH,
            selected_skills=[],
            confidence=0.0,
            reasoning="无法确定合适的技能"
        )
    
    def _keyword_route(self, user_input: str, context: SkillContext) -> RoutingDecision:
        """基于关键词的路由"""
        user_lower = user_input.lower()
        
        matched_skills = []
        matched_keywords = []
        
        for keyword, skills in self.INTENT_SKILL_MAP.items():
            if keyword in user_lower:
                for skill_name in skills:
                    if skill_name not in matched_skills:
                        if self.registry.get(skill_name):  # 确保技能存在
                            matched_skills.append(skill_name)
                            matched_keywords.append(keyword)
        
        if matched_skills:
            return RoutingDecision(
                strategy_used=RoutingStrategy.KEYWORD_MATCH,
                selected_skills=matched_skills,
                confidence=0.8,
                reasoning=f"关键词匹配: {', '.join(matched_keywords)}"
            )
        
        return RoutingDecision(
            strategy_used=RoutingStrategy.KEYWORD_MATCH,
            selected_skills=[],
            confidence=0.0,
            reasoning="无关键词匹配"
        )
    
    def _context_route(self, user_input: str, context: SkillContext) -> RoutingDecision:
        """基于上下文的路由"""
        
        # 如果有错误，优先错误诊断
        if context.last_error:
            return RoutingDecision(
                strategy_used=RoutingStrategy.COMPOSITE,
                selected_skills=["diagnose_error"],
                confidence=0.7,
                reasoning="检测到最近有错误，建议诊断"
            )
        
        # 如果在 Notebook 中，默认插入代码
        if context.notebook_active:
            return RoutingDecision(
                strategy_used=RoutingStrategy.COMPOSITE,
                selected_skills=["insert_code"],
                confidence=0.5,
                reasoning="在 Notebook 环境中，默认插入代码"
            )
        
        return RoutingDecision(
            strategy_used=RoutingStrategy.COMPOSITE,
            selected_skills=[],
            confidence=0.0,
            reasoning="无法从上下文推断"
        )
    
    async def route_and_execute(
        self,
        user_input: str,
        context: SkillContext,
        explicit_skill: Optional[str] = None,
        explicit_params: Optional[Dict[str, Any]] = None
    ) -> SkillResult:
        """
        路由并执行技能
        """
        decision = self.route(user_input, context, explicit_skill, explicit_params)
        
        if not decision.selected_skills:
            return SkillResult(
                status=SkillStatus.FAILED,
                skill_name="router",
                error="无法确定合适的技能",
                message="抱歉，我不确定该如何处理这个请求。"
            )
        
        # 执行主技能
        primary_skill_name = decision.primary_skill
        skill = self.registry.get(primary_skill_name)
        
        if not skill:
            return SkillResult(
                status=SkillStatus.FAILED,
                skill_name="router",
                error=f"技能 '{primary_skill_name}' 未找到",
                message=f"技能 '{primary_skill_name}' 不存在。"
            )
        
        params = decision.skill_params.get(primary_skill_name, {})
        return await skill.execute(context, **params)


def create_router() -> SkillRouter:
    """创建路由器实例"""
    return SkillRouter()
