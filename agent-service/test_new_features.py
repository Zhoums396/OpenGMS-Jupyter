"""Quick functional test for new workspace tools: insert_lines, undo_edit"""
import tempfile, os, sys
sys.path.insert(0, os.path.dirname(__file__))

from agent_service.workspace_tools import WorkspaceTools, WorkspaceError, ProjectWorkspace
from pathlib import Path

with tempfile.TemporaryDirectory() as tmpdir:
    root = Path(tmpdir)
    ws = WorkspaceTools(workspace_root=root)
    
    # Setup: create a user/project dir
    project_dir = root / "testuser" / "testproject"
    project_dir.mkdir(parents=True)
    workspace = ws.resolve_project_workspace("testuser", "testproject")
    
    # === Test 1: write + edit + undo ===
    ws.write_file(workspace, "test.py", "line1\nline2\nline3\n")
    ws.edit_file(workspace, "test.py", "line2", "LINE_TWO")
    content = (project_dir / "test.py").read_text()
    assert "LINE_TWO" in content, f"edit_file failed: {content}"
    print("✅ edit_file works")
    
    result = ws.undo_edit(workspace, "test.py")
    content = (project_dir / "test.py").read_text()
    assert "line2" in content and "LINE_TWO" not in content, f"undo_edit failed: {content}"
    print("✅ undo_edit works")
    
    # === Test 2: insert_lines ===
    ws.write_file(workspace, "insert_test.py", "a\nb\nc\n")
    ws.insert_lines(workspace, "insert_test.py", 1, "INSERTED")
    content = (project_dir / "insert_test.py").read_text()
    lines = content.strip().split("\n")
    assert lines[1] == "INSERTED", f"insert_lines failed: {lines}"
    print("✅ insert_lines works")
    
    # Test insert at top (line 0)
    ws.insert_lines(workspace, "insert_test.py", 0, "TOP")
    content = (project_dir / "insert_test.py").read_text()
    assert content.startswith("TOP"), f"insert at top failed: {content[:50]}"
    print("✅ insert_lines at top works")
    
    # Test undo for insert
    ws.undo_edit(workspace, "insert_test.py")
    content = (project_dir / "insert_test.py").read_text()
    assert not content.startswith("TOP"), f"undo after insert failed: {content[:50]}"
    print("✅ undo after insert_lines works")
    
    # === Test 3: think/finish tools (just import check) ===
    from agent_service.tools import think, finish, THINK_TOOL_NAME, FINISH_TOOL_NAME
    assert THINK_TOOL_NAME == "think"
    assert FINISH_TOOL_NAME == "finish"
    print("✅ ThinkTool & FinishTool definitions OK")
    
    # === Test 4: condenser import ===
    from agent_service.condenser import get_condenser, RecentWindowCondenser, LLMSummarizingCondenser
    c = get_condenser("recent_window")
    assert isinstance(c, RecentWindowCondenser)
    print("✅ Condenser module OK")
    
    # === Test 5: MCP registry ===
    from agent_service.mcp import get_mcp_registry
    reg = get_mcp_registry()
    reg.register_server("test-server", "http://localhost:9999", tools=[
        {"name": "test_tool", "description": "A test tool", "parameters": {"type": "object"}}
    ])
    assert reg.is_mcp_tool("test_tool")
    assert reg.get_tool_server("test_tool") == "test-server"
    assert len(reg.get_langchain_tools()) == 1
    reg.unregister_server("test-server")
    assert not reg.is_mcp_tool("test_tool")
    print("✅ MCP Registry OK")

print("\n🎉 All tests passed!")
