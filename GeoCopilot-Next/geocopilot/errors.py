"""Domain errors returned by the GeoCopilot API and MCP tools."""


class GeoCopilotError(RuntimeError):
    code = "geocopilot_error"
    status_code = 500


class AgentNotConfigured(GeoCopilotError):
    code = "agent_not_configured"
    status_code = 400


class TurnActive(GeoCopilotError):
    code = "turn_active"
    status_code = 409


class TurnNotFound(GeoCopilotError):
    code = "turn_not_found"
    status_code = 404


class RevisionConflict(GeoCopilotError):
    code = "revision_conflict"
    status_code = 409


class WorkspacePathError(GeoCopilotError):
    code = "workspace_path_error"
    status_code = 400

