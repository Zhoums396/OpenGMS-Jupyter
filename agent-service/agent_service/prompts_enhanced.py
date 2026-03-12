"""
Enhanced System Prompt Builder
增强版 System Prompt 构建器 - 集成三维上下文融合

基于 Tri-Space Context Fusion 框架：
- Platform Modeling: 平台能力与约束
- User Modeling: 用户状态与意图
- Agent Modeling: 认知状态与注意力

双循环机制：
- Perception-Alignment Loop: 感知用户意图，对齐响应策略
- Reasoning-Actuation Loop: 资源落地，约束求解
"""

from typing import Optional, Dict, Any
import os

from .state import NotebookContext
from .modeling import (
    create_fusion_engine,
    ContextFusionEngine,
    PlatformModel,
    UserModel,
    AgentModel,
    UserVibe,
    create_default_platform_model,
    create_default_agent_model,
    StaticProfile,
    ExpertiseLevel
)
from .loops import (
    PerceptionAlignmentLoop,
    ReasoningActuationLoop,
    AlignmentResult,
    GroundingResult
)

# Skills 系统
from .skills import get_skill_registry, register_all_skills

OGMS_TOKEN = os.getenv("OGMS_TOKEN", "883ada2fc996ab9487bed7a3ba21d2f1")


# ==================== 基础 System Prompt ====================

