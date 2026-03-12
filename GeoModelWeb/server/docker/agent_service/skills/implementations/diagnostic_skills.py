"""
错误诊断技能
分析代码错误并提供修复建议
"""

import re
from typing import Dict, Any, List, Optional
from ..base import Skill, SkillContext, SkillResult, SkillStatus, ParamSpec, ParamType


class DiagnoseErrorSkill(Skill):
    """
    诊断代码执行错误
    分析错误类型并提供修复建议
    """
    
    name = "diagnose_error"
    description = "分析代码执行错误，提供诊断和修复建议"
    category = "diagnostic"
    requires_frontend = False
    
    # 常见错误模式
    ERROR_PATTERNS = {
        r"ModuleNotFoundError: No module named '(\w+)'": {
            "type": "missing_module",
            "diagnosis": "缺少 Python 模块",
            "fix_template": "pip install {module}"
        },
        r"FileNotFoundError: \[Errno 2\] No such file or directory: '(.+)'": {
            "type": "file_not_found",
            "diagnosis": "文件不存在",
            "fix_template": "请检查文件路径是否正确: {path}"
        },
        r"NameError: name '(\w+)' is not defined": {
            "type": "undefined_name",
            "diagnosis": "变量或函数未定义",
            "fix_template": "请先定义 {name} 或检查拼写是否正确"
        },
        r"TypeError: (.+)": {
            "type": "type_error",
            "diagnosis": "类型错误",
            "fix_template": "检查参数类型是否正确"
        },
        r"KeyError: (.+)": {
            "type": "key_error",
            "diagnosis": "字典键不存在",
            "fix_template": "请检查键名是否正确或使用 .get() 方法"
        },
        r"IndexError: (.+)": {
            "type": "index_error",
            "diagnosis": "索引越界",
            "fix_template": "请检查列表/数组的长度"
        },
        r"AttributeError: '(\w+)' object has no attribute '(\w+)'": {
            "type": "attribute_error",
            "diagnosis": "属性不存在",
            "fix_template": "对象 {object} 没有属性 {attr}"
        },
        r"SyntaxError: (.+)": {
            "type": "syntax_error",
            "diagnosis": "语法错误",
            "fix_template": "请检查代码语法"
        },
        r"ValueError: (.+)": {
            "type": "value_error",
            "diagnosis": "值错误",
            "fix_template": "请检查输入值是否有效"
        },
        r"PermissionError: (.+)": {
            "type": "permission_error",
            "diagnosis": "权限不足",
            "fix_template": "请检查文件/目录权限"
        },
    }
    
    # GIS 相关错误
    GIS_ERROR_PATTERNS = {
        r"CRS mismatch": {
            "type": "crs_mismatch",
            "diagnosis": "坐标参考系不匹配",
            "fix_template": "使用 gdf.to_crs() 转换坐标系"
        },
        r"Invalid geometry": {
            "type": "invalid_geometry",
            "diagnosis": "几何对象无效",
            "fix_template": "使用 gdf.buffer(0) 或 shapely.make_valid() 修复几何"
        },
        r"Driver .+ not available": {
            "type": "driver_missing",
            "diagnosis": "缺少地理数据驱动",
            "fix_template": "请安装 GDAL 并确保驱动可用"
        },
    }
    
    def _setup_params(self):
        self.add_param(ParamSpec(
            name="error_message",
            param_type=ParamType.STRING,
            description="错误信息",
            required=False
        ))
        self.add_param(ParamSpec(
            name="code",
            param_type=ParamType.CODE,
            description="出错的代码",
            required=False
        ))
        self.add_param(ParamSpec(
            name="use_context_error",
            param_type=ParamType.BOOLEAN,
            description="使用上下文中的最近错误",
            required=False,
            default=True
        ))
    
    async def _execute(self, context: SkillContext, **params) -> SkillResult:
        error_message = params.get("error_message")
        code = params.get("code", context.current_cell_code)
        use_context = params.get("use_context_error", True)
        
        # 确定要分析的错误
        if not error_message and use_context:
            error_message = context.last_error
        
        if not error_message:
            return SkillResult(
                status=SkillStatus.FAILED,
                skill_name=self.name,
                error="没有提供错误信息",
                message="请提供要诊断的错误信息"
            )
        
        # 分析错误
        diagnosis = self._analyze_error(error_message, code)
        
        return SkillResult(
            status=SkillStatus.SUCCESS,
            skill_name=self.name,
            output=diagnosis,
            message=diagnosis["summary"],
            error_diagnosis=diagnosis["diagnosis"],
            suggested_fixes=diagnosis["fixes"]
        )
    
    def _analyze_error(self, error_message: str, code: Optional[str]) -> Dict:
        """分析错误信息"""
        result = {
            "error_type": "unknown",
            "diagnosis": "无法识别的错误类型",
            "fixes": [],
            "summary": "",
            "details": {}
        }
        
        # 匹配标准错误模式
        all_patterns = {**self.ERROR_PATTERNS, **self.GIS_ERROR_PATTERNS}
        
        for pattern, info in all_patterns.items():
            match = re.search(pattern, error_message)
            if match:
                result["error_type"] = info["type"]
                result["diagnosis"] = info["diagnosis"]
                
                # 提取匹配的组
                groups = match.groups()
                result["details"]["matched_groups"] = groups
                
                # 生成修复建议
                fix = info["fix_template"]
                if groups:
                    if info["type"] == "missing_module":
                        fix = fix.format(module=groups[0])
                        result["fixes"].append(f"运行: {fix}")
                        result["fixes"].append(f"或者: conda install {groups[0]}")
                    elif info["type"] == "file_not_found":
                        fix = fix.format(path=groups[0])
                        result["fixes"].append(fix)
                        result["fixes"].append("检查工作目录是否正确")
                    elif info["type"] == "undefined_name":
                        fix = fix.format(name=groups[0])
                        result["fixes"].append(fix)
                        result["fixes"].append("检查是否需要导入某个模块")
                    elif info["type"] == "attribute_error" and len(groups) >= 2:
                        fix = fix.format(object=groups[0], attr=groups[1])
                        result["fixes"].append(fix)
                    else:
                        result["fixes"].append(fix)
                else:
                    result["fixes"].append(fix)
                
                break
        
        # 生成总结
        result["summary"] = f"错误类型: {result['error_type']} - {result['diagnosis']}"
        
        # 如果有代码，尝试定位错误行
        if code:
            line_match = re.search(r'line (\d+)', error_message)
            if line_match:
                line_num = int(line_match.group(1))
                lines = code.split('\n')
                if 0 < line_num <= len(lines):
                    result["details"]["error_line"] = line_num
                    result["details"]["error_code"] = lines[line_num - 1]
        
        return result


