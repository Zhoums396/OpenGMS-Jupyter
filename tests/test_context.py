from __future__ import annotations

from geocopilot.context import DEVELOPER_INSTRUCTIONS, build_turn_input


def test_notebook_context_is_one_turn_hint_not_a_binding():
    value = build_turn_input(
        "Please continue the analysis",
        {
            "activeNotebookPath": "work/analysis.ipynb",
            "activeCellId": "cell-a",
            "selectedCellIds": ["cell-a"],
            "activeCellSourceHash": "abc",
        },
    )
    assert value.startswith("Please continue the analysis")
    assert "<situational_context>" in value
    assert '"W_t"' in value
    assert '"R"' in value
    assert '"H_t"' in value
    assert '"activeNotebookPath":"work/analysis.ipynb"' in value
    assert "captured when this turn was submitted" in value
    assert "not an additional user instruction" in value


def test_global_instructions_keep_general_codex_capabilities():
    lowered = " ".join(DEVELOPER_INSTRUCTIONS.lower().split())
    assert "native shell" in lowered
    assert "not a restriction" in lowered
    assert "semantic judgment" in lowered
    assert "must not use shell" not in lowered
    assert "canonical way to read, create, edit, execute" in lowered
    assert "proceed in small" in lowered
    assert "run them, inspect their outputs" in lowered
    assert "structured stdout, stderr" in lowered
    assert "raster images" in lowered
    assert "three repair attempts" in lowered
    assert "idle kernel" in lowered
    assert "w_t, r, and h_t" in lowered
    for mode in ("continue", "repair", "ask", "terminate", "finish"):
        assert mode in lowered
    assert "not a classifier, router, or host-side state machine" in lowered
    assert "do not add extra checkpoints or model calls" in lowered
