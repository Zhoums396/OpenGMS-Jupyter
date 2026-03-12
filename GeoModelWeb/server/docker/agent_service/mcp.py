"""
MCP (Model Context Protocol) Integration Module.

Inspired by OpenHands' MCPAction/MCPTool pattern:
- Allows external MCP tool servers to register their tools dynamically
- Agent can discover and invoke MCP tools alongside built-in tools
- Provides a registry that agent.py consults at tool-binding time

Architecture:
    MCP Server (external) ──HTTP/SSE──> MCPToolRegistry (this module)
                                           │
                                           ▼
                                    agent.py bind_tools()
                                           │
                                           ▼
                                      LLM tool_calls
                                           │
                                           ▼
                                    MCPToolRegistry.execute()
                                           │
                                           ▼
                                    MCP Server (external)

Usage:
    from .mcp import get_mcp_registry

    # Register an MCP tool server
    registry = get_mcp_registry()
    registry.register_server("geo-tools", "http://localhost:9000/mcp")

    # Get all MCP tools as LangChain Tool objects
    mcp_tools = registry.get_langchain_tools()

    # In agent.py:
    all_tools = ALL_TOOLS + mcp_tools
    llm_with_tools = llm.bind_tools(all_tools)
"""

from __future__ import annotations

import json
import asyncio
from dataclasses import dataclass, field
from typing import Any, Callable, Dict, List, Optional

from langchain_core.tools import tool, StructuredTool


# ---------------------------------------------------------------------------
# MCP Tool Descriptor
# ---------------------------------------------------------------------------

@dataclass
class MCPToolDescriptor:
    """Describes a single tool from an MCP server."""
    name: str
    description: str
    parameters: Dict[str, Any]  # JSON Schema for the parameters
    server_name: str
    server_url: str

    def to_langchain_tool(self, executor: Callable) -> StructuredTool:
        """Convert to a LangChain StructuredTool for LLM binding."""
        # Build a simple wrapper that delegates to the executor
        tool_name = self.name
        tool_desc = self.description

        async def _invoke(**kwargs) -> str:
            return await executor(self.server_name, tool_name, kwargs)

        # LangChain StructuredTool from function
        return StructuredTool.from_function(
            func=lambda **kwargs: asyncio.get_event_loop().run_until_complete(_invoke(**kwargs)),
            coroutine=_invoke,
            name=tool_name,
            description=tool_desc,
        )


# ---------------------------------------------------------------------------
# MCP Server Registration
# ---------------------------------------------------------------------------

@dataclass
class MCPServer:
    """Represents a registered MCP tool server."""
    name: str
    url: str
    tools: List[MCPToolDescriptor] = field(default_factory=list)
    enabled: bool = True
    metadata: Dict[str, Any] = field(default_factory=dict)


# ---------------------------------------------------------------------------
# MCP Tool Registry
# ---------------------------------------------------------------------------

