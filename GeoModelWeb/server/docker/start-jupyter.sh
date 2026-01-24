#!/bin/bash
# OpenGMS Jupyter 启动脚本
# 该脚本在容器启动时运行，安装 GeoModel 扩展后启动 JupyterLab

# 安装 GeoModel 扩展（如果存在）
if [ -f /opt/geomodel/jupyterlab_geomodel-0.1.0-py3-none-any.whl ]; then
    echo "Installing GeoModel extension..."
    pip install /opt/geomodel/jupyterlab_geomodel-0.1.0-py3-none-any.whl --quiet
    echo "GeoModel extension installed successfully!"
fi

# 启动 JupyterLab
exec jupyter lab --ip=0.0.0.0 --port=8888 --no-browser --allow-root --NotebookApp.token="${JUPYTER_TOKEN}"
