"""
数据操作技能
处理工作区中的数据文件
"""

import os
from typing import Dict, Any, List, Optional
from ..base import Skill, SkillContext, SkillResult, SkillStatus, ParamSpec, ParamType


class ListFilesSkill(Skill):
    """
    列出工作区中的文件
    """
    
    name = "list_files"
    description = "列出工作区中的数据文件，支持按类型筛选"
    category = "data"
    requires_frontend = False
    
    def _setup_params(self):
        self.add_param(ParamSpec(
            name="file_type",
            param_type=ParamType.ENUM,
            description="文件类型筛选",
            required=False,
            default="all",
            enum_values=["all", "vector", "raster", "table", "other"]
        ))
        self.add_param(ParamSpec(
            name="directory",
            param_type=ParamType.FILE_PATH,
            description="要列出的目录（默认为工作目录）",
            required=False
        ))
    
    async def _execute(self, context: SkillContext, **params) -> SkillResult:
        file_type = params.get("file_type", "all")
        directory = params.get("directory", context.working_directory)
        
        # 从上下文获取文件
        if file_type == "all":
            files = []
            for type_files in context.available_files.values():
                files.extend(type_files)
        else:
            files = context.get_files_by_type(file_type)
        
        # 格式化输出
        file_list = []
        for f in files:
            if isinstance(f, dict):
                file_list.append(f)
            else:
                file_list.append({"name": str(f)})
        
        return SkillResult(
            status=SkillStatus.SUCCESS,
            skill_name=self.name,
            output=file_list,
            message=f"找到 {len(file_list)} 个{file_type}文件"
        )


class ReadDataSkill(Skill):
    """
    生成读取数据文件的代码
    """
    
    name = "read_data"
    description = "生成读取数据文件的 Python 代码"
    category = "data"
    requires_frontend = True
    
    # 文件类型到读取代码的映射
    READ_CODE_TEMPLATES = {
        ".csv": "pd.read_csv('{path}')",
        ".xlsx": "pd.read_excel('{path}')",
        ".xls": "pd.read_excel('{path}')",
        ".json": "pd.read_json('{path}')",
        ".geojson": "gpd.read_file('{path}')",
        ".shp": "gpd.read_file('{path}')",
        ".tif": "rasterio.open('{path}')",
        ".tiff": "rasterio.open('{path}')",
        ".parquet": "pd.read_parquet('{path}')",
    }
    
    def _setup_params(self):
        self.add_param(ParamSpec(
            name="file_path",
            param_type=ParamType.FILE_PATH,
            description="要读取的文件路径",
            required=True
        ))
        self.add_param(ParamSpec(
            name="variable_name",
            param_type=ParamType.STRING,
            description="存储数据的变量名",
            required=False,
            default="data"
        ))
    
    async def _execute(self, context: SkillContext, **params) -> SkillResult:
        file_path = params.get("file_path")
        var_name = params.get("variable_name", "data")
        
        # 获取文件扩展名
        _, ext = os.path.splitext(file_path)
        ext = ext.lower()
        
        if ext not in self.READ_CODE_TEMPLATES:
            return SkillResult(
                status=SkillStatus.FAILED,
                skill_name=self.name,
                error=f"不支持的文件格式: {ext}",
                message=f"无法生成读取 {ext} 文件的代码"
            )
        
        # 生成代码
        read_code = self.READ_CODE_TEMPLATES[ext].format(path=file_path)
        
        # 添加必要的导入
        imports = []
        if ext in [".csv", ".xlsx", ".xls", ".json", ".parquet"]:
            imports.append("import pandas as pd")
        elif ext in [".geojson", ".shp"]:
            imports.append("import geopandas as gpd")
        elif ext in [".tif", ".tiff"]:
            imports.append("import rasterio")
        
        full_code = "\n".join(imports) + f"\n\n{var_name} = {read_code}\n{var_name}"
        
        return SkillResult(
            status=SkillStatus.SUCCESS,
            skill_name=self.name,
            output={"code": full_code, "variable": var_name},
            message=f"生成读取 {ext} 文件的代码",
            frontend_action={
                "type": "add_code_cell",
                "code": full_code,
                "position": "below"
            }
        )


class DataPreviewSkill(Skill):
    """
    预览数据内容
    """
    
    name = "preview_data"
    description = "生成预览数据内容的代码"
    category = "data"
    requires_frontend = True
    
    def _setup_params(self):
        self.add_param(ParamSpec(
            name="variable_name",
            param_type=ParamType.STRING,
            description="要预览的变量名",
            required=True
        ))
        self.add_param(ParamSpec(
            name="preview_type",
            param_type=ParamType.ENUM,
            description="预览类型",
            required=False,
            default="head",
            enum_values=["head", "tail", "info", "describe", "shape", "columns"]
        ))
        self.add_param(ParamSpec(
            name="n_rows",
            param_type=ParamType.NUMBER,
            description="显示行数",
            required=False,
            default=5
        ))
    
    async def _execute(self, context: SkillContext, **params) -> SkillResult:
        var_name = params.get("variable_name")
        preview_type = params.get("preview_type", "head")
        n_rows = params.get("n_rows", 5)
        
        # 生成预览代码
        code_map = {
            "head": f"{var_name}.head({n_rows})",
            "tail": f"{var_name}.tail({n_rows})",
            "info": f"{var_name}.info()",
            "describe": f"{var_name}.describe()",
            "shape": f"print(f'Shape: {{{var_name}.shape}}')",
            "columns": f"{var_name}.columns.tolist()"
        }
        
        code = code_map.get(preview_type, f"{var_name}.head()")
        
        return SkillResult(
            status=SkillStatus.SUCCESS,
            skill_name=self.name,
            output={"code": code},
            message=f"生成数据预览代码",
            frontend_action={
                "type": "add_code_cell",
                "code": code,
                "position": "below",
                "run": True
            }
        )


class SaveDataSkill(Skill):
    """
    保存数据到文件
    """
    
    name = "save_data"
    description = "生成保存数据到文件的代码"
    category = "data"
    requires_frontend = True
    
    def _setup_params(self):
        self.add_param(ParamSpec(
            name="variable_name",
            param_type=ParamType.STRING,
            description="要保存的变量名",
            required=True
        ))
        self.add_param(ParamSpec(
            name="file_path",
            param_type=ParamType.FILE_PATH,
            description="保存的文件路径",
            required=True
        ))
        self.add_param(ParamSpec(
            name="format",
            param_type=ParamType.ENUM,
            description="保存格式",
            required=False,
            default="csv",
            enum_values=["csv", "geojson", "shp", "parquet", "json"]
        ))
    
    async def _execute(self, context: SkillContext, **params) -> SkillResult:
        var_name = params.get("variable_name")
        file_path = params.get("file_path")
        fmt = params.get("format", "csv")
        
        # 生成保存代码
        code_map = {
            "csv": f"{var_name}.to_csv('{file_path}', index=False)",
            "geojson": f"{var_name}.to_file('{file_path}', driver='GeoJSON')",
            "shp": f"{var_name}.to_file('{file_path}')",
            "parquet": f"{var_name}.to_parquet('{file_path}')",
            "json": f"{var_name}.to_json('{file_path}')"
        }
        
        code = code_map.get(fmt, f"{var_name}.to_csv('{file_path}')")
        
        return SkillResult(
            status=SkillStatus.SUCCESS,
            skill_name=self.name,
            output={"code": code, "path": file_path},
            message=f"生成保存数据代码",
            frontend_action={
                "type": "add_code_cell",
                "code": code,
                "position": "below"
            }
        )