class MCPToolRegistry:
    """
    Central registry for MCP tool servers and their tools.

    Lifecycle:
    1. register_server(name, url) — register an MCP server endpoint
    2. discover_tools(name) — fetch tool list from the server's /tools endpoint
    3. get_langchain_tools() — return all discovered tools as LangChain Tool objects
    4. execute(server_name, tool_name, args) — invoke a tool on its server
    """

    def __init__(self):
        self._servers: Dict[str, MCPServer] = {}
        self._tool_index: Dict[str, MCPToolDescriptor] = {}  # tool_name -> descriptor

    def register_server(
        self,
        name: str,
        url: str,
        tools: Optional[List[Dict[str, Any]]] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> MCPServer:
        """
        Register an MCP tool server.

        Args:
            name: Unique server identifier
            url: Base URL of the MCP server
            tools: Optional pre-defined tool list (skips discovery)
            metadata: Optional metadata about the server
        """
        server = MCPServer(name=name, url=url.rstrip("/"), metadata=metadata or {})

        if tools:
            for t in tools:
                descriptor = MCPToolDescriptor(
                    name=t["name"],
                    description=t.get("description", ""),
                    parameters=t.get("parameters", {}),
                    server_name=name,
                    server_url=server.url,
                )
                server.tools.append(descriptor)
                self._tool_index[descriptor.name] = descriptor

        self._servers[name] = server
        print(f"[MCP] Registered server '{name}' at {url} with {len(server.tools)} tools")
        return server

    async def discover_tools(self, server_name: str) -> List[MCPToolDescriptor]:
        """
        Fetch tool definitions from an MCP server's /tools endpoint.
        Returns the discovered tools.
        """
        import aiohttp

        server = self._servers.get(server_name)
        if not server:
            raise ValueError(f"MCP server not registered: {server_name}")

        try:
            timeout = aiohttp.ClientTimeout(total=10)
            async with aiohttp.ClientSession(timeout=timeout) as session:
                async with session.get(f"{server.url}/tools") as response:
                    if response.status != 200:
                        print(f"[MCP] Failed to discover tools from {server_name}: HTTP {response.status}")
                        return []

                    data = await response.json()
                    tool_list = data if isinstance(data, list) else data.get("tools", [])

                    server.tools = []
                    for t in tool_list:
                        descriptor = MCPToolDescriptor(
                            name=t["name"],
                            description=t.get("description", ""),
                            parameters=t.get("inputSchema", t.get("parameters", {})),
                            server_name=server_name,
                            server_url=server.url,
                        )
                        server.tools.append(descriptor)
                        self._tool_index[descriptor.name] = descriptor

                    print(f"[MCP] Discovered {len(server.tools)} tools from '{server_name}'")
                    return server.tools

        except Exception as e:
            print(f"[MCP] Error discovering tools from {server_name}: {e}")
            return []

    async def execute(
        self,
        server_name: str,
        tool_name: str,
        arguments: Dict[str, Any],
    ) -> str:
        """
        Execute an MCP tool on its server.

        Args:
            server_name: Which server to call
            tool_name: Which tool to invoke
            arguments: Tool arguments

        Returns:
            The tool execution result as a string
        """
        import aiohttp

        server = self._servers.get(server_name)
        if not server:
            return f"Error: MCP server not registered: {server_name}"

        try:
            timeout = aiohttp.ClientTimeout(total=60)
            async with aiohttp.ClientSession(timeout=timeout) as session:
                payload = {
                    "name": tool_name,
                    "arguments": arguments,
                }
                async with session.post(
                    f"{server.url}/call-tool",
                    json=payload,
                    headers={"Content-Type": "application/json"},
                ) as response:
                    if response.status != 200:
                        error_text = await response.text()
                        return f"MCP tool error (HTTP {response.status}): {error_text[:500]}"

                    result = await response.json()

                    # Handle MCP standard response format
                    if isinstance(result, dict):
                        content = result.get("content", [])
                        if isinstance(content, list):
                            texts = [c.get("text", str(c)) for c in content if isinstance(c, dict)]
                            return "\n".join(texts) if texts else json.dumps(result, ensure_ascii=False)
                        return str(content)
                    return str(result)

        except asyncio.TimeoutError:
            return f"MCP tool timeout: {tool_name} on {server_name}"
        except Exception as e:
            return f"MCP tool error: {e}"

    def get_langchain_tools(self) -> List[StructuredTool]:
        """Get all registered MCP tools as LangChain Tool objects."""
        tools = []
        for descriptor in self._tool_index.values():
            server = self._servers.get(descriptor.server_name)
            if server and server.enabled:
                tools.append(descriptor.to_langchain_tool(self.execute))
        return tools

    def get_tool_names(self) -> List[str]:
        """Get names of all registered MCP tools."""
        return list(self._tool_index.keys())

    def is_mcp_tool(self, tool_name: str) -> bool:
        """Check if a tool name belongs to an MCP server."""
        return tool_name in self._tool_index

    def get_tool_server(self, tool_name: str) -> Optional[str]:
        """Get the server name for an MCP tool. Returns None if not an MCP tool."""
        descriptor = self._tool_index.get(tool_name)
        return descriptor.server_name if descriptor else None

    def list_servers(self) -> List[Dict[str, Any]]:
        """List all registered servers with their tool counts."""
        return [
            {
                "name": s.name,
                "url": s.url,
                "enabled": s.enabled,
                "toolCount": len(s.tools),
                "tools": [t.name for t in s.tools],
            }
            for s in self._servers.values()
        ]

    def unregister_server(self, name: str) -> bool:
        """Remove an MCP server and its tools."""
        server = self._servers.pop(name, None)
        if server:
            for t in server.tools:
                self._tool_index.pop(t.name, None)
            print(f"[MCP] Unregistered server '{name}'")
            return True
        return False


# ---------------------------------------------------------------------------
# Global singleton
# ---------------------------------------------------------------------------

_mcp_registry: Optional[MCPToolRegistry] = None


def get_mcp_registry() -> MCPToolRegistry:
    """Get the global MCP tool registry singleton."""
    global _mcp_registry
    if _mcp_registry is None:
        _mcp_registry = MCPToolRegistry()
    return _mcp_registry
