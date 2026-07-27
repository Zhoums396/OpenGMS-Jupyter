"""GeoCopilot Jupyter Server extension."""

from ._version import __version__
from .extension import GeoCopilotExtension


def _jupyter_labextension_paths():
    return [{"src": "labextension", "dest": "@opengeolab/geocopilot"}]


def _jupyter_server_extension_points():
    return [{"module": "geocopilot", "app": GeoCopilotExtension}]


__all__ = ["GeoCopilotExtension", "__version__"]
