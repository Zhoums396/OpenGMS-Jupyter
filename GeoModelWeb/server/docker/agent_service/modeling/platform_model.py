"""
Platform Modeling: "The Space of Possibility"
平台建模：定义 Agent "能做什么" 以及 "在哪做"

核心概念：
- Service Affordances: 服务化能力（GIS工具抽象为原子能力）
- Data Topology: 数据拓扑（数据中心目录树、变量依赖图）
- Constraints: 计算约束（内存、超时、坐标系兼容性）

参考：
- Xiong et al. (2023): Sensors/Actuators 概念
- Lau & Guo: Design Space 的 Input/Output 形式
"""

from typing import Dict, List, Optional, Any, Set
from dataclasses import dataclass, field
from enum import Enum
import json


class DataType(Enum):
    """数据类型枚举"""
    VECTOR = "vector"           # 矢量数据 (shp, geojson)
    RASTER = "raster"           # 栅格数据 (tif, img)
    TABLE = "table"             # 表格数据 (csv, xlsx)
    MODEL_OUTPUT = "model_output"  # 模型输出
    VARIABLE = "variable"       # Kernel 变量
    OTHER = "other"


class CoordinateSystem(Enum):
    """坐标系枚举"""
    WGS84 = "EPSG:4326"         # 地理坐标系
    WEB_MERCATOR = "EPSG:3857"  # Web 墨卡托
    UTM = "UTM"                 # UTM 投影
    LOCAL = "LOCAL"             # 本地坐标系
    UNKNOWN = "UNKNOWN"


@dataclass
class ServiceAffordance:
    """
    服务化能力 (Service Affordance)
    将 GIS 工具抽象为标准化的原子能力
    """
    name: str                           # 服务名称
    description: str                    # 服务描述
    category: str                       # 分类 (analysis, io, transform, model)
    
    # 输入输出规范
    input_types: List[DataType]         # 可接受的输入类型
    output_types: List[DataType]        # 输出类型
    required_params: List[str]          # 必需参数
    optional_params: List[str] = field(default_factory=list)
    
    # 约束条件
    requires_projection: bool = False   # 是否需要投影坐标系
    supported_crs: List[CoordinateSystem] = field(default_factory=list)
    max_file_size_mb: Optional[int] = None
    
    # 元信息
    execution_location: str = "backend"  # backend / frontend / remote
    estimated_time_seconds: Optional[int] = None
    
    def to_tool_description(self) -> str:
        """生成用于 LLM 的工具描述"""
        desc = f"{self.name}: {self.description}\n"
        desc += f"  输入: {', '.join([t.value for t in self.input_types])}\n"
        desc += f"  输出: {', '.join([t.value for t in self.output_types])}\n"
        if self.requires_projection:
            desc += f"  ⚠️ 需要投影坐标系\n"
        return desc


@dataclass
class DataNode:
    """
    数据节点 - 数据拓扑图中的节点
    """
    id: str                             # 唯一标识
    name: str                           # 显示名称
    path: str                           # 文件路径或变量名
    data_type: DataType                 # 数据类型
    
    # 空间属性
    crs: Optional[CoordinateSystem] = None
    extent: Optional[Dict[str, float]] = None  # {"minx", "miny", "maxx", "maxy"}
    
    # 元数据
    size_bytes: int = 0
    schema: Optional[Dict[str, str]] = None   # 字段名 -> 类型
    
    # 依赖关系
    derived_from: List[str] = field(default_factory=list)  # 来源数据 ID
    used_by: List[str] = field(default_factory=list)       # 被哪些数据使用


@dataclass
class PlatformConstraint:
    """
    平台约束
    """
    name: str
    constraint_type: str                # memory, timeout, crs, format
    value: Any
    description: str
    is_hard: bool = True                # 硬约束 vs 软约束