class SuggestImportsSkill(Skill):
    """
    建议需要的导入语句
    """
    
    name = "suggest_imports"
    description = "分析代码并建议需要的 import 语句"
    category = "diagnostic"
    requires_frontend = True
    
    # 常用库的导入映射
    IMPORT_MAPPING = {
        # Data Science
        "pd": "import pandas as pd",
        "np": "import numpy as np",
        "plt": "import matplotlib.pyplot as plt",
        "sns": "import seaborn as sns",
        
        # GIS
        "gpd": "import geopandas as gpd",
        "rasterio": "import rasterio",
        "shapely": "from shapely.geometry import Point, LineString, Polygon",
        "folium": "import folium",
        "pyproj": "from pyproj import CRS, Transformer",
        
        # Machine Learning
        "sklearn": "import sklearn",
        "tf": "import tensorflow as tf",
        "torch": "import torch",
        
        # Utils
        "os": "import os",
        "sys": "import sys",
        "json": "import json",
        "re": "import re",
        "datetime": "from datetime import datetime",
        "Path": "from pathlib import Path",
    }
    
    def _setup_params(self):
        self.add_param(ParamSpec(
            name="code",
            param_type=ParamType.CODE,
            description="要分析的代码",
            required=True
        ))
    
    async def _execute(self, context: SkillContext, **params) -> SkillResult:
        code = params.get("code", "")
        
        # 找出代码中使用的名称
        used_names = self._extract_names(code)
        
        # 找出已经导入的名称
        imported_names = self._extract_imports(code)
        
        # 找出需要导入的
        missing_imports = []
        for name in used_names:
            if name not in imported_names and name in self.IMPORT_MAPPING:
                import_stmt = self.IMPORT_MAPPING[name]
                if import_stmt not in missing_imports:
                    missing_imports.append(import_stmt)
        
        if not missing_imports:
            return SkillResult(
                status=SkillStatus.SUCCESS,
                skill_name=self.name,
                output=[],
                message="代码中没有发现缺失的导入"
            )
        
        # 生成前端动作：在顶部插入导入语句
        import_code = "\n".join(missing_imports)
        
        return SkillResult(
            status=SkillStatus.SUCCESS,
            skill_name=self.name,
            output=missing_imports,
            message=f"建议添加 {len(missing_imports)} 个导入语句",
            frontend_action={
                "type": "add_code_cell",
                "code": import_code,
                "position": "above"
            }
        )
    
    def _extract_names(self, code: str) -> set:
        """提取代码中使用的名称"""
        # 简单的名称提取，实际可以用 AST
        names = set()
        
        # 匹配类似 pd.DataFrame, np.array 等
        pattern = r'\b([a-zA-Z_][a-zA-Z0-9_]*)\s*\.'
        matches = re.findall(pattern, code)
        names.update(matches)
        
        # 匹配函数调用
        pattern = r'\b([a-zA-Z_][a-zA-Z0-9_]*)\s*\('
        matches = re.findall(pattern, code)
        names.update(matches)
        
        return names
    
    def _extract_imports(self, code: str) -> set:
        """提取已导入的名称"""
        names = set()
        
        # import xxx
        pattern = r'^import\s+(\w+)'
        matches = re.findall(pattern, code, re.MULTILINE)
        names.update(matches)
        
        # import xxx as yyy
        pattern = r'^import\s+\w+\s+as\s+(\w+)'
        matches = re.findall(pattern, code, re.MULTILINE)
        names.update(matches)
        
        # from xxx import yyy
        pattern = r'^from\s+\w+\s+import\s+(.+)$'
        for match in re.findall(pattern, code, re.MULTILINE):
            # 处理多个导入
            for name in match.split(','):
                name = name.strip()
                if ' as ' in name:
                    name = name.split(' as ')[1].strip()
                names.add(name)
        
        return names


