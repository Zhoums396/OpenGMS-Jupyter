"""
Workspace utilities for project-scoped agent operations.

Inspired by OpenHands str_replace_editor + openclaw-mini's tool system.
Provides Codex-level project access:
  read, write, edit (surgical patch), insert, undo, grep, exec.
"""

from __future__ import annotations

import asyncio
import os
import re
import subprocess
from collections import defaultdict
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple


class WorkspaceError(Exception):
    """Raised when workspace resolution or access fails."""


@dataclass
class ProjectWorkspace:
    root: Path
    command_cwd: Path
    user_name: str
    project_name: str


# Binary-ish extensions to skip during grep
_BINARY_EXTENSIONS = frozenset({
    ".png", ".jpg", ".jpeg", ".gif", ".bmp", ".ico", ".svg", ".webp",
    ".pdf", ".zip", ".gz", ".tar", ".rar", ".7z",
    ".exe", ".dll", ".so", ".dylib", ".o", ".pyc", ".pyo",
    ".tif", ".tiff", ".img", ".nc", ".hdf", ".h5",
    ".woff", ".woff2", ".ttf", ".eot",
    ".mp3", ".mp4", ".wav", ".avi", ".mov",
    ".db", ".sqlite", ".bin", ".dat",
    ".shp", ".shx", ".dbf", ".prj",  # shapefile components
})

# Maximum undo history entries per file
_MAX_UNDO_HISTORY = 10