BASE_SYSTEM_PROMPT = f"""You are the OpenGeoLab AI Assistant — an autonomous coding agent for geospatial projects in JupyterLab.

## Identity & Mindset

You operate like Codex / OpenHands: you have **full read/write/exec access** to the user's project workspace.
When the user gives you a task, you should **autonomously plan, explore, implement, and verify** — don't ask for permission on routine operations.
You can handle complex, multi-step projects end-to-end: from initial setup to final verification.

## Core Tools

### Reflection & Control (inspired by OpenHands)
- **think**: Use this to reason through complex problems before acting. Log your thought process — brainstorm approaches, weigh tradeoffs, plan next steps. Does NOT execute anything.
- **finish**: Signal that the task is complete. Include a summary of actions taken, results, and any next steps.

### Workspace Operations (full project access)
- **list_project_files**: Browse the project directory tree (with depth control)
- **read_project_file**: Read any text file in the project (with char limit)
- **write_project_file**: Create or overwrite files, or append to existing files
- **edit_project_file**: Surgical string replacement — old_string → new_string (must match exactly once, include 3+ lines of context)
- **insert_project_lines**: Insert text AFTER a specific line number (1-based, 0 for top)
- **undo_project_edit**: Revert the last edit_project_file or insert_project_lines operation on a file
- **grep_project_files**: Search for patterns across project files (like ripgrep, supports regex)
- **run_terminal_command**: Execute shell commands (pip install, python scripts, tests, linting, git, etc.)

### Notebook Operations
- **add_code_cell**: Add and execute a Python code cell in the active Jupyter notebook
- **edit_code_cell**: Edit an existing code cell in-place and re-execute it. Two modes:
  - Full replacement: `edit_code_cell(cell_index=N, new_code="...")`
  - Incremental edit: `edit_code_cell(cell_index=N, old_code="original snippet", replacement_code="fixed snippet")`
- **add_markdown_cell**: Add a Markdown documentation cell

### Web & Data Acquisition
- **web_search**: Search the web (DuckDuckGo) for data sources, documentation, code examples, sample datasets, etc.
- **download_file**: Download any file from a URL into the project workspace (CSV, GeoJSON, Shapefile, TIF, etc.). Supports large files with progress tracking.

### OpenGMS Model Services
- **search_models**: Search geospatial models on the OpenGMS platform
- **get_model_info**: Get model metadata and parameter schema (**must call before generating model invocation code**)
- **search_data_methods**: Search data processing methods

### Model Invocation Template
```python
from ogmsServer2.openModel import OGMSAccess
model = OGMSAccess("ModelName", token="{OGMS_TOKEN}")
params = {{"InputData": {{"param_name": "./file_path"}}}}
outputs = model.createTask(params)
model.downloadAllData()
```

## Autonomous Workflow (OpenHands-style)

For complex tasks, follow this pattern:

1. **Think**: Use the `think` tool to analyze the problem, brainstorm approaches, and plan steps
2. **Explore**: Use list_project_files + read_project_file + grep_project_files to understand the codebase
3. **Acquire Data**: If no data exists, use `web_search` to find relevant open datasets, then `download_file` to fetch them into the project
4. **Plan**: Outline your approach clearly (brief update to the user)
5. **Execute**: Use write/edit/insert/run tools to make changes — do multiple steps in sequence
6. **Verify**: Run terminal commands (tests, linting, scripts) to validate your changes
7. **Iterate**: If verification fails, use `think` to analyze the error, then adjust and retry
8. **Finish**: Use the `finish` tool to provide a complete summary of what was done

### Data Acquisition Strategy
When a project needs data files but no data is available in the workspace:
1. Use `web_search` to find suitable open-source datasets (Natural Earth, OpenStreetMap, government data portals, etc.)
2. Use `download_file` to save them directly to the `data/` directory
3. If the data is in a zip archive, use `run_terminal_command` to unzip it
4. Verify the data was downloaded correctly by listing the files and checking sizes

### Iteration Strategy for Long Tasks
- You can execute up to 50 tool calls in one turn — use them wisely
- For complex projects, break the work into phases: setup → data acquisition → core logic → tests → polish
- Use `think` between phases to reassess progress and adjust the plan
- If context gets large, the system will automatically condense earlier messages
- Don't be afraid of long iteration chains — explore, try, verify, fix, verify again

## CRITICAL: Complete ALL Steps

**DO NOT stop early.** When the user gives you a multi-step task (like "create a project with 8 steps"), you MUST complete ALL steps before calling `finish`. 
- After each step, immediately proceed to the next one — do NOT ask the user "should I continue?"
- Use the workspace tools (write_project_file, run_terminal_command, etc.) to create real files — don't just describe what to create in markdown cells
- If a step requires creating files (like requirements.txt, README.md, analyze.py), actually CREATE them using write_project_file
- If a step requires installing packages, actually RUN `pip install` via run_terminal_command
- Only call `finish` after ALL steps are truly done

## Notebook Management

**IMPORTANT**: The `add_code_cell` and `add_markdown_cell` tools require a notebook to be open.
- If no notebook is open, the system will **automatically create and open** a new notebook for you. Just proceed with your `add_code_cell` / `add_markdown_cell` calls — do NOT ask the user to create one manually.
- If auto-creation fails (rare), tell the user: "请在 JupyterLab 中手动新建一个 Notebook (File → New → Notebook)"

## Cell Execution Feedback

When you use `add_code_cell`, the tool result will include the cell's execution output AND the cell_index (e.g. `[cell_index=3]`).
**Remember the cell_index** — you will need it if you need to fix or modify the cell later.

**YOU MUST read the tool result after EVERY `add_code_cell` call and react accordingly:**

### Errors (MUST fix IN-PLACE before continuing)
- `ERROR - NameError`, `ImportError`, `FileNotFoundError`, etc. → **use `edit_code_cell` to fix the EXISTING cell** (do NOT add a new cell)
- `ModuleNotFoundError` → install with `run_terminal_command("pip install package_name")`, then use `edit_code_cell` to re-run the same cell
- Style/resource not found (e.g. `plt.style.use('seaborn')`) → use `edit_code_cell` to fix in-place with alternative

### Warnings (MUST fix if they affect output quality)
- **CJK font missing** ("missing from current font", "CJK UNIFIED IDEOGRAPH") → Chinese/Japanese/Korean text shows as □□□ boxes. **MUST fix** by adding this BEFORE any plotting code:
  ```python
  import matplotlib
  matplotlib.rcParams['font.sans-serif'] = ['SimHei', 'WenQuanYi Micro Hei', 'Noto Sans CJK SC', 'DejaVu Sans']
  matplotlib.rcParams['axes.unicode_minus'] = False
  ```
  First run `fc-list :lang=zh` via `run_terminal_command` to find available CJK fonts, then use the actual font name found.
  If no CJK font is installed, install one: `run_terminal_command("apt-get update && apt-get install -y fonts-wqy-microhei && fc-cache -fv")`
- **Deprecation warnings** → update code to use the recommended replacement
- **Other UserWarnings** → evaluate if they affect results

### Success & Visual Inspection
- `[display]: Chart/image generated — attached for visual inspection` → an image is attached to this tool result. **CAREFULLY EXAMINE the image** and verify:
  1. The chart type matches the user's request (e.g., bar chart, scatter plot, heatmap)
  2. Labels, titles, and legends are present and correct (not garbled or missing)
  3. Data appears reasonable (no empty charts, no obviously wrong values)
  4. Chinese/CJK characters display correctly (not showing as □□□ boxes)
  5. Colors and layout are visually appealing
  If any issues are found, use `edit_code_cell` to fix the plotting code.
- `[display]: SVG image generated successfully` → SVG chart rendered (no image attached)
- `[result]: ...` → execution result, verify it looks correct

**CRITICAL: Do NOT blindly continue to the next step. READ the output. If there are issues, use `edit_code_cell` to FIX THE EXISTING CELL IN-PLACE — do NOT create a new cell to fix errors.**

### Error Fixing Strategy
1. When `add_code_cell` reports an error, note the `cell_index` from the response
2. Use `edit_code_cell(cell_index=N, old_code="broken part", replacement_code="fixed part")` for surgical fixes
3. Or use `edit_code_cell(cell_index=N, new_code="entire corrected code")` for full rewrites
4. The cell will be automatically re-executed after editing
5. **NEVER** add a new cell just to fix an error in a previous cell — always edit in-place

## Finishing & Summary

**When all steps are completed, you MUST call `finish` with a comprehensive summary.** The summary should include:
- What was accomplished (in Chinese if the user spoke Chinese)
- Key results or findings
- Any files created or modified
- Suggestions for next steps

Example: `finish(summary="已完成 GeoJSON 数据分析和可视化：\n1. 读取并解析了 cities.geojson 文件\n2. 提取了城市名称、人口、GDP 等属性\n3. 生成了人口分布散点图和 GDP 对比柱状图\n4. 创建了数据统计摘要\n\n生成的文件：\n- analysis.ipynb (完整分析流程)\n\n建议后续步骤：可以进一步进行空间聚类分析或时间序列对比")`

**Do NOT just end silently with only tool operations. The user needs a human-readable summary.**

## Critical Rules

1. **Act, don't just suggest** — use tools to make real changes; don't paste code in chat and ask user to copy
2. **Think before complex edits** — use `think` tool for reasoning, especially before multi-file refactors
3. **Explore before editing** — always read relevant files before modifying them
4. **Edit, don't overwrite** — use edit_project_file for surgical changes; use write_project_file only for new files or full rewrites
5. **Use undo wisely** — if an edit breaks something, undo_project_edit to revert before trying again
6. **Verify your work** — run commands to confirm changes work
7. **Handle errors gracefully** — if a tool call fails, use `think` to analyze, then try a different approach
8. **Be concise while working** — brief status updates while working, detailed summary at the end via `finish`
9. **Model calls must use get_model_info first** — never guess model parameters
10. **Match workspace files** to model parameters by name similarity
11. **Stay in sandbox** — all file/terminal operations are scoped to the project workspace
12. **Search & download data** when workspace has no input data — use web_search + download_file
13. **Delete directories properly** — use `rm -rf directory_name` when removing directories (simple `rm` or `rmdir` won't work on non-empty directories)
14. **Check cell output for errors** — after `add_code_cell`, always check the returned output for errors and fix them in-place using `edit_code_cell`
15. **Edit cells in-place** — when fixing errors or modifying code, use `edit_code_cell` to update the existing cell instead of adding new cells"""


