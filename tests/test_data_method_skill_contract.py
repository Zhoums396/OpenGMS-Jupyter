from __future__ import annotations

from pathlib import Path


SKILL_ROOT = (
    Path(__file__).parents[1]
    / "geocopilot"
    / "skills"
    / "opengms-data-methods"
)


def test_user_facing_notebook_contract_uses_direct_rest_without_skill_cli():
    skill = (SKILL_ROOT / "SKILL.md").read_text(encoding="utf-8")
    reference = (
        SKILL_ROOT / "references" / "method-library-api.md"
    ).read_text(encoding="utf-8")

    assert "direct `requests.post()`" in skill
    assert "Never paste the helper command" in skill
    assert "Never import or call the helper from a notebook" in skill
    assert "\n  --save " not in skill
    assert "requests.post(" in reference
    assert "method_library_rest.py invoke" not in reference
    assert "def invoke_method" not in reference
    assert "/Users/" not in skill
    assert "/Users/" not in reference
