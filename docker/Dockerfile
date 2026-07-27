FROM node:20-bookworm-slim@sha256:2cf067cfed83d5ea958367df9f966191a942351a2df77d6f0193e162b5febfc0 AS node_runtime

FROM quay.io/jupyter/base-notebook:python-3.12@sha256:8370819f642e83d0ca9c7f26c6e60580a920a69af80607888723b1784f6b1232

ARG CODEX_VERSION=0.142.2
ARG JUPYTERLAB_VERSION=4.5.10
ARG NOTEBOOK_VERSION=7.5.7

USER root
COPY --from=node_runtime /usr/local /usr/local
RUN npm install --global "@openai/codex@${CODEX_VERSION}"

COPY . /tmp/geocopilot
RUN python -m pip install --no-cache-dir \
      "jupyterlab==${JUPYTERLAB_VERSION}" \
      "notebook==${NOTEBOOK_VERSION}" \
      /tmp/geocopilot \
    && mkdir -p /etc/codex/skills \
    && cp -R /tmp/geocopilot/geocopilot/skills/opengms-model-services /etc/codex/skills/ \
    && cp -R /tmp/geocopilot/geocopilot/skills/opengms-data-methods /etc/codex/skills/ \
    && chmod -R a=rX /etc/codex/skills \
    && rm -rf /tmp/geocopilot

COPY docker/jupyter_server_config.py /etc/jupyter/jupyter_server_config.py

USER ${NB_UID}
WORKDIR /home/jovyan/work

EXPOSE 8888
CMD ["start-notebook.py"]
