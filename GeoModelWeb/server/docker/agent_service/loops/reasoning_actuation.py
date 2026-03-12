"""
Reasoning-Actuation Loop (推理-执行循环)
连接：Agent ↔ Platform

核心功能：
1. Resource Grounding (落地)：扫描平台状态，匹配资源
2. Constraint Solving (求解)：检测并解决约束冲突
3. Execution (执行)：调用平台 API

参考：
- Xiong et al. (2023): AutoAgent 的 Actuation 逻辑
- 精确操作与错误处理
"""

from typing import Dict, Any, Optional, List, Tuple
from dataclasses import dataclass, field
from enum import Enum

from ..modeling.platform_model import (
    PlatformModel, ServiceAffordance, DataNode, DataType, CoordinateSystem
)
from ..modeling.agent_model import (
    AgentModel, ExecutionPlan, PlanStep, Skill
)


class GroundingStatus(Enum):
    """资源落地状态"""
    READY = "ready"                     # 资源就绪
    MISSING_DATA = "missing_data"       # 缺少数据
    CONSTRAINT_VIOLATION = "constraint_violation"  # 约束冲突
    NEEDS_TRANSFORM = "needs_transform" # 需要转换


class ExecutionStatus(Enum):
    """执行状态"""
    SUCCESS = "success"
    FAILED = "failed"
    PENDING = "pending"
    NEEDS_USER_INPUT = "needs_user_input"


@dataclass
class ResourceMatch:
    """资源匹配结果"""
    param_name: str                     # 参数名
    matched_resource: Optional[DataNode]  # 匹配到的资源
    match_confidence: float             # 匹配置信度
    match_reason: str                   # 匹配原因


@dataclass
class ConstraintViolation:
    """约束违反"""
    constraint_name: str
    description: str
    severity: str                       # error / warning
    suggested_fix: Optional[str] = None
    auto_fixable: bool = False


@dataclass
class GroundingResult:
    """落地结果"""
    status: GroundingStatus
    
    # 资源匹配
    resource_matches: List[ResourceMatch] = field(default_factory=list)
    missing_resources: List[str] = field(default_factory=list)
    
    # 约束检查
    violations: List[ConstraintViolation] = field(default_factory=list)
    
    # 建议的修复操作
    suggested_transforms: List[Dict[str, Any]] = field(default_factory=list)
    
    @property
    def is_ready(self) -> bool:
        """是否可以直接执行"""
        return (self.status == GroundingStatus.READY and 
                len(self.missing_resources) == 0 and
                not any(v.severity == "error" for v in self.violations))


@dataclass 
class ExecutionResult:
    """执行结果"""
    status: ExecutionStatus
    output: Optional[Any] = None
    error_message: Optional[str] = None
    execution_time_ms: int = 0
    
    # 用于错误诊断
    diagnosis: Optional[str] = None
    suggested_fixes: List[str] = field(default_factory=list)


