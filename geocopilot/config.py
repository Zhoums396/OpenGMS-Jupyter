"""Per-user GeoCopilot settings and Codex configuration."""

from __future__ import annotations

import json
import os
import shutil
import tempfile
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any
from urllib.parse import urlparse, urlunparse

import tomli_w
from jupyter_core.paths import jupyter_config_dir, jupyter_data_dir

DEFAULT_MCP_URL = "http://127.0.0.1:3001/mcp"
BUNDLED_SKILL_NAMES = ("opengms-model-services", "opengms-data-methods")


def normalize_openai_base_url(value: str) -> str:
    """Normalize an OpenAI-compatible API root without guessing nested paths."""
    value = value.strip()
    if not value:
        return ""
    parsed = urlparse(value)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        raise ValueError("Base URL must be an absolute http(s) URL")
    path = parsed.path.rstrip("/")
    if not path:
        path = "/v1"
    return urlunparse(parsed._replace(path=path, fragment=""))


@dataclass(slots=True)
class AgentSettings:
    api_key: str = ""
    base_url: str = ""
    model: str = "gpt-5.4"

    def public(self) -> dict[str, Any]:
        return {
            "hasApiKey": bool(self.api_key),
            "baseUrl": self.base_url,
            "model": self.model,
        }


class SettingsStore:
    """Stores credentials outside the Jupyter workspace with owner-only permissions."""

    def __init__(
        self,
        config_root: Path | None = None,
        data_root: Path | None = None,
        mcp_url: str | None = None,
    ):
        self.config_root = config_root or Path(jupyter_config_dir()) / "geocopilot"
        self.data_root = data_root or Path(jupyter_data_dir()) / "geocopilot"
        self.settings_path = self.config_root / "credentials.json"
        self.codex_home = self.data_root / "codex"
        self.state_path = self.data_root / "state.sqlite3"
        self.mcp_url = mcp_url or os.environ.get("GEOCOPILOT_MCP_URL", DEFAULT_MCP_URL)
        for directory in (self.config_root, self.data_root, self.codex_home):
            directory.mkdir(parents=True, exist_ok=True, mode=0o700)
            os.chmod(directory, 0o700)

    def load(self) -> AgentSettings:
        if not self.settings_path.exists():
            return AgentSettings()
        payload = json.loads(self.settings_path.read_text(encoding="utf-8"))
        return AgentSettings(
            api_key=str(payload.get("api_key") or ""),
            base_url=str(payload.get("base_url") or ""),
            model=str(payload.get("model") or "gpt-5.4"),
        )

    def update(self, payload: dict[str, Any]) -> AgentSettings:
        current = self.load()
        api_key = str(payload.get("apiKey") or "").strip()
        base_url = normalize_openai_base_url(
            str(payload.get("baseUrl", current.base_url) or "")
        )
        model = str(payload.get("model", current.model) or "").strip()
        if not model:
            raise ValueError("Model name is required")
        updated = AgentSettings(
            api_key=api_key or current.api_key,
            base_url=base_url,
            model=model,
        )
        self._atomic_json_write(self.settings_path, asdict(updated))
        return updated

    def clear_key(self) -> AgentSettings:
        current = self.load()
        current.api_key = ""
        self._atomic_json_write(self.settings_path, asdict(current))
        return current

    def write_codex_config(self, settings: AgentSettings) -> None:
        self.install_bundled_skills()
        config: dict[str, Any] = {
            "model": settings.model,
            "approval_policy": "never",
            "sandbox_mode": "danger-full-access",
            "mcp_servers": {
                "jupyter-mcp": {
                    "url": self.mcp_url,
                    "startup_timeout_sec": 15,
                    "tool_timeout_sec": 300,
                }
            },
        }
        if settings.base_url:
            # A custom provider makes credential ownership explicit for
            # third-party OpenAI-compatible endpoints. The built-in OpenAI
            # provider may otherwise prefer its own auth stack over env_key.
            config["model_provider"] = "geocopilot"
            config["model_providers"] = {
                "geocopilot": {
                    "name": "GeoCopilot configured endpoint",
                    "base_url": settings.base_url,
                    "env_key": "OPENAI_API_KEY",
                    "wire_api": "responses",
                }
            }
        path = self.codex_home / "config.toml"
        self._atomic_bytes_write(path, tomli_w.dumps(config).encode("utf-8"))

    def install_bundled_skills(self) -> None:
        """Install platform Skills into this private Codex home."""
        source_root = Path(__file__).resolve().parent / "skills"
        target_root = self.codex_home / "skills"
        target_root.mkdir(parents=True, exist_ok=True, mode=0o700)
        os.chmod(target_root, 0o700)

        legacy = target_root / "opengms-platform-services"
        if legacy.exists():
            shutil.rmtree(legacy)

        for name in BUNDLED_SKILL_NAMES:
            source = source_root / name
            if not (source / "SKILL.md").is_file():
                raise FileNotFoundError(f"Bundled Codex Skill is missing: {source}")
            target = target_root / name
            if target.exists():
                shutil.rmtree(target)
            shutil.copytree(source, target)
            for directory, _subdirectories, files in os.walk(target):
                os.chmod(directory, 0o700)
                for filename in files:
                    path = Path(directory) / filename
                    mode = 0o700 if path.parent.name == "scripts" else 0o600
                    os.chmod(path, mode)

    @staticmethod
    def _atomic_json_write(path: Path, payload: dict[str, Any]) -> None:
        data = json.dumps(payload, ensure_ascii=False, indent=2).encode("utf-8")
        SettingsStore._atomic_bytes_write(path, data)

    @staticmethod
    def _atomic_bytes_write(path: Path, data: bytes) -> None:
        path.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
        fd, raw_tmp = tempfile.mkstemp(prefix=f".{path.name}.", dir=path.parent)
        tmp = Path(raw_tmp)
        try:
            os.fchmod(fd, 0o600)
            with os.fdopen(fd, "wb") as stream:
                stream.write(data)
                stream.flush()
                os.fsync(stream.fileno())
            os.replace(tmp, path)
            os.chmod(path, 0o600)
        finally:
            if tmp.exists():
                tmp.unlink()
