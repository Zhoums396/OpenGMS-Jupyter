"""
Notebook 操作技能
包含代码插入、Markdown 插入等
"""

from typing import Dict, Any, Optional
from ..base import Skill, SkillContext, SkillResult, SkillStatus, ParamSpec, ParamType


class InsertCodeSkill(Skill):
    """
    插入代码到 Notebook
    生成前端动作让 JupyterLab 执行
    """
    
    name = "insert_code"
    description = "在 Notebook 中插入代码单元格"
    category = "notebook"
    requires_frontend = True
    
    def _setup_params(self):
        self.add_param(ParamSpec(
            name="code",
            param_type=ParamType.CODE,
            description="要插入的代码内容",
            required=True
        ))
        self.add_param(ParamSpec(
            name="position",
            param_type=ParamType.ENUM,
            description="插入位置",
            required=False,
            default="below",
            enum_values=["above", "below", "end"]
        ))
        self.add_param(ParamSpec(
            name="run_after_insert",
            param_type=ParamType.BOOLEAN,
            description="插入后是否立即运行",
            required=False,
            default=False
        ))
    
    def check_preconditions(self, context: SkillContext) -> tuple[bool, str]:
        if not context.notebook_active:
            return False, "需要在 Notebook 环境中使用此技能"
        return True, ""
    
    async def _execute(self, context: SkillContext, **params) -> SkillResult:
        code = params.get("code", "")
        position = params.get("position", "below")
        run_after = params.get("run_after_insert", False)
        
        # 生成前端动作
        frontend_action = {
            "type": "add_code_cell",
            "code": code,
            "position": position,
            "run": run_after
        }
        
        return SkillResult(
            status=SkillStatus.SUCCESS,
            skill_name=self.name,
            output=code,
            message=f"已准备插入代码（{len(code)} 字符）",
            frontend_action=frontend_action
        )


class InsertMarkdownSkill(Skill):
    """
    插入 Markdown 到 Notebook
    """
    
    name = "insert_markdown"
    description = "在 Notebook 中插入 Markdown 说明单元格"
    category = "notebook"
    requires_frontend = True
    
    def _setup_params(self):
        self.add_param(ParamSpec(
            name="content",
            param_type=ParamType.STRING,
            description="Markdown 内容",
            required=True
        ))
        self.add_param(ParamSpec(
            name="position",
            param_type=ParamType.ENUM,
            description="插入位置",
            required=False,
            default="below",
            enum_values=["above", "below", "end"]
        ))
    
    def check_preconditions(self, context: SkillContext) -> tuple[bool, str]:
        if not context.notebook_active:
            return False, "需要在 Notebook 环境中使用此技能"
        return True, ""
    
    async def _execute(self, context: SkillContext, **params) -> SkillResult:
        content = params.get("content", "")
        position = params.get("position", "below")
        
        frontend_action = {
            "type": "add_markdown_cell",
            "content": content,
            "position": position
        }
        
        return SkillResult(
            status=SkillStatus.SUCCESS,
            skill_name=self.name,
            output=content,
            message=f"已准备插入 Markdown",
            frontend_action=frontend_action
        )


class ExecuteCellSkill(Skill):
    """
    执行当前单元格
    """
    
    name = "execute_cell"
    description = "执行 Notebook 中的当前单元格"
    category = "notebook"
    requires_frontend = True
    
    def _setup_params(self):
        self.add_param(ParamSpec(
            name="cell_index",
            param_type=ParamType.NUMBER,
            description="要执行的单元格索引（从 0 开始），不指定则执行当前单元格",
            required=False,
            default=None
        ))
    
    def check_preconditions(self, context: SkillContext) -> tuple[bool, str]:
        if not context.notebook_active:
            return False, "需要在 Notebook 环境中使用此技能"
        return True, ""
    
    async def _execute(self, context: SkillContext, **params) -> SkillResult:
        cell_index = params.get("cell_index")
        
        frontend_action = {
            "type": "run_cell",
            "cell_index": cell_index
        }
        
        return SkillResult(
            status=SkillStatus.SUCCESS,
            skill_name=self.name,
            message="已请求执行单元格",
            frontend_action=frontend_action
        )


class ClearOutputSkill(Skill):
    """
    清除单元格输出
    """
    
    name = "clear_output"
    description = "清除 Notebook 单元格的输出"
    category = "notebook"
    requires_frontend = True
    
    def _setup_params(self):
        self.add_param(ParamSpec(
            name="all_cells",
            param_type=ParamType.BOOLEAN,
            description="是否清除所有单元格的输出",
            required=False,
            default=False
        ))
    
    def check_preconditions(self, context: SkillContext) -> tuple[bool, str]:
        if not context.notebook_active:
            return False, "需要在 Notebook 环境中使用此技能"
        return True, ""
    
    async def _execute(self, context: SkillContext, **params) -> SkillResult:
        all_cells = params.get("all_cells", False)
        
        frontend_action = {
            "type": "clear_output",
            "all_cells": all_cells
        }
        
        return SkillResult(
            status=SkillStatus.SUCCESS,
            skill_name=self.name,
            message="已清除输出" if not all_cells else "已清除所有输出",
            frontend_action=frontend_action
        )