class ReasoningActuationLoop:
    """
    推理-执行循环
    
    工作流程：
    1. Resource Grounding: 将抽象需求映射到具体资源
    2. Constraint Solving: 检测并解决约束冲突
    3. Plan Generation: 生成执行计划
    4. Execution: 执行并处理反馈
    """
    
    def __init__(self, platform: PlatformModel, agent: AgentModel):
        self.platform = platform
        self.agent = agent
    
    def ground_resources(self, 
                        service_name: str,
                        required_params: Dict[str, str]) -> GroundingResult:
        """
        资源落地：将服务参数映射到实际数据资源
        
        Args:
            service_name: 服务名称
            required_params: 参数名 -> 期望描述
            
        Returns:
            GroundingResult
        """
        result = GroundingResult(status=GroundingStatus.READY)
        
        service = self.platform.services.get(service_name)
        if not service:
            result.status = GroundingStatus.MISSING_DATA
            result.missing_resources.append(f"未知服务: {service_name}")
            return result
        
        # 为每个参数寻找匹配的资源
        for param_name, param_description in required_params.items():
            match = self._find_best_match(param_name, param_description, service)
            result.resource_matches.append(match)
            
            if match.matched_resource is None:
                result.missing_resources.append(param_name)
        
        # 检查约束
        if result.resource_matches:
            matched_data = [m.matched_resource for m in result.resource_matches 
                          if m.matched_resource]
            violations = self._check_constraints(service, matched_data)
            result.violations = violations
            
            # 如果有约束冲突，生成修复建议
            for violation in violations:
                if violation.auto_fixable:
                    transform = self._generate_transform(violation)
                    if transform:
                        result.suggested_transforms.append(transform)
        
        # 更新状态
        if result.missing_resources:
            result.status = GroundingStatus.MISSING_DATA
        elif any(v.severity == "error" for v in result.violations):
            if result.suggested_transforms:
                result.status = GroundingStatus.NEEDS_TRANSFORM
            else:
                result.status = GroundingStatus.CONSTRAINT_VIOLATION
        
        return result
    
    def _find_best_match(self, 
                        param_name: str, 
                        param_description: str,
                        service: ServiceAffordance) -> ResourceMatch:
        """
        智能匹配参数到数据资源
        """
        best_match = None
        best_score = 0.0
        best_reason = ""
        
        # 提取参数名中的关键词
        keywords = self._extract_keywords(param_name, param_description)
        
        for node in self.platform.data_topology.values():
            # 检查数据类型是否兼容
            if node.data_type not in service.input_types:
                continue
            
            # 计算匹配分数
            score, reason = self._calculate_match_score(node, keywords, param_name)
            
            if score > best_score:
                best_score = score
                best_match = node
                best_reason = reason
        
        return ResourceMatch(
            param_name=param_name,
            matched_resource=best_match,
            match_confidence=best_score,
            match_reason=best_reason if best_match else "未找到匹配的数据文件"
        )
    
    def _extract_keywords(self, param_name: str, description: str) -> List[str]:
        """提取匹配关键词"""
        keywords = []
        
        # 从参数名提取
        # input-firstYearImage -> first, year, image
        parts = param_name.replace("-", "_").replace("input_", "").split("_")
        keywords.extend([p.lower() for p in parts if len(p) > 2])
        
        # 从描述提取
        desc_words = description.lower().split()
        keywords.extend([w for w in desc_words if len(w) > 3])
        
        return list(set(keywords))
    
    def _calculate_match_score(self, 
                              node: DataNode, 
                              keywords: List[str],
                              param_name: str) -> Tuple[float, str]:
        """计算匹配分数"""
        score = 0.0
        reasons = []
        
        node_name_lower = node.name.lower()
        
        # 关键词匹配
        for kw in keywords:
            if kw in node_name_lower:
                score += 0.3
                reasons.append(f"名称包含'{kw}'")
        
        # 文件扩展名匹配
        type_extensions = {
            DataType.RASTER: [".tif", ".tiff", ".img"],
            DataType.VECTOR: [".shp", ".geojson", ".gpkg"],
            DataType.TABLE: [".csv", ".xlsx", ".xls"]
        }
        expected_exts = type_extensions.get(node.data_type, [])
        if any(node.name.lower().endswith(ext) for ext in expected_exts):
            score += 0.2
            reasons.append("扩展名匹配")
        
        # 参数名相似度
        param_keywords = param_name.lower().replace("-", "").replace("_", "")
        node_keywords = node.name.lower().replace("-", "").replace("_", "").replace(".", "")
        
        # 简单的子串匹配
        if param_keywords in node_keywords or node_keywords in param_keywords:
            score += 0.3
            reasons.append("名称相似")
        
        # 限制最大分数
        score = min(score, 1.0)
        
        return score, "; ".join(reasons) if reasons else "弱匹配"
    
    def _check_constraints(self, 
                          service: ServiceAffordance,
                          data_nodes: List[DataNode]) -> List[ConstraintViolation]:
        """检查约束条件"""
        violations = []
        
        for node in data_nodes:
            # 检查坐标系约束
            if service.requires_projection:
                if node.crs == CoordinateSystem.WGS84:
                    violations.append(ConstraintViolation(
                        constraint_name="crs_projection",
                        description=f"数据 '{node.name}' 使用地理坐标系(WGS84)，"
                                   f"但 '{service.name}' 需要投影坐标系",
                        severity="error",
                        suggested_fix="在分析前添加坐标转换步骤 (reproject)",
                        auto_fixable=True
                    ))
            
            # 检查文件大小
            if service.max_file_size_mb:
                size_mb = node.size_bytes / (1024 * 1024)
                if size_mb > service.max_file_size_mb:
                    violations.append(ConstraintViolation(
                        constraint_name="file_size",
                        description=f"数据 '{node.name}' ({size_mb:.1f}MB) "
                                   f"超过限制 ({service.max_file_size_mb}MB)",
                        severity="warning",
                        suggested_fix="考虑裁剪或降采样"
                    ))
        
        return violations
    
    def _generate_transform(self, violation: ConstraintViolation) -> Optional[Dict]:
        """生成修复转换操作"""
        if violation.constraint_name == "crs_projection":
            return {
                "type": "reproject",
                "description": "坐标系转换",
                "code_template": """
# 坐标转换
import geopandas as gpd
gdf = gpd.read_file("{input_file}")
gdf_projected = gdf.to_crs("EPSG:3857")  # 转为 Web Mercator
gdf_projected.to_file("{output_file}")
"""
            }
        return None
    
    def solve_constraints(self, grounding: GroundingResult) -> List[PlanStep]:
        """
        约束求解：生成解决约束冲突的步骤
        """
        solve_steps = []
        
        for i, transform in enumerate(grounding.suggested_transforms):
            step = PlanStep(
                step_id=i,
                skill_name="transform",
                description=transform.get("description", "数据转换"),
                inputs={"transform_type": transform.get("type")},
                expected_outputs=["transformed_data"]
            )
            solve_steps.append(step)
        
        return solve_steps
    
    def create_execution_plan(self, 
                             goal: str,
                             service_name: str,
                             grounding: GroundingResult) -> ExecutionPlan:
        """
        创建执行计划
        """
        steps = []
        step_id = 0
        
        # 1. 添加约束求解步骤（如果需要）
        if grounding.suggested_transforms:
            for transform in grounding.suggested_transforms:
                steps.append(PlanStep(
                    step_id=step_id,
                    skill_name="data_transform",
                    description=f"数据预处理: {transform.get('description', '')}",
                    inputs=transform
                ))
                step_id += 1
        
        # 2. 添加主要执行步骤
        steps.append(PlanStep(
            step_id=step_id,
            skill_name=service_name,
            description=goal,
            inputs={
                m.param_name: m.matched_resource.path if m.matched_resource else None
                for m in grounding.resource_matches
            },
            depends_on=list(range(step_id)) if step_id > 0 else []
        ))
        
        plan = self.agent.create_plan(goal, [
            {
                "skill": s.skill_name,
                "description": s.description,
                "inputs": s.inputs,
                "depends_on": s.depends_on
            }
            for s in steps
        ])
        
        return plan
    
    def handle_execution_feedback(self, 
                                 result: ExecutionResult) -> Dict[str, Any]:
        """
        处理执行反馈，进行错误诊断
        """
        feedback = {
            "success": result.status == ExecutionStatus.SUCCESS,
            "needs_retry": False,
            "suggested_actions": []
        }
        
        if result.status == ExecutionStatus.FAILED:
            # 错误诊断
            error_msg = result.error_message or ""
            
            if "file not found" in error_msg.lower():
                feedback["diagnosis"] = "数据文件未找到"
                feedback["suggested_actions"].append("检查文件路径是否正确")
                feedback["suggested_actions"].append("确认文件已上传到工作目录")
            
            elif "crs" in error_msg.lower() or "projection" in error_msg.lower():
                feedback["diagnosis"] = "坐标系问题"
                feedback["suggested_actions"].append("检查输入数据的坐标系")
                feedback["suggested_actions"].append("可能需要进行坐标转换")
                feedback["needs_retry"] = True
            
            elif "memory" in error_msg.lower():
                feedback["diagnosis"] = "内存不足"
                feedback["suggested_actions"].append("尝试处理更小的数据子集")
                feedback["suggested_actions"].append("关闭其他占用内存的程序")
            
            elif "timeout" in error_msg.lower():
                feedback["diagnosis"] = "执行超时"
                feedback["suggested_actions"].append("模型执行时间过长")
                feedback["suggested_actions"].append("尝试减少数据量或简化参数")
            
            else:
                feedback["diagnosis"] = "未知错误"
                feedback["suggested_actions"].append("检查错误日志")
                feedback["suggested_actions"].append("尝试简化操作重新执行")
        
        return feedback
    
    def run(self, 
           goal: str,
           service_name: str,
           required_params: Dict[str, str]) -> Tuple[GroundingResult, Optional[ExecutionPlan]]:
        """
        运行完整的推理-执行循环（规划阶段）
        
        Returns:
            (grounding_result, execution_plan or None)
        """
        # Step 1: Resource Grounding
        grounding = self.ground_resources(service_name, required_params)
        
        # Step 2: 检查是否可以继续
        if grounding.status == GroundingStatus.MISSING_DATA:
            return grounding, None
        
        # Step 3: Create Execution Plan
        plan = self.create_execution_plan(goal, service_name, grounding)
        
        return grounding, plan
    
    def generate_grounding_prompt_section(self, grounding: GroundingResult) -> str:
        """
        生成落地结果的 Prompt 片段
        """
        sections = []
        
        sections.append("## 推理-执行分析 (Reasoning-Actuation)")
        sections.append(f"- 落地状态: **{grounding.status.value}**")
        
        # 资源匹配情况
        sections.append("\n### 资源匹配")
        for match in grounding.resource_matches:
            if match.matched_resource:
                conf = f"{match.match_confidence:.0%}"
                sections.append(
                    f"✅ `{match.param_name}` → `{match.matched_resource.path}` "
                    f"(置信度: {conf}, {match.match_reason})"
                )
            else:
                sections.append(f"❌ `{match.param_name}` → 未找到匹配")
        
        # 缺失资源
        if grounding.missing_resources:
            sections.append("\n### ⚠️ 缺失资源")
            for r in grounding.missing_resources:
                sections.append(f"- {r}")
            sections.append("\n**请告知用户需要提供这些数据**")
        
        # 约束违反
        if grounding.violations:
            sections.append("\n### ⚠️ 约束问题")
            for v in grounding.violations:
                icon = "🔴" if v.severity == "error" else "🟡"
                sections.append(f"{icon} {v.description}")
                if v.suggested_fix:
                    sections.append(f"   💡 建议: {v.suggested_fix}")
        
        # 建议的转换
        if grounding.suggested_transforms:
            sections.append("\n### 🔧 需要的预处理步骤")
            for t in grounding.suggested_transforms:
                sections.append(f"- {t.get('description', t.get('type', ''))}")
        
        return "\n".join(sections)
