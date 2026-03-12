"""
Agent tool definitions for LangGraph.

Inspired by OpenHands CodeAct Agent tool architecture:
- ThinkTool: explicit reflection/reasoning (key for longer chains)
- FinishTool: explicit task completion signal
- Full workspace tools: str_replace_editor style operations
"""
from langchain_core.tools import tool
import os

# 预配置的 OGMS Token
OGMS_TOKEN = os.getenv("OGMS_TOKEN", "883ada2fc996ab9487bed7a3ba21d2f1")


@tool
def add_code_cell(code: str) -> str:
    """
    Add and run a Python code cell in the active Jupyter notebook.
    """
    return "Code cell inserted and executed"


@tool
def edit_code_cell(cell_index: int, new_code: str = "", old_code: str = "", replacement_code: str = "") -> str:
    """
    Edit an existing code cell in the active Jupyter notebook and re-run it.
    Use this to FIX errors or modify existing cells instead of creating new ones.

    Two modes:
    1. Full replacement: provide cell_index and new_code to replace the entire cell content.
    2. Incremental edit: provide cell_index, old_code (the exact substring to find), and
       replacement_code (the replacement text). Only the matching part will be replaced.

    After editing, the cell is automatically re-executed.
    """
    return "Code cell edited and re-executed"


@tool
def add_markdown_cell(content: str) -> str:
    """
    Add a Markdown cell in the active Jupyter notebook.
    """
    return "Markdown cell inserted"


@tool
def search_models(query: str, limit: int = 10) -> str:
    """
    Search geographic computation models from the OpenGMS platform.
    """
    return f"Search models: {query}"


@tool
def search_data_methods(query: str, limit: int = 10) -> str:
    """
    Search available OpenGMS data processing methods.
    """
    return f"Search data methods: {query}"


@tool
def get_model_info(model_name: str) -> str:
    """
    Get full model metadata and parameter schema.
    Always call this before generating model run code.
    """
    return f"Get model info: {model_name}"


@tool
def run_terminal_command(
    command: str,
    timeout_seconds: int = 120,
    working_directory: str = "",
) -> str:
    """
    Run a terminal command in the current project workspace.
    - Full read/write permission inside the project directory
    - Command executes with project-scoped working directory
    - Returns stdout/stderr, exit code, timeout status
    """
    return f"Run terminal command: {command}"


@tool
def list_project_files(
    target_path: str = ".",
    max_depth: int = 3,
    max_entries: int = 300,
) -> str:
    """
    List files/directories in the current project workspace.
    """
    return f"List project files: {target_path}"


@tool
def read_project_file(file_path: str, max_chars: int = 12000) -> str:
    """
    Read a text file from the current project workspace.
    """
    return f"Read project file: {file_path}"


@tool
def write_project_file(file_path: str, content: str, append: bool = False) -> str:
    """
    Create or update a text file in the current project workspace.
    """
    action = "append" if append else "write"
    return f"{action} project file: {file_path}"


@tool
def edit_project_file(file_path: str, old_string: str, new_string: str) -> str:
    """
    Make a surgical edit to a file in the project workspace.
    Replace exactly ONE occurrence of old_string with new_string.
    old_string must match *exactly* (including whitespace/indentation)
    and must be unique in the file. Include 3+ lines of surrounding
    context so the match is unambiguous.
    """
    return f"edit project file: {file_path}"


@tool
def insert_project_lines(file_path: str, insert_line: int, new_string: str) -> str:
    """
    Insert new_string AFTER the specified line number in a file.
    Line numbers are 1-based. Use insert_line=0 to insert at the very top.
    Useful for adding imports, new functions, or blocks at a specific position.
    """
    return f"insert lines in: {file_path}"


@tool
def undo_project_edit(file_path: str) -> str:
    """
    Undo the last edit made to a file by edit_project_file or insert_project_lines.
    Uses in-memory undo history. Useful when an edit introduces a bug and you
    need to revert before trying a different approach.
    """
    return f"undo edit: {file_path}"


