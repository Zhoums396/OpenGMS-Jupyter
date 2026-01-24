"""
Skill 基类和核心数据结构
定义可执行技能的抽象接口
"""

from abc import ABC, abstractmethod
from typing import Dict, List, Any, Optional, Union
from dataclasses import dataclass, field
from enum import Enum
from datetime import datetime


class SkillStatus(Enum):
    """技能执行状态"""
    SUCCESS = "success"
    FAILED = "failed"
    PENDING = "pending"
    PRECONDITION_FAILED = "precondition_failed"
    PARAM_INVALID = "param_invalid"
    NEEDS_USER_INPUT = "needs_user_input"


class ParamType(Enum):
    """参数类型"""
    STRING = "string"
    NUMBER = "number"
    BOOLEAN = "boolean"
    FILE_PATH = "file_path"
    FILE_LIST = "file_list"
    CODE = "code"
    JSON = "json"
    ENUM = "enum"


@dataclass
class ParamSpec:
    """参数规格定义"""
    name: str
    param_type: ParamType
    description: str
    required: bool = True
    default: Any = None
    enum_values: List[str] = field(default_factory=list)  # 如果是 ENUM 类型
    
    def validate(self, value: Any) -> tuple[bool, str]:
        """验证参数值"""
        if value is None:
            if self.required and self.default is None:
                return False, f"参数 '{self.name}' 是必需的"
            return True, ""
        
        # 类型检查
        if self.param_type == ParamType.STRING:
            if not isinstance(value, str):
                return False, f"参数 '{self.name}' 应该是字符串"
        elif self.param_type == ParamType.NUMBER:
            if not isinstance(value, (int, float)):
                return False, f"参数 '{self.name}' 应该是数字"
        elif self.param_type == ParamType.BOOLEAN:
            if not isinstance(value, bool):
                return False, f"参数 '{self.name}' 应该是布尔值"
        elif self.param_type == ParamType.ENUM:
            if value not in self.enum_values:
                return False, f"参数 '{self.name}' 应该是 {self.enum_values} 之一"
        
        return True, ""


@dataclass
class SkillContext:
    """
    技能执行上下文
    包含执行技能所需的所有环境信息
    """
    # 用户信息
    user_id: str = ""
    user_name: str = ""
    user_vibe: str = "uncertain"        # 用户当前状态
    
    # Notebook 状态
    notebook_active: bool = False
    notebook_name: str = ""
    current_cell_code: str = ""
    
    # 工作目录
    working_directory: str = ""
    available_files: Dict[str, List[Dict]] = field(default_factory=dict)
    # {"vector": [...], "raster": [...], "table": [...]}
    
    # 模型信息缓存
    model_info_cache: Dict[str, Dict] = field(default_factory=dict)
    
    # 执行历史
    last_error: Optional[str] = None
    last_output: Optional[str] = None
    execution_history: List[Dict] = field(default_factory=list)
    
    # 平台配置
    ogms_token: str = ""
    api_base_url: str = ""
    
    def has_file_type(self, file_type: str) -> bool:
        """检查是否有指定类型的文件"""
        files = self.available_files.get(file_type, [])
        return len(files) > 0
    
    def get_files_by_type(self, file_type: str) -> List[Dict]:
        """获取指定类型的文件列表"""
        return self.available_files.get(file_type, [])
    
    def has_model_info(self, model_name: str) -> bool:
        """检查是否有模型信息缓存"""
        return model_name in self.model_info_cache
    
    def get_model_info(self, model_name: str) -> Optional[Dict]:
        """获取缓存的模型信息"""
        return self.model_info_cache.get(model_name)
    
    def cache_model_info(self, model_name: str, info: Dict):
        """缓存模型信息"""
        self.model_info_cache[model_name] = info


