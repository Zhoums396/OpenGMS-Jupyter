"""
Conversation Condenser — LLM-based history compression.

Inspired by OpenHands' Condenser architecture:
- When the conversation grows too long, older tool results and exchanges
  are summarized by the LLM into a compact "condensed memory" block.
- The summary is inserted near the start of the message list so the agent
  retains key context (completed tasks, file states, decisions) without
  carrying the full payload.

Strategies:
1. RecentWindowCondenser — keep first N + last M messages, drop the middle.
2. LLMSummarizingCondenser — ask the LLM to produce a structured summary
   of the dropped messages, then keep that summary + recent messages.

Usage (in agent loop):
    condenser = get_condenser(llm_config)
    messages = condenser.maybe_condense(messages)
"""

from __future__ import annotations

import json
from typing import Any, Dict, List, Optional

from langchain_core.messages import (
    AIMessage,
    BaseMessage,
    HumanMessage,
    SystemMessage,
    ToolMessage,
)

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _estimate_chars(messages: List[BaseMessage]) -> int:
    """Rough character count across all messages."""
    total = 0
    for msg in messages:
        content = getattr(msg, "content", "")
        if isinstance(content, str):
            total += len(content)
        elif isinstance(content, list):
            for block in content:
                if isinstance(block, dict):
                    total += len(str(block.get("text", "")))
                else:
                    total += len(str(block))
        # Count tool_calls payload roughly
        if hasattr(msg, "tool_calls") and msg.tool_calls:
            total += len(json.dumps(msg.tool_calls, default=str))
    return total


def _msg_role_label(msg: BaseMessage) -> str:
    if isinstance(msg, SystemMessage):
        return "system"
    elif isinstance(msg, HumanMessage):
        return "user"
    elif isinstance(msg, AIMessage):
        return "assistant"
    elif isinstance(msg, ToolMessage):
        return f"tool({getattr(msg, 'name', '?')})"
    return msg.__class__.__name__


# ---------------------------------------------------------------------------
# Condensation Summary Prompt (patterned after OpenHands LLMSummarizingCondenser)
# ---------------------------------------------------------------------------

_CONDENSATION_PROMPT = """\
You are maintaining a context-aware state summary for an interactive coding agent.
You will be given a list of MESSAGE EXCHANGES that are about to be dropped from
the conversation window to save space.  Produce a **concise structured summary**
that the agent can use to recall what happened.

Track the following sections (omit sections that have no content):

USER_CONTEXT: Essential user requirements, goals, and clarifications.
TASK_TRACKING: Active tasks, their statuses (pending / in-progress / done).
COMPLETED: Tasks finished so far with brief results.
PENDING: Tasks still remaining.
CODE_STATE: File paths created/modified, key function signatures, data structures.
CHANGES: Code edits, variable updates, commands executed.
ERRORS: Errors encountered and how they were resolved (or not).

RULES:
- Be concise — bullet points, no prose.
- Preserve exact file paths, function names, variable names.
- If a task was partially done, note what remains.
- Do NOT include the full content of files — just paths + key info.

<PREVIOUS_SUMMARY>
{previous_summary}
</PREVIOUS_SUMMARY>

<DROPPED_MESSAGES>
{dropped_messages}
</DROPPED_MESSAGES>

Now produce the updated summary.
"""


# ---------------------------------------------------------------------------
# Base class
# ---------------------------------------------------------------------------

class Condenser:
    """Abstract condenser."""

    def maybe_condense(self, messages: List[BaseMessage]) -> List[BaseMessage]:
        raise NotImplementedError


# ---------------------------------------------------------------------------
# RecentWindowCondenser
# ---------------------------------------------------------------------------

class RecentWindowCondenser(Condenser):
    """
    Keep the first `keep_first` messages (system prompt + first user msg)
    and the last `keep_last` messages.  Drop everything in between,
    inserting a brief "[context trimmed]" marker.
    """

    def __init__(self, max_chars: int = 120_000, keep_first: int = 2, keep_last: int = 20):
        self.max_chars = max_chars
        self.keep_first = keep_first
        self.keep_last = keep_last

    def maybe_condense(self, messages: List[BaseMessage]) -> List[BaseMessage]:
        total = _estimate_chars(messages)
        if total <= self.max_chars or len(messages) <= self.keep_first + self.keep_last + 2:
            return messages

        head = messages[:self.keep_first]
        tail = messages[-self.keep_last:]
        dropped_count = len(messages) - self.keep_first - self.keep_last

        marker = SystemMessage(
            content=f"[Condensed: {dropped_count} earlier messages were trimmed to save context. "
                    f"The conversation continues below with the most recent exchanges.]"
        )
        return head + [marker] + tail


# ---------------------------------------------------------------------------
# LLMSummarizingCondenser
# ---------------------------------------------------------------------------

