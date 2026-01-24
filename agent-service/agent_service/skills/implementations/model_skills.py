"""
模型调用技能
包含完整的模型调用流程
"""

import asyncio
import aiohttp
from typing import Dict, Any, List, Optional
from dataclasses import dataclass, field
from enum import Enum

from ..base import Skill, SkillContext, SkillResult, SkillStatus, ParamSpec, ParamType


class ModelInvocationStatus(Enum):
    """模型调用状态"""
    PREPARING = "preparing"
    UPLOADING = "uploading"
    QUEUED = "queued"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"


@dataclass
class InvocationProgress:
    """调用进度"""
    status: ModelInvocationStatus
    progress_percent: int = 0
    message: str = ""
    task_id: Optional[str] = None


class InvokeModelSkill(Skill):
    """
    调用 OpenGMS 模型
    这是一个复合技能，包含完整的调用流程
    """
    
    name = "invoke_model"
    description = "调用 OpenGMS 地理模型进行计算，包括数据上传、任务提交和结果获取"
    category = "model"
    requires_frontend = False
    
    def _setup_params(self):
        self.add_param(ParamSpec(
            name="model_id",
            param_type=ParamType.STRING,
            description="要调用的模型 ID",
            required=True
        ))
        self.add_param(ParamSpec(
            name="inputs",
            param_type=ParamType.JSON,
            description="模型输入参数，格式为 {参数名: 值}",
            required=True
        ))
        self.add_param(ParamSpec(
            name="wait_for_result",
            param_type=ParamType.BOOLEAN,
            description="是否等待结果（否则立即返回任务 ID）",
            required=False,
            default=True
        ))
        self.add_param(ParamSpec(
            name="timeout_seconds",
            param_type=ParamType.NUMBER,
            description="等待超时时间（秒）",
            required=False,
            default=300
        ))
    
    async def _execute(self, context: SkillContext, **params) -> SkillResult:
        model_id = params.get("model_id")
        inputs = params.get("inputs", {})
        wait_for_result = params.get("wait_for_result", True)
        timeout = params.get("timeout_seconds", 300)
        
        try:
            # Step 1: 验证模型信息
            model_info = await self._get_model_info(model_id, context)
            if not model_info:
                return SkillResult(
                    status=SkillStatus.FAILED,
                    skill_name=self.name,
                    error=f"模型 '{model_id}' 不存在",
                    message=f"无法找到模型 '{model_id}'"
                )
            
            # Step 2: 验证输入参数
            validation_result = self._validate_inputs(model_info, inputs)
            if not validation_result["valid"]:
                return SkillResult(
                    status=SkillStatus.PARAM_INVALID,
                    skill_name=self.name,
                    error=validation_result["error"],
                    message=f"输入参数验证失败: {validation_result['error']}",
                    needs_input=True,
                    input_prompt="请提供正确的输入参数",
                    input_options=validation_result.get("missing_params", [])
                )
            
            # Step 3: 上传数据文件（如有）
            upload_result = await self._upload_files(inputs, context)
            if upload_result.get("error"):
                return SkillResult(
                    status=SkillStatus.FAILED,
                    skill_name=self.name,
                    error=upload_result["error"],
                    message=f"文件上传失败: {upload_result['error']}"
                )
            
            # 更新 inputs 中的文件路径为上传后的 URL
            processed_inputs = {**inputs, **upload_result.get("uploaded", {})}
            
            # Step 4: 提交任务
            task_id = await self._submit_task(model_id, processed_inputs, context)
            
            if not wait_for_result:
                return SkillResult(
                    status=SkillStatus.SUCCESS,
                    skill_name=self.name,
                    output={"task_id": task_id, "status": "submitted"},
                    message=f"任务已提交，任务ID: {task_id}"
                )
            
            # Step 5: 等待结果
            result = await self._wait_for_completion(task_id, timeout, context)
            
            return SkillResult(
                status=SkillStatus.SUCCESS if result["status"] == "completed" else SkillStatus.FAILED,
                skill_name=self.name,
                output=result,
                message=f"模型执行{'完成' if result['status'] == 'completed' else '失败'}"
            )
            
        except asyncio.TimeoutError:
            return SkillResult(
                status=SkillStatus.FAILED,
                skill_name=self.name,
                error="执行超时",
                message=f"模型执行超时（{timeout}秒）"
            )
        except Exception as e:
            return SkillResult(
                status=SkillStatus.FAILED,
                skill_name=self.name,
                error=str(e),
                message=f"模型调用失败: {e}"
            )
    
    async def _get_model_info(self, model_id: str, context: SkillContext) -> Optional[Dict]:
        """获取模型信息"""
        # 检查缓存
        if context.has_model_info(model_id):
            return context.get_model_info(model_id)
        
        # 模拟获取模型信息
        # 实际实现应该调用 API
        return {
            "id": model_id,
            "name": f"Model {model_id}",
            "inputs": [
                {"name": "input_data", "type": "file", "required": True},
                {"name": "parameter1", "type": "number", "required": False, "default": 100}
            ],
            "outputs": [
                {"name": "result", "type": "file"}
            ]
        }
    
    def _validate_inputs(self, model_info: Dict, inputs: Dict) -> Dict:
        """验证输入参数"""
        missing = []
        
        for input_spec in model_info.get("inputs", []):
            if input_spec.get("required", False):
                if input_spec["name"] not in inputs:
                    missing.append(input_spec["name"])
        
        if missing:
            return {
                "valid": False,
                "error": f"缺少必需参数: {', '.join(missing)}",
                "missing_params": missing
            }
        
        return {"valid": True}
    
    async def _upload_files(self, inputs: Dict, context: SkillContext) -> Dict:
        """上传文件输入"""
        uploaded = {}
        
        for key, value in inputs.items():
            if isinstance(value, str) and (value.endswith('.shp') or value.endswith('.geojson')):
                # 模拟文件上传
                # 实际实现应该调用上传 API
                uploaded[key] = f"https://geomodeling.njnu.edu.cn/uploads/{key}_uploaded"
        
        return {"uploaded": uploaded}
    
    async def _submit_task(self, model_id: str, inputs: Dict, context: SkillContext) -> str:
        """提交任务"""
        # 模拟任务提交
        # 实际实现应该调用 API
        import uuid
        return str(uuid.uuid4())
    
    async def _wait_for_completion(self, task_id: str, timeout: int, context: SkillContext) -> Dict:
        """等待任务完成"""
        # 模拟等待
        # 实际实现应该轮询任务状态
        await asyncio.sleep(0.5)  # 模拟等待
        
        return {
            "task_id": task_id,
            "status": "completed",
            "outputs": {
                "result": f"https://geomodeling.njnu.edu.cn/results/{task_id}/result.geojson"
            },
            "execution_time": 120
        }


