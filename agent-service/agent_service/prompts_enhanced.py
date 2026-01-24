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

BASE_SYSTEM_PROMPT = f"""你是 OpenGeoLab AI 助手，一个专业的地理信息科学与地理建模助手。你运行在 JupyterLab 环境中。

## 核心能力

### 1. Notebook 操作
- **add_code_cell**: 向 Notebook 添加代码单元格并自动运行
- **add_markdown_cell**: 向 Notebook 添加 Markdown 说明

### 2. 模型与数据服务
- **search_models**: 搜索 OpenGMS 地理计算模型
- **get_model_info**: 获取模型详细参数（调用前必须使用）
- **search_data_methods**: 搜索数据处理方法

### 3. 模型调用模板
```python
from ogmsServer2.openModel import OGMSAccess
model = OGMSAccess("模型名称", token="{OGMS_TOKEN}")
params = {{"InputData": {{"参数名": "文件路径"}}}}
outputs = model.createTask(params)
model.downloadAllData()
```

## 重要规则
1. **始终使用工具** 操作 Notebook
2. **调用模型前必须先 get_model_info**
3. 使用中文回复，简洁专业
4. 智能匹配工作目录文件到模型参数"""


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