class LLMSummarizingCondenser(Condenser):
    """
    When context exceeds `trigger_chars`, use the LLM to summarize
    the oldest messages (between head and tail), then replace them
    with the summary.

    Parameters:
        trigger_chars: char count that triggers condensation.
        keep_first: how many messages from the start to always keep (system prompt etc).
        keep_last: how many recent messages to always keep.
        max_event_length: max chars per message when building the prompt for summarisation.
        llm_config: dict passed to get_llm() for the summarisation call.
    """

    def __init__(
        self,
        trigger_chars: int = 100_000,
        keep_first: int = 2,
        keep_last: int = 20,
        max_event_length: int = 4000,
        llm_config: Optional[Dict[str, Any]] = None,
    ):
        self.trigger_chars = trigger_chars
        self.keep_first = keep_first
        self.keep_last = keep_last
        self.max_event_length = max_event_length
        self.llm_config = llm_config
        self._previous_summary: str = ""

    def maybe_condense(self, messages: List[BaseMessage]) -> List[BaseMessage]:
        total = _estimate_chars(messages)
        if total <= self.trigger_chars:
            return messages
        if len(messages) <= self.keep_first + self.keep_last + 2:
            return messages

        head = messages[:self.keep_first]
        tail = messages[-self.keep_last:]
        middle = messages[self.keep_first: len(messages) - self.keep_last]

        if not middle:
            return messages

        # Build the "dropped messages" text for summarisation
        dropped_lines: List[str] = []
        for msg in middle:
            role = _msg_role_label(msg)
            content = getattr(msg, "content", "") or ""
            if isinstance(content, list):
                content = " ".join(str(b) for b in content)
            # Truncate individual messages
            if len(content) > self.max_event_length:
                content = content[:self.max_event_length] + "… [truncated]"
            dropped_lines.append(f"[{role}] {content}")

        dropped_text = "\n---\n".join(dropped_lines)

        prompt = _CONDENSATION_PROMPT.format(
            previous_summary=self._previous_summary or "(none)",
            dropped_messages=dropped_text,
        )

        # Attempt LLM summarisation
        try:
            summary = self._call_llm(prompt)
            self._previous_summary = summary
        except Exception as e:
            print(f"[Condenser] LLM summarisation failed: {e}, falling back to window trim")
            summary = f"[Condensed: {len(middle)} messages were trimmed. LLM summary unavailable.]"

        summary_msg = SystemMessage(
            content=f"## Condensed Memory\n\n{summary}\n\n"
                    f"---\n*({len(middle)} earlier messages were condensed into this summary)*"
        )
        return head + [summary_msg] + tail

    def _call_llm(self, prompt: str) -> str:
        """Synchronous LLM call for summarisation (runs inside asyncio via thread)."""
        from .agent import get_llm
        llm = get_llm(self.llm_config)
        result = llm.invoke([HumanMessage(content=prompt)])
        return result.content

    async def async_maybe_condense(self, messages: List[BaseMessage]) -> List[BaseMessage]:
        """Async version that calls LLM asynchronously."""
        total = _estimate_chars(messages)
        if total <= self.trigger_chars:
            return messages
        if len(messages) <= self.keep_first + self.keep_last + 2:
            return messages

        head = messages[:self.keep_first]
        tail = messages[-self.keep_last:]
        middle = messages[self.keep_first: len(messages) - self.keep_last]

        if not middle:
            return messages

        dropped_lines: List[str] = []
        for msg in middle:
            role = _msg_role_label(msg)
            content = getattr(msg, "content", "") or ""
            if isinstance(content, list):
                content = " ".join(str(b) for b in content)
            if len(content) > self.max_event_length:
                content = content[:self.max_event_length] + "… [truncated]"
            dropped_lines.append(f"[{role}] {content}")

        dropped_text = "\n---\n".join(dropped_lines)
        prompt = _CONDENSATION_PROMPT.format(
            previous_summary=self._previous_summary or "(none)",
            dropped_messages=dropped_text,
        )

        try:
            from .agent import get_llm
            llm = get_llm(self.llm_config)
            result = await llm.ainvoke([HumanMessage(content=prompt)])
            summary = result.content
            self._previous_summary = summary
        except Exception as e:
            print(f"[Condenser] Async LLM summarisation failed: {e}")
            summary = f"[Condensed: {len(middle)} messages were trimmed. LLM summary unavailable.]"

        summary_msg = SystemMessage(
            content=f"## Condensed Memory\n\n{summary}\n\n"
                    f"---\n*({len(middle)} earlier messages were condensed into this summary)*"
        )
        return head + [summary_msg] + tail


# ---------------------------------------------------------------------------
# Factory
# ---------------------------------------------------------------------------

# Global condenser instances per strategy
_condensers: Dict[str, Condenser] = {}


def get_condenser(
    strategy: str = "llm_summarizing",
    llm_config: Optional[Dict[str, Any]] = None,
    **kwargs,
) -> Condenser:
    """
    Get or create a Condenser instance.

    strategy:
        'recent_window' — simple head+tail window (no LLM call)
        'llm_summarizing' — use LLM to summarise dropped messages (recommended)
    """
    # For LLM condenser, always create a fresh one when llm_config changes
    if strategy == "llm_summarizing":
        key = f"llm_summarizing_{id(llm_config)}"
        if key not in _condensers:
            _condensers[key] = LLMSummarizingCondenser(
                llm_config=llm_config,
                trigger_chars=kwargs.get("trigger_chars", 100_000),
                keep_first=kwargs.get("keep_first", 2),
                keep_last=kwargs.get("keep_last", 20),
                max_event_length=kwargs.get("max_event_length", 4000),
            )
        return _condensers[key]

    if strategy not in _condensers:
        if strategy == "recent_window":
            _condensers[strategy] = RecentWindowCondenser(
                max_chars=kwargs.get("max_chars", 120_000),
                keep_first=kwargs.get("keep_first", 2),
                keep_last=kwargs.get("keep_last", 20),
            )
        else:
            raise ValueError(f"Unknown condenser strategy: {strategy}")

    return _condensers[strategy]