class ExplainCodeSkill(Skill):
    """
    解释代码功能
    """
    
    name = "explain_code"
    description = "解释代码的功能和作用"
    category = "diagnostic"
    requires_frontend = False
    
    def _setup_params(self):
        self.add_param(ParamSpec(
            name="code",
            param_type=ParamType.CODE,
            description="要解释的代码",
            required=True
        ))
        self.add_param(ParamSpec(
            name="detail_level",
            param_type=ParamType.ENUM,
            description="解释详细程度",
            required=False,
            default="normal",
            enum_values=["brief", "normal", "detailed"]
        ))
    
    async def _execute(self, context: SkillContext, **params) -> SkillResult:
        code = params.get("code", "")
        detail_level = params.get("detail_level", "normal")
        
        # 这里简单实现，实际应该用 LLM 来解释
        analysis = self._basic_analysis(code)
        
        return SkillResult(
            status=SkillStatus.SUCCESS,
            skill_name=self.name,
            output=analysis,
            message=f"代码分析完成，包含 {analysis['line_count']} 行代码"
        )
    
    def _basic_analysis(self, code: str) -> Dict:
        """基础代码分析"""
        lines = code.split('\n')
        
        analysis = {
            "line_count": len(lines),
            "imports": [],
            "functions": [],
            "classes": [],
            "main_operations": []
        }
        
        for line in lines:
            line = line.strip()
            
            if line.startswith('import ') or line.startswith('from '):
                analysis["imports"].append(line)
            elif line.startswith('def '):
                match = re.match(r'def\s+(\w+)', line)
                if match:
                    analysis["functions"].append(match.group(1))
            elif line.startswith('class '):
                match = re.match(r'class\s+(\w+)', line)
                if match:
                    analysis["classes"].append(match.group(1))
        
        return analysis
