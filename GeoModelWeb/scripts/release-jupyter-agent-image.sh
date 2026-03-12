#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
EXT_DIR="${ROOT_DIR}/jupyterlab-geomodel"
DOCKER_DIR="${ROOT_DIR}/GeoModelWeb/server/docker"
WHEEL_NAME="jupyterlab_geomodel-0.1.0-py3-none-any.whl"

echo "[1/4] Build JupyterLab extension assets..."
npm --prefix "${EXT_DIR}" run build

echo "[2/4] Build Python wheel..."
python3 -m pip wheel "${EXT_DIR}" -w "${EXT_DIR}/dist" --no-deps

echo "[3/4] Replace Docker wheel artifact..."
cp -f "${EXT_DIR}/dist/${WHEEL_NAME}" "${DOCKER_DIR}/${WHEEL_NAME}"
ls -lh "${DOCKER_DIR}/${WHEEL_NAME}"

echo "[4/4] Rebuild geomodel-jupyter:latest from local base..."
docker build -f "${DOCKER_DIR}/Dockerfile.update" -t geomodel-jupyter:latest "${DOCKER_DIR}"

echo "Done. Please restart existing Jupyter containers to use the new image."
