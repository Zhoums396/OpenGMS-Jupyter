"""
Agent 工具定义
这些工具会被 LangGraph 识别，但实际执行在前端
"""
from typing import Optional
from langchain_core.tools import tool
import os

# 预配置的 OGMS Token
OGMS_TOKEN = os.getenv("OGMS_TOKEN", "883ada2fc996ab9487bed7a3ba21d2f1")


@tool
def add_code_cell(code: str) -> str:
    """
    向 Jupyter Notebook 添加代码单元格并自动运行。
    
    Args:
        code: 要插入的 Python 代码
        
    Returns:
        执行状态消息
    """
    # 实际执行在前端，这里只是工具定义
    return f"代码单元格已添加并运行"


@tool
def add_markdown_cell(content: str) -> str:
    """
    向 Jupyter Notebook 添加 Markdown 说明单元格。
    
    Args:
        content: Markdown 内容
        
    Returns:
        执行状态消息
    """
    return f"Markdown 单元格已添加"


@tool
def search_models(query: str, limit: int = 10) -> str:
    """
    搜索 OpenGMS 平台上的地理计算模型。
    
    Args:
        query: 搜索关键词，如 "滑坡"、"水文"、"SWAT" 等
        limit: 返回结果数量，默认 10
        
    Returns:
        匹配的模型列表
    """
    # 实际由后端执行
    return f"搜索模型: {query}"


@tool
def search_data_methods(query: str, limit: int = 10) -> str:
    """
    搜索可用的数据处理方法。
    
    Args:
        query: 搜索关键词
        limit: 返回结果数量，默认 10
        
    Returns:
        匹配的数据方法列表
    """
    return f"搜索数据方法: {query}"


@tool
def get_model_info(model_name: str) -> str:
    """
    获取指定模型的详细信息，包括输入输出参数结构。
    在调用模型之前必须先使用此工具获取模型的参数要求。
    
    Args:
        model_name: 模型的完整名称，如 "基于随机森林的滑坡遥感灾害提取模型"
        
    Returns:
        模型的详细参数信息，包括所有输入参数的名称、类型和描述
    """
    # 实际由后端执行
    return f"获取模型信息: {model_name}"


# 导出所有工具
ALL_TOOLS = [
    add_code_cell,
    add_markdown_cell,
    search_models,
    search_data_methods,
    get_model_info,
]

# 前端执行的工具（返回给前端执行）
FRONTEND_TOOLS = {"add_code_cell", "add_markdown_cell"}

# 后端执行的工具（Python 后端直接执行）
BACKEND_TOOLS = {"search_models", "search_data_methods", "get_model_info"}