class CheckTaskStatusSkill(Skill):
    """
    检查任务状态
    """
    
    name = "check_task_status"
    description = "检查模型计算任务的执行状态"
    category = "model"
    requires_frontend = False
    
    def _setup_params(self):
        self.add_param(ParamSpec(
            name="task_id",
            param_type=ParamType.STRING,
            description="任务 ID",
            required=True
        ))
    
    async def _execute(self, context: SkillContext, **params) -> SkillResult:
        task_id = params.get("task_id")
        
        # 模拟状态查询
        status = {
            "task_id": task_id,
            "status": "running",
            "progress": 65,
            "message": "正在计算中...",
            "started_at": "2024-01-01T10:00:00Z",
            "estimated_completion": "2024-01-01T10:05:00Z"
        }
        
        return SkillResult(
            status=SkillStatus.SUCCESS,
            skill_name=self.name,
            output=status,
            message=f"任务状态: {status['status']} ({status['progress']}%)"
        )


class DownloadResultSkill(Skill):
    """
    下载模型结果
    """
    
    name = "download_result"
    description = "下载模型计算结果到本地"
    category = "model"
    requires_frontend = False
    
    def _setup_params(self):
        self.add_param(ParamSpec(
            name="task_id",
            param_type=ParamType.STRING,
            description="任务 ID",
            required=True
        ))
        self.add_param(ParamSpec(
            name="output_name",
            param_type=ParamType.STRING,
            description="输出名称（模型定义的输出参数名）",
            required=False
        ))
        self.add_param(ParamSpec(
            name="save_path",
            param_type=ParamType.FILE_PATH,
            description="保存路径",
            required=False
        ))
    
    async def _execute(self, context: SkillContext, **params) -> SkillResult:
        task_id = params.get("task_id")
        output_name = params.get("output_name", "result")
        save_path = params.get("save_path")
        
        # 模拟下载
        if not save_path:
            save_path = f"{context.working_directory}/{task_id}_{output_name}.geojson"
        
        # 实际实现应该下载文件
        download_info = {
            "url": f"https://geomodeling.njnu.edu.cn/results/{task_id}/{output_name}",
            "saved_to": save_path,
            "size": "2.5 MB"
        }
        
        return SkillResult(
            status=SkillStatus.SUCCESS,
            skill_name=self.name,
            output=download_info,
            message=f"结果已保存到: {save_path}"
        )