@dataclass
class PlatformModel:
    """
    平台模型 - 完整的平台能力描述
    """
    # 功能空间 (Action Space)
    services: Dict[str, ServiceAffordance] = field(default_factory=dict)
    
    # 资源空间 (Resource Space)
    data_topology: Dict[str, DataNode] = field(default_factory=dict)
    
    # 约束空间 (Constraint Space)
    constraints: List[PlatformConstraint] = field(default_factory=list)
    
    # 当前状态
    kernel_variables: Dict[str, Any] = field(default_factory=dict)  # Jupyter Kernel 变量
    active_tasks: List[str] = field(default_factory=list)           # 正在执行的任务
    
    def add_service(self, service: ServiceAffordance):
        """注册服务能力"""
        self.services[service.name] = service
    
    def add_data_node(self, node: DataNode):
        """添加数据节点"""
        self.data_topology[node.id] = node
    
    def get_compatible_services(self, data_node: DataNode) -> List[ServiceAffordance]:
        """获取与给定数据兼容的服务"""
        compatible = []
        for service in self.services.values():
            if data_node.data_type in service.input_types:
                # 检查坐标系约束
                if service.requires_projection and data_node.crs == CoordinateSystem.WGS84:
                    continue  # 需要投影但数据是地理坐标系
                compatible.append(service)
        return compatible
    
    def find_constraint_violations(self, service: ServiceAffordance, 
                                   input_data: List[DataNode]) -> List[str]:
        """检查执行服务时可能违反的约束"""
        violations = []
        
        for data in input_data:
            # 检查坐标系约束
            if service.requires_projection:
                if data.crs == CoordinateSystem.WGS84:
                    violations.append(
                        f"数据 '{data.name}' 使用地理坐标系(WGS84)，"
                        f"服务 '{service.name}' 需要投影坐标系，需先执行坐标转换"
                    )
            
            # 检查文件大小约束
            if service.max_file_size_mb:
                size_mb = data.size_bytes / (1024 * 1024)
                if size_mb > service.max_file_size_mb:
                    violations.append(
                        f"数据 '{data.name}' ({size_mb:.1f}MB) 超过服务限制 "
                        f"({service.max_file_size_mb}MB)"
                    )
        
        return violations
    
    def get_data_lineage(self, data_id: str) -> List[DataNode]:
        """获取数据血缘（数据是如何产生的）"""
        lineage = []
        node = self.data_topology.get(data_id)
        if node:
            lineage.append(node)
            for parent_id in node.derived_from:
                lineage.extend(self.get_data_lineage(parent_id))
        return lineage
    
    def to_context_string(self) -> str:
        """生成用于 LLM 的上下文描述"""
        ctx = "## 平台能力 (Platform Affordances)\n\n"
        
        # 服务能力
        ctx += "### 可用服务\n"
        for name, service in self.services.items():
            ctx += f"- **{name}**: {service.description}\n"
        
        # 数据资源
        ctx += "\n### 数据资源\n"
        for data_type in DataType:
            nodes = [n for n in self.data_topology.values() if n.data_type == data_type]
            if nodes:
                ctx += f"\n**{data_type.value}** ({len(nodes)} 个):\n"
                for node in nodes[:10]:  # 限制数量
                    crs_info = f" [{node.crs.value}]" if node.crs else ""
                    ctx += f"- `{node.path}`{crs_info}\n"
        
        # 约束
        ctx += "\n### 平台约束\n"
        for constraint in self.constraints:
            ctx += f"- {constraint.description}\n"
        
        return ctx


# ==================== 平台服务注册 ====================

def create_default_platform_model() -> PlatformModel:
    """创建默认的平台模型，注册所有可用服务"""
    platform = PlatformModel()
    
    # 注册 OGMS 模型调用服务
    platform.add_service(ServiceAffordance(
        name="ogms_model_invoke",
        description="调用 OpenGMS 地理计算模型",
        category="model",
        input_types=[DataType.VECTOR, DataType.RASTER, DataType.TABLE],
        output_types=[DataType.MODEL_OUTPUT],
        required_params=["model_name", "input_params"],
        execution_location="remote",
        estimated_time_seconds=300
    ))
    
    # 注册数据方法服务
    platform.add_service(ServiceAffordance(
        name="data_method_invoke",
        description="调用数据处理方法（Buffer, Intersect 等）",
        category="analysis",
        input_types=[DataType.VECTOR, DataType.RASTER],
        output_types=[DataType.VECTOR, DataType.RASTER],
        required_params=["method_name", "input_data"],
        requires_projection=True,  # GIS 分析通常需要投影坐标系
        execution_location="remote"
    ))
    
    # 注册 Notebook 操作服务
    platform.add_service(ServiceAffordance(
        name="add_code_cell",
        description="向 Notebook 添加并运行代码单元格",
        category="io",
        input_types=[],
        output_types=[DataType.VARIABLE],
        required_params=["code"],
        execution_location="frontend"
    ))
    
    platform.add_service(ServiceAffordance(
        name="add_markdown_cell",
        description="向 Notebook 添加 Markdown 说明",
        category="io",
        input_types=[],
        output_types=[],
        required_params=["content"],
        execution_location="frontend"
    ))
    
    # 注册默认约束
    platform.constraints = [
        PlatformConstraint(
            name="memory_limit",
            constraint_type="memory",
            value=4096,  # MB
            description="Jupyter Kernel 内存限制: 4GB"
        ),
        PlatformConstraint(
            name="timeout_limit",
            constraint_type="timeout",
            value=600,  # seconds
            description="模型执行超时限制: 10分钟"
        ),
        PlatformConstraint(
            name="crs_for_analysis",
            constraint_type="crs",
            value="projected",
            description="GIS 空间分析需要投影坐标系（非 WGS84）"
        )
    ]
    
    return platform
