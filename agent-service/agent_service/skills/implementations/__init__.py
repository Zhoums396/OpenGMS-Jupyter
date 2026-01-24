"""
实现模块
导出所有具体技能实现
"""

from .notebook_skills import (
    InsertCodeSkill,
    InsertMarkdownSkill,
    ExecuteCellSkill,
    ClearOutputSkill
)

from .search_skills import (
    SearchModelsSkill,
    GetModelInfoSkill,
    ListAvailableModelsSkill
)

from .model_skills import (
    InvokeModelSkill,
    CheckTaskStatusSkill,
    DownloadResultSkill
)

from .diagnostic_skills import (
    DiagnoseErrorSkill,
    SuggestImportsSkill,
    ExplainCodeSkill
)

from .data_skills import (
    ListFilesSkill,
    ReadDataSkill,
    DataPreviewSkill,
    SaveDataSkill
)


# 所有技能类的列表
ALL_SKILL_CLASSES = [
    # Notebook
    InsertCodeSkill,
    InsertMarkdownSkill,
    ExecuteCellSkill,
    ClearOutputSkill,
    
    # Model Search
    SearchModelsSkill,
    GetModelInfoSkill,
    ListAvailableModelsSkill,
    
    # Model Invocation
    InvokeModelSkill,
    CheckTaskStatusSkill,
    DownloadResultSkill,
    
    # Diagnostic
    DiagnoseErrorSkill,
    SuggestImportsSkill,
    ExplainCodeSkill,
    
    # Data
    ListFilesSkill,
    ReadDataSkill,
    DataPreviewSkill,
    SaveDataSkill
]


__all__ = [
    # Notebook
    "InsertCodeSkill",
    "InsertMarkdownSkill",
    "ExecuteCellSkill",
    "ClearOutputSkill",
    
    # Search
    "SearchModelsSkill",
    "GetModelInfoSkill",
    "ListAvailableModelsSkill",
    
    # Model
    "InvokeModelSkill",
    "CheckTaskStatusSkill",
    "DownloadResultSkill",
    
    # Diagnostic
    "DiagnoseErrorSkill",
    "SuggestImportsSkill",
    "ExplainCodeSkill",
    
    # Data
    "ListFilesSkill",
    "ReadDataSkill",
    "DataPreviewSkill",
    "SaveDataSkill",
    
    # List
    "ALL_SKILL_CLASSES"
]
