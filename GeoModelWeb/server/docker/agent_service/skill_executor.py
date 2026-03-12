"""
技能执行器
将 Skills 系统集成到 Agent 执行流程中
"""

from typing import Dict, Any, Optional, List
import asyncio

from .skills import (
    SkillContext,
    SkillResult,
    SkillRouter,
    SkillRegistry,
    register_all_skills,
    get_skill_registry
)
from .state import AgentState, NotebookContext


class SkillExecutor:
    """
    技能执行器
    桥接 Agent 状态和 Skills 系统
    """
    
    def __init__(self):
        # 初始化并注册所有技能
        self.registry = register_all_skills()
        self.router = SkillRouter(self.registry)
    
    def build_skill_context(self, state: AgentState) -> SkillContext:
        """从 Agent 状态构建 SkillContext"""
        notebook_ctx: Optional[NotebookContext] = state.get("notebook_context")
        
        context = SkillContext(
            user_id=state.get("user_id", ""),
            user_name=state.get("user_name", "User"),
        )
        
        # 填充 Notebook 信息
        if notebook_ctx:
            context.notebook_active = bool(notebook_ctx.get("notebook_path"))
            context.notebook_name = notebook_ctx.get("notebook_path", "")
            context.current_cell_code = notebook_ctx.get("current_cell_code", "")
            context.working_directory = notebook_ctx.get("working_directory", "")
            
            # 提取文件信息
            file_tree = notebook_ctx.get("file_tree", [])
            context.available_files = self._extract_files_by_type(file_tree)
            
            # 错误信息
            last_output = notebook_ctx.get("last_cell_output", "")
            if "error" in last_output.lower() or "traceback" in last_output.lower():
                context.last_error = last_output
                context.last_output = None
            else:
                context.last_error = None
                context.last_output = last_output
        
        return context
    
    def _extract_files_by_type(self, file_tree: List[Dict]) -> Dict[str, List[Dict]]:
        """从文件树中按类型提取文件"""
        result = {
            "vector": [],
            "raster": [],
            "table": [],
            "other": []
        }
        
        # 文件扩展名分类
        vector_exts = {".shp", ".geojson", ".gpkg", ".kml"}
        raster_exts = {".tif", ".tiff", ".img", ".nc"}
        table_exts = {".csv", ".xlsx", ".xls", ".parquet"}
        
        def traverse(items):
            for item in items:
                if isinstance(item, dict):
                    name = item.get("name", "")
                    if item.get("type") == "file":
                        ext = "." + name.split(".")[-1].lower() if "." in name else ""
                        file_info = {"name": name, "path": item.get("path", name)}
                        
                        if ext in vector_exts:
                            result["vector"].append(file_info)
                        elif ext in raster_exts:
                            result["raster"].append(file_info)
                        elif ext in table_exts:
                            result["table"].append(file_info)
                        else:
                            result["other"].append(file_info)
                    
                    # 递归处理子目录
                    if "children" in item:
                        traverse(item["children"])
        
        traverse(file_tree)
        return result
    
    async def execute_skill(
        self,
        skill_name: str,
        state: AgentState,
        params: Optional[Dict[str, Any]] = None
    ) -> SkillResult:
        """执行指定技能"""
        skill = self.registry.get(skill_name)
        if not skill:
            return SkillResult(
                status="failed",
                skill_name=skill_name,
                error=f"技能 '{skill_name}' 不存在"
            )
        
        context = self.build_skill_context(state)
        return await skill.execute(context, **(params or {}))
    
    async def route_and_execute(
        self,
        user_input: str,
        state: AgentState
    ) -> SkillResult:
        """根据用户输入路由并执行技能"""
        context = self.build_skill_context(state)
        return await self.router.route_and_execute(user_input, context)
    
    def get_available_skills_description(self, category: Optional[str] = None) -> str:
        """获取可用技能的描述"""
        return self.registry.get_tools_description(category)
    
    def get_skills_for_system_prompt(self) -> str:
        """生成用于 system prompt 的技能描述"""
        return self.registry.get_tools_description()


# 全局执行器实例
_executor: Optional[SkillExecutor] = None


def get_skill_executor() -> SkillExecutor:
    """获取全局技能执行器"""
    global _executor
    if _executor is None:
        _executor = SkillExecutor()
    return _executor
