#!/usr/bin/env bash
set -euo pipefail

expected="codex-cli 0.142.2"
actual="$(codex --version)"
if [[ "$actual" != "$expected" ]]; then
  echo "Expected $expected, found $actual" >&2
  exit 1
fi

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
project_dir="$(cd "${script_dir}/.." && pwd)"
target="${project_dir}/schema/codex-0.142.2"
mkdir -p "$target"
codex app-server generate-json-schema --out "$target"
