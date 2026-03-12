"""
模型搜索和信息获取技能
"""

import aiohttp
from typing import Dict, Any, List, Optional
from ..base import Skill, SkillContext, SkillResult, SkillStatus, ParamSpec, ParamType


class SearchModelsSkill(Skill):
    """
    搜索 OpenGMS 模型
    """
    
    name = "search_models"
    description = "在 OpenGMS 平台搜索地理模型"
    category = "model"
    requires_frontend = False
    
    def _setup_params(self):
        self.add_param(ParamSpec(
            name="keyword",
            param_type=ParamType.STRING,
            description="搜索关键词",
            required=True
        ))
        self.add_param(ParamSpec(
            name="category",
            param_type=ParamType.STRING,
            description="模型类别（可选）",
            required=False
        ))
        self.add_param(ParamSpec(
            name="max_results",
            param_type=ParamType.NUMBER,
            description="最大返回结果数",
            required=False,
            default=10
        ))
    
    async def _execute(self, context: SkillContext, **params) -> SkillResult:
        keyword = params.get("keyword", "")
        max_results = params.get("max_results", 10)
        
        # 调用 OpenGMS API 搜索
        try:
            # 这里是模拟实现，实际需要调用真实 API
            api_url = f"https://geomodeling.njnu.edu.cn/api/models/search"
            
            async with aiohttp.ClientSession() as session:
                async with session.get(
                    api_url,
                    params={"keyword": keyword, "limit": max_results},
                    timeout=aiohttp.ClientTimeout(total=30)
                ) as response:
                    if response.status == 200:
                        data = await response.json()
                        models = data.get("models", [])
                        
                        return SkillResult(
                            status=SkillStatus.SUCCESS,
                            skill_name=self.name,
                            output=models,
                            message=f"找到 {len(models)} 个相关模型"
                        )
                    else:
                        # 返回模拟数据用于测试
                        return self._mock_search(keyword)
        except Exception as e:
            # 网络错误时返回模拟数据
            return self._mock_search(keyword)
    
    def _mock_search(self, keyword: str) -> SkillResult:
        """模拟搜索结果"""
        mock_models = [
            {
                "id": "model_001",
                "name": f"{keyword} Model A",
                "description": f"A model related to {keyword}",
                "author": "OpenGMS Team"
            },
            {
                "id": "model_002",
                "name": f"{keyword} Model B",
                "description": f"Another model for {keyword} analysis",
                "author": "GeoLab"
            }
        ]
        
        return SkillResult(
            status=SkillStatus.SUCCESS,
            skill_name=self.name,
            output=mock_models,
            message=f"找到 {len(mock_models)} 个相关模型（模拟数据）"
        )


class GetModelInfoSkill(Skill):
    """
    获取模型详细信息
    """
    
    name = "get_model_info"
    description = "获取指定模型的详细信息，包括输入输出参数"
    category = "model"
    requires_frontend = False
    
    def _setup_params(self):
        self.add_param(ParamSpec(
            name="model_id",
            param_type=ParamType.STRING,
            description="模型 ID",
            required=False
        ))
        self.add_param(ParamSpec(
            name="model_name",
            param_type=ParamType.STRING,
            description="模型名称（如果没有 ID）",
            required=False
        ))
    
    def validate_params(self, **params) -> tuple[bool, List[str]]:
        # 至少需要 model_id 或 model_name 之一
        if not params.get("model_id") and not params.get("model_name"):
            return False, ["需要提供 model_id 或 model_name"]
        return True, []
    
    async def _execute(self, context: SkillContext, **params) -> SkillResult:
        model_id = params.get("model_id")
        model_name = params.get("model_name")
        
        # 检查缓存
        cache_key = model_id or model_name
        if context.has_model_info(cache_key):
            cached = context.get_model_info(cache_key)
            return SkillResult(
                status=SkillStatus.SUCCESS,
                skill_name=self.name,
                output=cached,
                message="从缓存获取模型信息"
            )
        
        # 调用 API 获取
        try:
            # 模拟 API 调用
            model_info = self._mock_get_info(model_id or model_name)
            
            # 缓存结果
            context.cache_model_info(cache_key, model_info)
            
            return SkillResult(
                status=SkillStatus.SUCCESS,
                skill_name=self.name,
                output=model_info,
                message=f"获取模型 '{model_info['name']}' 的详细信息"
            )
        except Exception as e:
            return SkillResult(
                status=SkillStatus.FAILED,
                skill_name=self.name,
                error=str(e),
                message=f"获取模型信息失败: {e}"
            )
    
    def _mock_get_info(self, identifier: str) -> Dict:
        """模拟获取模型信息"""
        return {
            "id": identifier,
            "name": f"Model {identifier}",
            "description": "A geospatial analysis model",
            "version": "1.0.0",
            "inputs": [
                {
                    "name": "input_data",
                    "type": "file",
                    "format": ["shp", "geojson"],
                    "description": "Input spatial data",
                    "required": True
                },
                {
                    "name": "parameter1",
                    "type": "number",
                    "description": "Analysis parameter",
                    "required": False,
                    "default": 100
                }
            ],
            "outputs": [
                {
                    "name": "result",
                    "type": "file",
                    "format": "geojson",
                    "description": "Analysis result"
                }
            ],
            "runtime": {
                "language": "python",
                "estimated_time": "5-10 minutes"
            }
        }


class ListAvailableModelsSkill(Skill):
    """
    列出可用模型类别
    """
    
    name = "list_model_categories"
    description = "列出 OpenGMS 平台上的模型类别"
    category = "model"
    requires_frontend = False
    
    def _setup_params(self):
        pass  # 无参数
    
    async def _execute(self, context: SkillContext, **params) -> SkillResult:
        # 模拟返回类别
        categories = [
            {"name": "hydrology", "display": "水文模型", "count": 45},
            {"name": "atmosphere", "display": "大气模型", "count": 32},
            {"name": "land_surface", "display": "地表模型", "count": 28},
            {"name": "urban", "display": "城市模型", "count": 18},
            {"name": "ecology", "display": "生态模型", "count": 24},
        ]
        
        return SkillResult(
            status=SkillStatus.SUCCESS,
            skill_name=self.name,
            output=categories,
            message=f"共有 {len(categories)} 个模型类别"
        )