@dataclass
class SkillResult:
    """技能执行结果"""
    status: SkillStatus
    skill_name: str
    
    # 输出
    output: Any = None                  # 主要输出
    message: str = ""                   # 人类可读消息
    
    # 如果需要前端执行
    frontend_action: Optional[Dict] = None
    # {"type": "add_code_cell", "code": "..."}
    
    # 如果需要继续执行其他技能
    next_skills: List[str] = field(default_factory=list)
    next_params: Dict[str, Any] = field(default_factory=dict)
    
    # 如果需要用户输入
    needs_input: bool = False
    input_prompt: str = ""
    input_options: List[str] = field(default_factory=list)
    
    # 错误信息
    error: Optional[str] = None
    error_diagnosis: Optional[str] = None
    suggested_fixes: List[str] = field(default_factory=list)
    
    # 元数据
    execution_time_ms: int = 0
    timestamp: datetime = field(default_factory=datetime.now)
    
    @property
    def is_success(self) -> bool:
        return self.status == SkillStatus.SUCCESS
    
    @property
    def needs_frontend(self) -> bool:
        return self.frontend_action is not None
    
    def to_dict(self) -> Dict:
        """转换为字典"""
        return {
            "status": self.status.value,
            "skill_name": self.skill_name,
            "output": self.output,
            "message": self.message,
            "frontend_action": self.frontend_action,
            "error": self.error,
            "needs_input": self.needs_input,
            "input_prompt": self.input_prompt
        }


class Skill(ABC):
    """
    技能基类
    所有具体技能必须继承此类并实现抽象方法
    """
    
    # 技能元信息（子类覆盖）
    name: str = "base_skill"
    description: str = "Base skill"
    category: str = "general"
    
    # 是否需要前端执行
    requires_frontend: bool = False
    
    def __init__(self):
        self._param_specs: List[ParamSpec] = []
        self._setup_params()
    
    @abstractmethod
    def _setup_params(self):
        """子类实现：定义参数规格"""
        pass
    
    @abstractmethod
    async def _execute(self, context: SkillContext, **params) -> SkillResult:
        """子类实现：执行技能的核心逻辑"""
        pass
    
    def get_param_specs(self) -> List[ParamSpec]:
        """获取参数规格列表"""
        return self._param_specs
    
    def add_param(self, spec: ParamSpec):
        """添加参数规格"""
        self._param_specs.append(spec)
    
    def validate_params(self, **params) -> tuple[bool, List[str]]:
        """验证所有参数"""
        errors = []
        
        for spec in self._param_specs:
            value = params.get(spec.name, spec.default)
            valid, error = spec.validate(value)
            if not valid:
                errors.append(error)
        
        return len(errors) == 0, errors
    
    def check_preconditions(self, context: SkillContext) -> tuple[bool, str]:
        """
        检查前置条件
        子类可以覆盖此方法添加特定的前置条件检查
        """
        return True, ""
    
    async def execute(self, context: SkillContext, **params) -> SkillResult:
        """
        执行技能的主入口
        处理参数验证、前置条件检查、执行、错误处理
        """
        import time
        start_time = time.time()
        
        # 1. 验证参数
        valid, errors = self.validate_params(**params)
        if not valid:
            return SkillResult(
                status=SkillStatus.PARAM_INVALID,
                skill_name=self.name,
                error="; ".join(errors),
                message=f"参数验证失败: {'; '.join(errors)}"
            )
        
        # 2. 检查前置条件
        precond_ok, precond_error = self.check_preconditions(context)
        if not precond_ok:
            return SkillResult(
                status=SkillStatus.PRECONDITION_FAILED,
                skill_name=self.name,
                error=precond_error,
                message=f"前置条件不满足: {precond_error}"
            )
        
        # 3. 执行技能
        try:
            result = await self._execute(context, **params)
            result.execution_time_ms = int((time.time() - start_time) * 1000)
            return result
        except Exception as e:
            return SkillResult(
                status=SkillStatus.FAILED,
                skill_name=self.name,
                error=str(e),
                message=f"技能执行失败: {str(e)}",
                execution_time_ms=int((time.time() - start_time) * 1000)
            )
    
    def to_tool_description(self) -> str:
        """生成用于 LLM 的工具描述"""
        desc = f"**{self.name}**: {self.description}\n"
        
        if self._param_specs:
            desc += "参数:\n"
            for spec in self._param_specs:
                required = "必需" if spec.required else "可选"
                desc += f"  - {spec.name} ({spec.param_type.value}, {required}): {spec.description}\n"
        
        return desc
    
    def __repr__(self):
        return f"<Skill: {self.name}>"