class WorkspaceTools:
    """
    Resolve project workspace paths and provide safe, project-scoped file/command operations.

    Full capability set (Codex-level):
      - run_command: execute shell commands
      - list_files: recursive directory listing
      - read_file: read text files (with line range support)
      - write_file: create / overwrite / append files
      - edit_file: surgical old→new string replacement (like Cursor/Copilot edit)
      - grep_files: search within files (regex or literal, like ripgrep)
    """

    def __init__(self, workspace_root: Optional[Path] = None):
        default_root = Path(__file__).resolve().parents[2] / "GeoModelWeb" / "server" / "jupyter-data"
        self.workspace_root = Path(workspace_root or os.getenv("AGENT_WORKSPACE_ROOT") or default_root).resolve()
        # Undo history: file_path_str -> list of previous contents (most recent last)
        self._undo_history: Dict[str, List[str]] = defaultdict(list)

    def resolve_project_workspace(
        self,
        user_name: Optional[str],
        project_name: Optional[str],
        working_directory: Optional[str] = None,
    ) -> ProjectWorkspace:
        if not user_name:
            raise WorkspaceError("Missing user name for workspace resolution")
        if not self.workspace_root.exists():
            raise WorkspaceError(f"Workspace root does not exist: {self.workspace_root}")

        user_dir = self._find_case_insensitive_dir(self.workspace_root, user_name)
        if not user_dir:
            raise WorkspaceError(f"User workspace not found: {user_name}")

        project_dir = self._resolve_project_dir(user_dir, project_name)
        command_cwd = self._resolve_command_cwd(project_dir, working_directory)

        return ProjectWorkspace(
            root=project_dir,
            command_cwd=command_cwd,
            user_name=user_dir.name,
            project_name=project_dir.name,
        )

    async def run_command(
        self,
        workspace: ProjectWorkspace,
        command: str,
        timeout_seconds: int = 120,
        max_output_chars: int = 200_000,
    ) -> Dict[str, Any]:
        if not command or not command.strip():
            raise WorkspaceError("Command is empty")

        process = await asyncio.create_subprocess_shell(
            command,
            cwd=str(workspace.command_cwd),
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )

        timed_out = False
        try:
            stdout_bytes, stderr_bytes = await asyncio.wait_for(
                process.communicate(), timeout=max(1, timeout_seconds)
            )
        except asyncio.TimeoutError:
            timed_out = True
            process.kill()
            stdout_bytes, stderr_bytes = await process.communicate()

        stdout = stdout_bytes.decode("utf-8", errors="replace")
        stderr = stderr_bytes.decode("utf-8", errors="replace")

        truncated = False
        if len(stdout) > max_output_chars:
            stdout = stdout[-max_output_chars:]
            truncated = True
        if len(stderr) > max_output_chars:
            stderr = stderr[-max_output_chars:]
            truncated = True

        return {
            "command": command,
            "cwd": str(workspace.command_cwd),
            "workspaceRoot": str(workspace.root),
            "exitCode": process.returncode,
            "timedOut": timed_out,
            "truncated": truncated,
            "stdout": stdout,
            "stderr": stderr,
        }

    def list_files(
        self,
        workspace: ProjectWorkspace,
        target_path: str = ".",
        max_depth: int = 3,
        max_entries: int = 300,
    ) -> Dict[str, Any]:
        target = self._resolve_path_in_workspace(workspace.root, target_path)
        if not target.exists():
            raise WorkspaceError(f"Path does not exist: {target_path}")
        if not target.is_dir():
            raise WorkspaceError(f"Path is not a directory: {target_path}")

        entries: List[Dict[str, Any]] = []
        max_depth = max(0, min(max_depth, 12))
        max_entries = max(1, min(max_entries, 1000))

        stack: List[tuple[Path, int]] = [(target, 0)]
        while stack and len(entries) < max_entries:
            current_dir, depth = stack.pop()
            try:
                children = sorted(list(current_dir.iterdir()), key=lambda p: (not p.is_dir(), p.name.lower()))
            except OSError:
                continue

            for child in children:
                if len(entries) >= max_entries:
                    break
                rel = child.relative_to(workspace.root).as_posix()
                is_dir = child.is_dir()
                entry: Dict[str, Any] = {
                    "path": rel,
                    "name": child.name,
                    "type": "directory" if is_dir else "file",
                }
                if not is_dir:
                    try:
                        entry["size"] = child.stat().st_size
                    except OSError:
                        entry["size"] = None
                entries.append(entry)

                if is_dir and depth < max_depth:
                    stack.append((child, depth + 1))

        return {
            "workspaceRoot": str(workspace.root),
            "targetPath": target.relative_to(workspace.root).as_posix() if target != workspace.root else ".",
            "maxDepth": max_depth,
            "maxEntries": max_entries,
            "returnedEntries": len(entries),
            "entries": entries,
        }

    def read_file(
        self,
        workspace: ProjectWorkspace,
        file_path: str,
        max_chars: int = 12_000,
    ) -> Dict[str, Any]:
        target = self._resolve_path_in_workspace(workspace.root, file_path)
        if not target.exists():
            raise WorkspaceError(f"File does not exist: {file_path}")
        if not target.is_file():
            raise WorkspaceError(f"Path is not a file: {file_path}")

        try:
            content = target.read_text(encoding="utf-8")
            encoding = "utf-8"
        except UnicodeDecodeError:
            content = target.read_text(encoding="latin-1", errors="replace")
            encoding = "latin-1"

        truncated = False
        if len(content) > max_chars:
            content = content[:max_chars]
            truncated = True

        return {
            "path": target.relative_to(workspace.root).as_posix(),
            "encoding": encoding,
            "truncated": truncated,
            "content": content,
        }

    def write_file(
        self,
        workspace: ProjectWorkspace,
        file_path: str,
        content: str,
        append: bool = False,
    ) -> Dict[str, Any]:
        target = self._resolve_path_in_workspace(workspace.root, file_path)
        target.parent.mkdir(parents=True, exist_ok=True)

        mode = "a" if append else "w"
        with target.open(mode, encoding="utf-8") as f:
            f.write(content)

        return {
            "path": target.relative_to(workspace.root).as_posix(),
            "bytesWritten": len(content.encode("utf-8")),
            "append": append,
        }

    # ------------------------------------------------------------------
    # edit_file – surgical string replacement (inspired by OpenHands str_replace_editor)
    # ------------------------------------------------------------------

    def _save_undo(self, target: Path, content: str) -> None:
        """Save the current file content to undo history before modifying."""
        key = str(target)
        history = self._undo_history[key]
        history.append(content)
        # Cap the history
        if len(history) > _MAX_UNDO_HISTORY:
            self._undo_history[key] = history[-_MAX_UNDO_HISTORY:]

    def edit_file(
        self,
        workspace: ProjectWorkspace,
        file_path: str,
        old_string: str,
        new_string: str,
    ) -> Dict[str, Any]:
        """
        Replace *one* exact occurrence of ``old_string`` with ``new_string``
        inside the file at *file_path*.

        The caller must supply enough surrounding context (≥ 3 lines) so that
        ``old_string`` matches exactly once.  This mirrors OpenHands' str_replace command.
        """
        target = self._resolve_path_in_workspace(workspace.root, file_path)
        if not target.exists():
            raise WorkspaceError(f"File does not exist: {file_path}")
        if not target.is_file():
            raise WorkspaceError(f"Path is not a file: {file_path}")

        try:
            content = target.read_text(encoding="utf-8")
        except UnicodeDecodeError:
            raise WorkspaceError(f"Cannot edit binary file: {file_path}")

        count = content.count(old_string)
        if count == 0:
            raise WorkspaceError(
                f"old_string not found in {file_path}. "
                "Make sure you include enough surrounding context."
            )
        if count > 1:
            raise WorkspaceError(
                f"old_string matched {count} times in {file_path}. "
                "Include more context to make it unique."
            )

        # Save undo state before edit
        self._save_undo(target, content)

        new_content = content.replace(old_string, new_string, 1)
        target.write_text(new_content, encoding="utf-8")

        return {
            "path": target.relative_to(workspace.root).as_posix(),
            "replacements": 1,
            "bytesWritten": len(new_content.encode("utf-8")),
        }

    # ------------------------------------------------------------------
    # insert_lines – insert text at a specific line number (OpenHands insert command)
    # ------------------------------------------------------------------

    def insert_lines(
        self,
        workspace: ProjectWorkspace,
        file_path: str,
        insert_line: int,
        new_string: str,
    ) -> Dict[str, Any]:
        """
        Insert ``new_string`` AFTER line number ``insert_line`` in the file.
        Line numbers are 1-based. Use insert_line=0 to insert at the very top.
        """
        target = self._resolve_path_in_workspace(workspace.root, file_path)
        if not target.exists():
            raise WorkspaceError(f"File does not exist: {file_path}")
        if not target.is_file():
            raise WorkspaceError(f"Path is not a file: {file_path}")

        try:
            content = target.read_text(encoding="utf-8")
        except UnicodeDecodeError:
            raise WorkspaceError(f"Cannot edit binary file: {file_path}")

        self._save_undo(target, content)

        lines = content.splitlines(keepends=True)
        insert_line = max(0, min(insert_line, len(lines)))

        # Ensure new_string ends with newline
        if new_string and not new_string.endswith("\n"):
            new_string += "\n"

        lines.insert(insert_line, new_string)
        new_content = "".join(lines)
        target.write_text(new_content, encoding="utf-8")

        return {
            "path": target.relative_to(workspace.root).as_posix(),
            "insertedAfterLine": insert_line,
            "bytesWritten": len(new_content.encode("utf-8")),
        }

    # ------------------------------------------------------------------
    # undo_edit – revert last edit (OpenHands undo_edit command)
    # ------------------------------------------------------------------

    def undo_edit(
        self,
        workspace: ProjectWorkspace,
        file_path: str,
    ) -> Dict[str, Any]:
        """
        Revert the last edit made to the file at ``file_path``.
        Uses the in-memory undo history (does not survive server restart).
        """
        target = self._resolve_path_in_workspace(workspace.root, file_path)
        key = str(target)

        history = self._undo_history.get(key, [])
        if not history:
            raise WorkspaceError(f"No undo history for {file_path}")

        previous_content = history.pop()
        target.write_text(previous_content, encoding="utf-8")

        return {
            "path": target.relative_to(workspace.root).as_posix(),
            "undone": True,
            "remainingUndos": len(history),
            "bytesWritten": len(previous_content.encode("utf-8")),
        }

    # ------------------------------------------------------------------
    # grep_files – in-file search (inspired by openclaw-mini ripgrep)
    # ------------------------------------------------------------------

    def grep_files(
        self,
        workspace: ProjectWorkspace,
        pattern: str,
        target_path: str = ".",
        is_regex: bool = False,
        include_glob: Optional[str] = None,
        max_results: int = 50,
        context_lines: int = 2,
    ) -> Dict[str, Any]:
        """
        Search for *pattern* inside project files.

        Returns matched lines with surrounding context, grouped by file.
        Skips binary files and common noisy directories (.git, node_modules,
        __pycache__, .venv, etc.).
        """
        search_root = self._resolve_path_in_workspace(workspace.root, target_path)
        if not search_root.exists():
            raise WorkspaceError(f"Search path does not exist: {target_path}")

        if is_regex:
            try:
                compiled = re.compile(pattern, re.IGNORECASE)
            except re.error as exc:
                raise WorkspaceError(f"Invalid regex: {exc}")
        else:
            compiled = re.compile(re.escape(pattern), re.IGNORECASE)

        skip_dirs = {".git", "node_modules", "__pycache__", ".venv", "venv",
                     ".tox", ".mypy_cache", ".pytest_cache", "dist", "build",
                     ".ipynb_checkpoints"}

        results: List[Dict[str, Any]] = []
        total_matches = 0

        for fpath in sorted(search_root.rglob("*")):
            if total_matches >= max_results:
                break
            if not fpath.is_file():
                continue
            # Skip noisy dirs
            if any(part in skip_dirs for part in fpath.parts):
                continue
            # Skip binary extensions
            if fpath.suffix.lower() in _BINARY_EXTENSIONS:
                continue
            # Optional glob filter
            if include_glob and not fpath.match(include_glob):
                continue

            try:
                lines = fpath.read_text(encoding="utf-8", errors="replace").splitlines()
            except OSError:
                continue

            file_matches: List[Dict[str, Any]] = []
            for i, line in enumerate(lines):
                if total_matches >= max_results:
                    break
                if compiled.search(line):
                    start = max(0, i - context_lines)
                    end = min(len(lines), i + context_lines + 1)
                    ctx = [
                        {"line": start + j + 1, "text": lines[start + j], "match": (start + j == i)}
                        for j in range(end - start)
                    ]
                    file_matches.append({
                        "lineNumber": i + 1,
                        "matchedLine": line.rstrip(),
                        "context": ctx,
                    })
                    total_matches += 1

            if file_matches:
                rel = fpath.relative_to(workspace.root).as_posix()
                results.append({"file": rel, "matches": file_matches})

        return {
            "pattern": pattern,
            "isRegex": is_regex,
            "totalMatches": total_matches,
            "maxResults": max_results,
            "truncated": total_matches >= max_results,
            "results": results,
        }

    def _resolve_project_dir(self, user_dir: Path, project_name: Optional[str]) -> Path:
        if project_name:
            project_dir = self._find_case_insensitive_dir(user_dir, project_name)
            if not project_dir:
                raise WorkspaceError(f"Project workspace not found: {project_name}")
            return project_dir

        sub_dirs = [item for item in user_dir.iterdir() if item.is_dir() and not item.name.startswith(".")]
        if len(sub_dirs) == 1:
            return sub_dirs[0]
        return user_dir

    def _resolve_command_cwd(self, project_root: Path, working_directory: Optional[str]) -> Path:
        if not working_directory:
            return project_root

        norm = working_directory.strip().replace("\\", "/")
        if not norm:
            return project_root

        parts = [part for part in norm.split("/") if part and part != "."]
        candidates: List[Path] = [Path(*parts)] if parts else [Path(".")]
        if parts and parts[0].lower() == project_root.name.lower():
            candidates.append(Path(*parts[1:]) if len(parts) > 1 else Path("."))
        if len(parts) >= 2 and parts[1].lower() == project_root.name.lower():
            candidates.append(Path(*parts[2:]) if len(parts) > 2 else Path("."))

        for rel in candidates:
            try:
                candidate = self._resolve_path_in_workspace(project_root, rel.as_posix())
            except WorkspaceError:
                continue
            if candidate.exists() and candidate.is_dir():
                return candidate

        return project_root

    def _resolve_path_in_workspace(self, workspace_root: Path, target_path: str) -> Path:
        path_obj = Path(target_path or ".")
        resolved = (workspace_root / path_obj).resolve()
        if workspace_root == resolved or workspace_root in resolved.parents:
            return resolved
        raise WorkspaceError(f"Path escapes workspace root: {target_path}")

    def _find_case_insensitive_dir(self, parent: Path, candidate_name: str) -> Optional[Path]:
        if not candidate_name:
            return None
        direct = parent / candidate_name
        if direct.exists() and direct.is_dir():
            return direct

        wanted = candidate_name.lower()
        for child in parent.iterdir():
            if child.is_dir() and child.name.lower() == wanted:
                return child
        return None