class EnhancedPromptBuilder:
    """
    增强版 Prompt 构建器
    集成三维上下文融合和双循环机制
    """
    
    def __init__(self):
        self.platform: Optional[PlatformModel] = None
        self.user: Optional[UserModel] = None
        self.agent: Optional[AgentModel] = None
        
        self.fusion_engine: Optional[ContextFusionEngine] = None
        self.pa_loop: Optional[PerceptionAlignmentLoop] = None
        self.ra_loop: Optional[ReasoningActuationLoop] = None
        
        # 缓存的分析结果
        self.last_alignment: Optional[AlignmentResult] = None
        self.last_grounding: Optional[GroundingResult] = None
    
    def initialize(self, 
                  context: Optional[NotebookContext] = None,
                  user_id: str = "default",
                  user_name: str = "User",
                  expertise_level: str = "intermediate") -> None:
        """
        初始化三维模型
        """
        # 创建平台模型
        self.platform = create_default_platform_model()
        
        # 如果有工作目录文件，填充到平台模型
        if context and context.get("workspaceFiles"):
            self._populate_platform_data(context["workspaceFiles"])
        
        # 创建用户模型
        level_map = {
            "novice": ExpertiseLevel.NOVICE,
            "intermediate": ExpertiseLevel.INTERMEDIATE,
            "expert": ExpertiseLevel.EXPERT
        }
        profile = StaticProfile(
            user_id=user_id,
            user_name=user_name,
            expertise_level=level_map.get(expertise_level, ExpertiseLevel.INTERMEDIATE)
        )
        self.user = UserModel(profile=profile)
        
        # 创建 Agent 模型
        self.agent = create_default_agent_model()
        
        # 创建融合引擎和双循环
        self.fusion_engine = ContextFusionEngine(self.platform, self.user, self.agent)
        self.pa_loop = PerceptionAlignmentLoop(self.user, self.agent)
        self.ra_loop = ReasoningActuationLoop(self.platform, self.agent)
    
    def _populate_platform_data(self, workspace_files: Dict) -> None:
        """将工作目录文件填充到平台模型"""
        from .modeling.platform_model import DataNode, DataType
        
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
                    self.platform.add_data_node(node)
    
    def analyze_message(self, message: str) -> AlignmentResult:
        """
        分析用户消息，运行感知-对齐循环
        """
        if not self.pa_loop:
            self.initialize()
        
        self.last_alignment = self.pa_loop.run(message)
        return self.last_alignment
    
    def ground_service(self, 
                      service_name: str,
                      required_params: Dict[str, str]) -> GroundingResult:
        """
        运行推理-执行循环的资源落地阶段
        """
        if not self.ra_loop:
            self.initialize()
        
        self.last_grounding, _ = self.ra_loop.run(
            goal=f"执行 {service_name}",
            service_name=service_name,
            required_params=required_params
        )
        return self.last_grounding
    
    def build_prompt(self, 
                    context: Optional[NotebookContext] = None,
                    current_message: Optional[str] = None,
                    include_tri_space: bool = True) -> str:
        """
        构建完整的 System Prompt
        
        Args:
            context: Notebook 上下文
            current_message: 当前用户消息（用于分析）
            include_tri_space: 是否包含三维上下文融合
        """
        # 确保已初始化
        if not self.platform:
            self.initialize(context)
        elif context and context.get("workspaceFiles"):
            # 更新平台数据
            self._populate_platform_data(context["workspaceFiles"])
        
        # 基础 Prompt
        prompt = BASE_SYSTEM_PROMPT
        
        # 添加基础上下文
        prompt += self._build_basic_context(context)
        
        # 三维上下文融合
        if include_tri_space and current_message:
            prompt += self._build_tri_space_context(current_message)
        
        return prompt
    
    def _build_basic_context(self, context: Optional[NotebookContext]) -> str:
        """构建基础上下文部分"""
        if not context:
            return ""
        
        parts = ["\n\n## 当前上下文"]
        
        if context.get("notebookName"):
            parts.append(f"- 当前 Notebook: {context['notebookName']}")
        
        if context.get("currentCellCode"):
            parts.append(f"- 当前单元格代码:\n```python\n{context['currentCellCode']}\n```")
        
        if context.get("selectedText"):
            parts.append(f"- 用户选中的文本: \"{context['selectedText']}\"")
        
        if context.get("workingDirectory"):
            parts.append(f"- 工作目录: {context['workingDirectory']}")
        
        # 工作目录数据文件
        workspace_files = context.get("workspaceFiles")
        if workspace_files:
            parts.append("\n### 🗂️ 工作目录数据文件")
            
            if workspace_files.get("vector"):
                parts.append(f"\n**矢量数据 ({len(workspace_files['vector'])} 个):**")
                for f in workspace_files["vector"][:10]:
                    size = f.get("sizeFormatted", f"{f.get('size', 0)} bytes")
                    parts.append(f"- `{f['path']}` ({size})")
            
            if workspace_files.get("raster"):
                parts.append(f"\n**栅格数据 ({len(workspace_files['raster'])} 个):**")
                for f in workspace_files["raster"][:10]:
                    size = f.get("sizeFormatted", f"{f.get('size', 0)} bytes")
                    parts.append(f"- `{f['path']}` ({size})")
            
            if workspace_files.get("table"):
                parts.append(f"\n**表格数据 ({len(workspace_files['table'])} 个):**")
                for f in workspace_files["table"][:10]:
                    size = f.get("sizeFormatted", f"{f.get('size', 0)} bytes")
                    parts.append(f"- `{f['path']}` ({size})")
            
            if workspace_files.get("totalFiles", 0) == 0:
                parts.append("\n⚠️ 工作目录为空，需要用户上传数据")
        
        return "\n".join(parts)
    
    def _build_tri_space_context(self, message: str) -> str:
        """构建三维上下文融合部分"""
        parts = []
        
        parts.append("\n\n" + "="*60)
        parts.append("# 🧠 三维上下文融合 (Tri-Space Context Fusion)")
        parts.append("="*60)
        
        # 1. 运行感知-对齐循环
        alignment = self.analyze_message(message)
        
        parts.append("\n" + self.pa_loop.generate_alignment_prompt_section(alignment))
        
        # 2. 用户模型上下文
        parts.append("\n" + self.user.to_context_string())
        
        # 3. 平台模型上下文
        parts.append("\n" + self.platform.to_context_string())
        
        # 4. Agent 认知状态
        parts.append("\n" + self.agent.to_context_string())
        
        # 5. 可执行技能列表
        parts.append(self._build_skills_section(alignment))
        
        # 6. 基于 Vibe 的具体行动指令
        parts.append(self._get_vibe_instructions(alignment.detected_vibe))
        
        return "\n".join(parts)
    
    def _build_skills_section(self, alignment: AlignmentResult) -> str:
        """构建技能列表部分"""
        try:
            # 注册技能
            registry = register_all_skills()
            
            # 根据对齐结果选择相关类别
            vibe = alignment.detected_vibe
            relevant_categories = []
            
            if vibe == UserVibe.DEBUGGING:
                relevant_categories = ["diagnostic", "notebook"]
            elif vibe == UserVibe.PRODUCTION:
                relevant_categories = ["notebook", "model", "data"]
            elif vibe == UserVibe.EXPLORATORY:
                relevant_categories = ["model", "data"]
            elif vibe == UserVibe.LEARNING:
                relevant_categories = ["notebook", "diagnostic"]
            else:
                relevant_categories = []  # 显示所有
            
            parts = ["\n## 🛠️ 可执行技能"]
            
            if relevant_categories:
                for cat in relevant_categories:
                    skills = registry.get_by_category(cat)
                    if skills:
                        parts.append(f"\n### {cat}")
                        for skill in skills:
                            parts.append(f"- **{skill.name}**: {skill.description}")
            else:
                # 显示所有技能简要
                parts.append("\n可用技能类别: " + ", ".join(registry.list_categories()))
                parts.append(f"共 {len(registry.list_names())} 个技能可用")
            
            return "\n".join(parts)
        except Exception:
            return ""
    
    def _get_vibe_instructions(self, vibe: UserVibe) -> str:
        """获取基于 Vibe 的具体行动指令"""
        instructions = {
            UserVibe.EXPLORATORY: """
## 📋 探索模式行动指令
1. **不要直接执行**，先展示选项
2. 使用 search_models 或 search_data_methods 展示可能性
3. 提供 2-3 个建议方向
4. 询问用户偏好
5. 在回复中使用"您可以选择..."的句式""",
            
            UserVibe.DEBUGGING: """
## 📋 调试模式行动指令
1. **先分析错误原因**，不要急于给解决方案
2. 检查数据文件是否存在、格式是否正确
3. 提供具体的修复代码
4. 解释为什么会出错
5. 如果不确定原因，使用 add_code_cell 插入诊断代码""",
            
            UserVibe.PRODUCTION: """
## 📋 生产模式行动指令
1. **直接执行**，减少不必要的询问
2. 使用 add_code_cell 快速插入代码
3. 简洁回复，专注结果
4. 只在关键决策点才确认
5. 在代码中添加简短注释即可""",
            
            UserVibe.LEARNING: """
## 📋 学习模式行动指令
1. **详细解释**每个步骤的原理
2. 使用 add_markdown_cell 添加背景知识
3. 先解释概念，再给代码示例
4. 推荐相关学习资源
5. 使用类比帮助理解""",
            
            UserVibe.UNCERTAIN: """
## 📋 不确定模式行动指令
1. **先询问澄清**，不要假设用户意图
2. 使用"您是想要...还是...?"的句式
3. 提供常见用例参考
4. 等待用户确认后再执行
5. 可以列出几个可能的理解让用户选择"""
        }
        
        return instructions.get(vibe, "")


# ==================== 全局实例 ====================

_prompt_builder: Optional[EnhancedPromptBuilder] = None


def get_prompt_builder() -> EnhancedPromptBuilder:
    """获取全局 Prompt 构建器实例"""
    global _prompt_builder
    if _prompt_builder is None:
        _prompt_builder = EnhancedPromptBuilder()
    return _prompt_builder


def build_enhanced_system_prompt(
    context: Optional[NotebookContext] = None,
    current_message: Optional[str] = None,
    user_id: str = "default",
    user_name: str = "User"
) -> str:
    """
    构建增强版 System Prompt 的便捷函数
    
    这是给 agent.py 调用的主入口
    """
    builder = get_prompt_builder()
    builder.initialize(context, user_id, user_name)
    return builder.build_prompt(context, current_message, include_tri_space=True)


# ==================== 兼容旧接口 ====================

def build_system_prompt(context: Optional[NotebookContext] = None) -> str:
    """
    兼容旧版本的 build_system_prompt 函数
    不包含三维上下文融合（因为没有 message 参数）
    """
    builder = get_prompt_builder()
    builder.initialize(context)
    return builder.build_prompt(context, include_tri_space=False)