@tool
def grep_project_files(
    pattern: str,
    target_path: str = ".",
    is_regex: bool = False,
    include_glob: str = "",
    max_results: int = 50,
) -> str:
    """
    Search for a text pattern inside project files (like ripgrep).
    Returns matching lines with surrounding context, grouped by file.
    Skips binary files and noisy directories (.git, node_modules, etc.).
    Use is_regex=True for regex patterns.
    Use include_glob to filter files (e.g. "*.py", "*.json").
    """
    return f"grep project files: {pattern}"


# ==================== Reflection & Control Tools (OpenHands pattern) ====================

@tool
def think(thought: str) -> str:
    """
    Use this tool to think about something. It will not obtain new information
    or make any changes to the repository, but just log the thought. Use it when
    complex reasoning or brainstorming is needed.

    Common use cases:
    1. When exploring a repository and discovering the source of a bug, call this
       tool to brainstorm several unique ways of fixing the bug, and assess which
       change(s) are likely to be simplest and most effective.
    2. After receiving test results, use this tool to brainstorm ways to fix failing tests.
    3. When planning a complex refactoring, use this tool to outline different
       approaches and their tradeoffs.
    4. When designing a new feature, use this tool to think through architecture
       decisions and implementation details.
    5. When debugging a complex issue, use this tool to organize your thoughts
       and hypotheses.

    The tool simply logs your thought process for better transparency and does
    not execute any code or make changes.
    """
    return f"Thought logged."


@tool
def finish(message: str) -> str:
    """
    Signals the completion of the current task or conversation.

    Use this tool when:
    - You have successfully completed the user's requested task
    - You cannot proceed further due to technical limitations or missing information

    The message should include:
    - A clear summary of actions taken and their results (in the user's language)
    - Any next steps for the user
    - Explanation if you're unable to complete the task

    IMPORTANT: The message parameter IS the final summary shown to the user.
    Make it comprehensive and informative.
    """
    return f"FINISH: {message}"


@tool
def web_search(
    query: str,
    max_results: int = 5,
) -> str:
    """
    Search the web for information, data sources, documentation, or code examples.
    Uses DuckDuckGo search. Returns titles, URLs, and snippets.
    Great for:
    - Finding geospatial data download links
    - Looking up library documentation or API references
    - Discovering sample datasets (GeoJSON, Shapefile, CSV, etc.)
    - Finding solutions to coding problems
    """
    return f"Web search: {query}"


@tool
def download_file(
    url: str,
    save_path: str,
    timeout_seconds: int = 120,
) -> str:
    """
    Download a file from a URL and save it to the project workspace.
    Supports any file type: CSV, GeoJSON, Shapefile (zip), TIF, JSON, etc.
    The save_path is relative to the project root (e.g. "data/cities.geojson").
    Parent directories will be created automatically.
    Shows download progress and final file size.
    """
    return f"Download file from {url} to {save_path}"


# 导出所有工具
ALL_TOOLS = [
    add_code_cell,
    edit_code_cell,
    add_markdown_cell,
    search_models,
    search_data_methods,
    get_model_info,
    run_terminal_command,
    list_project_files,
    read_project_file,
    write_project_file,
    edit_project_file,
    insert_project_lines,
    undo_project_edit,
    grep_project_files,
    think,
    finish,
    web_search,
    download_file,
]

# 前端执行的工具（返回给前端执行）
FRONTEND_TOOLS = {"add_code_cell", "edit_code_cell", "add_markdown_cell"}

# 后端执行的工具（Python 后端直接执行）
BACKEND_TOOLS = {
    "search_models",
    "search_data_methods",
    "get_model_info",
    "run_terminal_command",
    "list_project_files",
    "read_project_file",
    "write_project_file",
    "edit_project_file",
    "insert_project_lines",
    "undo_project_edit",
    "grep_project_files",
    "think",
    "finish",
    "web_search",
    "download_file",
}

# 特殊工具 — agent loop 需要对这些做特殊处理
THINK_TOOL_NAME = "think"
FINISH_TOOL_NAME = "finish"
