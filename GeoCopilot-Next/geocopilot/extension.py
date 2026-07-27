"""Jupyter Server extension application."""

from __future__ import annotations

from pathlib import Path

from jupyter_server.extension.application import ExtensionApp

from .config import SettingsStore
from .handlers import handlers
from .service import AgentService
from .state import StateStore


class GeoCopilotExtension(ExtensionApp):
    name = "geocopilot"
    extension_url = "/geocopilot"
    load_other_extensions = True

    def initialize_settings(self) -> None:
        root_dir = Path(self.serverapp.root_dir).expanduser().resolve()
        settings_store = SettingsStore()
        state = StateStore(settings_store.state_path)
        service = AgentService(root_dir, settings_store, state, self.log)
        self.settings["geocopilot_service"] = service
        page_config = self.serverapp.web_app.settings.setdefault("page_config_data", {})
        page_config["geoCopilotAvailable"] = True

    def initialize_handlers(self) -> None:
        self.handlers.extend(handlers(self.serverapp.base_url))

    async def stop_extension(self) -> None:
        service: AgentService | None = self.settings.get("geocopilot_service")
        if service:
            await service.close()
