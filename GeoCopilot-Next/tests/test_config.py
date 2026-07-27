from __future__ import annotations

import os

from geocopilot.config import BUNDLED_SKILL_NAMES, SettingsStore, normalize_openai_base_url


def test_api_key_is_write_only_and_owner_protected(tmp_path):
    store = SettingsStore(tmp_path / "config", tmp_path / "data")
    settings = store.update(
        {
            "apiKey": "secret-key",
            "baseUrl": "https://example.test/v1",
            "model": "gpt-test",
        }
    )

    assert settings.public() == {
        "hasApiKey": True,
        "baseUrl": "https://example.test/v1",
        "model": "gpt-test",
    }
    assert "secret-key" not in str(settings.public())
    assert os.stat(store.settings_path).st_mode & 0o777 == 0o600
    assert os.stat(store.config_root).st_mode & 0o777 == 0o700

    store.write_codex_config(settings)
    codex_config = (store.codex_home / "config.toml").read_text()
    assert "secret-key" not in codex_config
    assert 'approval_policy = "never"' in codex_config
    assert 'sandbox_mode = "danger-full-access"' in codex_config
    assert 'model_provider = "geocopilot"' in codex_config
    assert '[model_providers.geocopilot]' in codex_config
    assert 'base_url = "https://example.test/v1"' in codex_config
    assert 'env_key = "OPENAI_API_KEY"' in codex_config
    assert 'wire_api = "responses"' in codex_config
    assert 'url = "http://127.0.0.1:3001/mcp"' in codex_config
    assert "jupyter_server_mcp.proxy" not in codex_config
    for name in BUNDLED_SKILL_NAMES:
        skill = store.codex_home / "skills" / name / "SKILL.md"
        assert skill.is_file()
        assert os.stat(skill).st_mode & 0o777 == 0o600


def test_bundled_skill_install_replaces_stale_files(tmp_path):
    store = SettingsStore(tmp_path / "config", tmp_path / "data")
    stale = (
        store.codex_home
        / "skills"
        / "opengms-data-methods"
        / "scripts"
        / "opengms_methods.py"
    )
    stale.parent.mkdir(parents=True)
    stale.write_text("obsolete", encoding="utf-8")

    store.install_bundled_skills()

    scripts = store.codex_home / "skills" / "opengms-data-methods" / "scripts"
    assert not stale.exists()
    assert (scripts / "method_library_rest.py").is_file()


def test_empty_api_key_update_does_not_erase_saved_key(tmp_path):
    store = SettingsStore(tmp_path / "config", tmp_path / "data")
    store.update({"apiKey": "keep-me"})
    updated = store.update({"apiKey": "", "model": "new-model"})
    assert updated.api_key == "keep-me"
    assert updated.model == "new-model"
    assert store.clear_key().public()["hasApiKey"] is False


def test_openai_compatible_base_url_gets_an_api_prefix():
    assert normalize_openai_base_url("https://api.example.test") == (
        "https://api.example.test/v1"
    )
    assert normalize_openai_base_url("https://api.example.test/custom/v2/") == (
        "https://api.example.test/custom/v2"
    )
