# Skills 系统架构文档

## 概述

OpenGeoLab AI Agent 的 Skills 系统是一个**真正可执行**的技能框架，不仅仅是元数据描述，而是包含完整的 `execute()` 方法和执行逻辑。

## 与旧实现的对比

### 旧实现 (agent_model.py 中的 Skill)
```python
@dataclass
class Skill:
    name: str
    description: str
    category: SkillCategory
    # 只有元数据，没有 execute() 方法！
```

### 新实现 (skills/base.py 中的 Skill)
```python
class Skill(ABC):
    name: str
    description: str
    category: str
    
    @abstractmethod
    async def execute(self, context: SkillContext, **params) -> SkillResult:
        """真正的执行逻辑"""
        pass
    
    def check_preconditions(self, context: SkillContext) -> tuple[bool, str]:
        """前置条件检查"""
        pass
    
    def validate_params(self, **params) -> tuple[bool, List[str]]:
        """参数验证"""
        pass
```

## 目录结构

```
agent_service/skills/
├── __init__.py              # 模块入口，导出所有组件
├── base.py                  # Skill 基类、SkillContext、SkillResult
├── registry.py              # SkillRegistry 技能注册表
├── router.py                # SkillRouter 意图路由
└── implementations/         # 具体技能实现
    ├── __init__.py
    ├── notebook_skills.py   # InsertCodeSkill, InsertMarkdownSkill 等
    ├── search_skills.py     # SearchModelsSkill, GetModelInfoSkill
    ├── model_skills.py      # InvokeModelSkill, CheckTaskStatusSkill
    ├── diagnostic_skills.py # DiagnoseErrorSkill, SuggestImportsSkill
    └── data_skills.py       # ListFilesSkill, ReadDataSkill
```

## 核心组件

### 1. Skill 基类

```python
class Skill(ABC):
    # 技能元信息
    name: str = "base_skill"
    description: str = "Base skill"
    category: str = "general"
    requires_frontend: bool = False
    
    async def execute(self, context: SkillContext, **params) -> SkillResult:
        """执行技能的主入口"""
        # 1. 验证参数
        # 2. 检查前置条件
        # 3. 调用 _execute() 实现
```

### 2. SkillContext - 执行上下文

包含执行技能所需的所有环境信息：
- 用户信息 (user_id, user_name, user_vibe)
- Notebook 状态 (notebook_active, current_cell_code)
- 工作目录和文件 (available_files)
- 错误和输出历史 (last_error, last_output)

### 3. SkillResult - 执行结果

```python
@dataclass
class SkillResult:
    status: SkillStatus           # success/failed/precondition_failed...
    skill_name: str
    output: Any                   # 主要输出
    message: str                  # 人类可读消息
    frontend_action: Dict         # 前端动作 {"type": "add_code_cell", ...}
    next_skills: List[str]        # 需要继续执行的技能
    error_diagnosis: str          # 错误诊断
    suggested_fixes: List[str]    # 修复建议
```

### 4. SkillRegistry - 技能注册表

```python
registry = register_all_skills()
skill = registry.get("insert_code")
notebook_skills = registry.get_by_category("notebook")
```

### 5. SkillRouter - 意图路由

```python
router = SkillRouter()
decision = router.route(user_input, context)
# decision.selected_skills = ["insert_code", "diagnose_error"]
# decision.confidence = 0.8
```

## 已实现的技能

| 类别 | 技能名 | 描述 |
|------|--------|------|
| **notebook** | insert_code | 插入代码单元格 |
| | insert_markdown | 插入 Markdown 单元格 |
| | execute_cell | 执行当前单元格 |
| | clear_output | 清除输出 |
| **model** | search_models | 搜索 OpenGMS 模型 |
| | get_model_info | 获取模型详情 |
| | invoke_model | 调用模型（复合技能） |
| | check_task_status | 检查任务状态 |
| | download_result | 下载结果 |
| **diagnostic** | diagnose_error | 错误诊断 |
| | suggest_imports | 建议 import 语句 |
| | explain_code | 解释代码 |
| **data** | list_files | 列出文件 |
| | read_data | 生成读取代码 |
| | preview_data | 数据预览 |
| | save_data | 保存数据 |

## 使用示例

### 执行单个技能

```python
from agent_service.skills import InsertCodeSkill, SkillContext

skill = InsertCodeSkill()
context = SkillContext(
    notebook_active=True,
    working_directory="/tmp"
)

result = await skill.execute(
    context,
    code="import pandas as pd",
    position="below"
)

if result.is_success:
    print(result.frontend_action)
    # {"type": "add_code_cell", "code": "...", "position": "below"}
```

### 通过路由执行

```python
from agent_service.skills import SkillRouter, SkillContext, register_all_skills

register_all_skills()
router = SkillRouter()
context = SkillContext(notebook_active=True)

result = await router.route_and_execute("我的代码报错了", context)
# 自动路由到 DiagnoseErrorSkill
```

### 在 Agent 中使用

```python
from agent_service.skill_executor import get_skill_executor

executor = get_skill_executor()
result = await executor.execute_skill(
    "diagnose_error",
    state,  # AgentState
    {"error_message": "ModuleNotFoundError: No module named 'geopandas'"}
)

print(result.error_diagnosis)  # "缺少 Python 模块"
print(result.suggested_fixes)  # ["pip install geopandas", ...]
```

## 前端动作类型

Skills 可以返回 `frontend_action` 让前端执行：

```python
# 添加代码单元格
{"type": "add_code_cell", "code": "...", "position": "below", "run": True}

# 添加 Markdown
{"type": "add_markdown_cell", "content": "...", "position": "above"}

# 执行单元格
{"type": "run_cell", "cell_index": None}

# 清除输出
{"type": "clear_output", "all_cells": False}
```

## 扩展技能

添加新技能只需：

1. 继承 `Skill` 基类
2. 实现 `_setup_params()` 和 `_execute()`
3. 注册到 Registry

```python
from agent_service.skills import Skill, SkillResult, SkillStatus, ParamSpec, ParamType

class MyCustomSkill(Skill):
    name = "my_custom_skill"
    description = "我的自定义技能"
    category = "custom"
    
    def _setup_params(self):
        self.add_param(ParamSpec(
            name="input",
            param_type=ParamType.STRING,
            description="输入参数",
            required=True
        ))
    
    async def _execute(self, context, **params):
        # 执行逻辑
        return SkillResult(
            status=SkillStatus.SUCCESS,
            skill_name=self.name,
            output={"result": "done"},
            message="执行成功"
        )

# 注册
from agent_service.skills import register_skill
register_skill(MyCustomSkill())
```

## 与 Tri-Space 框架的集成

Skills 系统与三维上下文融合框架集成：

1. **Platform Modeling**: 通过 SkillRegistry 暴露平台能力
2. **User Modeling**: SkillRouter 根据 UserVibe 选择技能
3. **Agent Modeling**: 技能描述注入到 System Prompt

```
用户消息 → PerceptionAlignmentLoop → UserVibe
                    ↓
           SkillRouter.route()
                    ↓
         SkillRegistry.get_by_category(vibe相关类别)
                    ↓
              Skill.execute()
                    ↓
              SkillResult → 前端动作 / Agent 响应
```

## 测试

运行测试脚本：

```bash
cd /Users/zms/Documents/Projects/OpenGMS-Jupyter/agent-service
python test_skills.py
```

预期输出：
```
✅ 技能注册表: PASS
✅ 技能参数规格: PASS
✅ 技能执行: PASS
✅ 技能路由器: PASS
✅ 工具描述生成: PASS
✅ 前置条件检查: PASS
```
