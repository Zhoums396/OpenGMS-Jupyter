"""
技能注册表
管理所有可用技能的注册和查询
"""

from typing import Dict, List, Optional, Type
from .base import Skill


class SkillRegistry:
    """
    技能注册表
    单例模式，管理所有注册的技能
    """
    
    _instance: Optional["SkillRegistry"] = None
    _skills: Dict[str, Skill]
    _categories: Dict[str, List[str]]
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._skills = {}
            cls._instance._categories = {}
        return cls._instance
    
    def register(self, skill: Skill):
        """注册一个技能"""
        self._skills[skill.name] = skill
        
        # 按类别索引
        if skill.category not in self._categories:
            self._categories[skill.category] = []
        if skill.name not in self._categories[skill.category]:
            self._categories[skill.category].append(skill.name)
    
    def register_class(self, skill_class: Type[Skill]):
        """从类注册技能（自动实例化）"""
        skill = skill_class()
        self.register(skill)
    
    def get(self, name: str) -> Optional[Skill]:
        """获取技能"""
        return self._skills.get(name)
    
    def get_by_category(self, category: str) -> List[Skill]:
        """获取某类别的所有技能"""
        names = self._categories.get(category, [])
        return [self._skills[n] for n in names if n in self._skills]
    
    def list_all(self) -> List[Skill]:
        """列出所有技能"""
        return list(self._skills.values())
    
    def list_names(self) -> List[str]:
        """列出所有技能名称"""
        return list(self._skills.keys())
    
    def list_categories(self) -> List[str]:
        """列出所有类别"""
        return list(self._categories.keys())
    
    def get_tools_description(self, category: Optional[str] = None) -> str:
        """
        生成技能描述，用于 LLM system prompt
        """
        if category:
            skills = self.get_by_category(category)
        else:
            skills = self.list_all()
        
        desc = "## 可用技能\n\n"
        
        # 按类别分组
        by_category: Dict[str, List[Skill]] = {}
        for skill in skills:
            if skill.category not in by_category:
                by_category[skill.category] = []
            by_category[skill.category].append(skill)
        
        for cat, cat_skills in by_category.items():
            desc += f"### {cat}\n"
            for skill in cat_skills:
                desc += skill.to_tool_description() + "\n"
        
        return desc
    
    def find_skills_for_intent(self, intent: str) -> List[Skill]:
        """
        根据意图查找可能的技能
        简单的关键词匹配，可以扩展为更智能的匹配
        """
        intent_lower = intent.lower()
        matched = []
        
        for skill in self._skills.values():
            # 检查技能名称和描述
            if any(keyword in skill.name.lower() or keyword in skill.description.lower() 
                   for keyword in intent_lower.split()):
                matched.append(skill)
        
        return matched


# 全局注册表实例
_registry: Optional[SkillRegistry] = None


def get_skill_registry() -> SkillRegistry:
    """获取全局技能注册表"""
    global _registry
    if _registry is None:
        _registry = SkillRegistry()
    return _registry


def register_skill(skill: Skill):
    """快捷注册技能"""
    get_skill_registry().register(skill)


def skill_decorator(cls: Type[Skill]) -> Type[Skill]:
    """装饰器：自动注册技能类"""
    get_skill_registry().register_class(cls)
    return cls
