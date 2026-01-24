# OpenGMS-Jupyter

基于 JupyterLab 的地理模型服务集成平台，支持在线模型调用、数据管理和智能 Agent 交互。

## 项目结构

```
OpenGMS-Jupyter/
├── GeoModelWeb/           # Web应用（前后端）
│   ├── client/            # Vue.js 前端
│   └── server/            # Node.js 后端服务
├── agent-service/         # Python Agent 服务
├── jupyterlab-geomodel/   # JupyterLab 扩展
```

## 主要功能

- 🌍 **地理模型服务** - 集成 OpenGMS 平台的地理分析模型
- 📊 **数据管理** - 支持地理数据的上传、下载和可视化
- 🤖 **智能 Agent** - 基于 LLM 的智能建模助手
- 📓 **Jupyter 集成** - 在 JupyterLab 中直接调用模型服务

## 快速开始

### 1. 启动后端服务

```bash
cd GeoModelWeb/server
npm install
npm start
```

### 2. 启动前端

```bash
cd GeoModelWeb/client
npm install
npm run dev
```

### 3. 启动 Agent 服务

```bash
cd agent-service
pip install -e .
python run.py
```

### 4. 安装 JupyterLab 扩展

```bash
cd jupyterlab-geomodel
pip install -e .
jupyter labextension develop . --overwrite
```

## 环境配置

复制 `.env.example` 为 `.env` 并配置相关环境变量：

- `OPENAI_API_KEY` - OpenAI API 密钥
- `OGMS_API_URL` - OpenGMS 平台 API 地址

## 技术栈

- **前端**: Vue.js 3, Vite, Element Plus
- **后端**: Node.js, Express
- **Agent**: Python, LangChain, FastAPI
- **JupyterLab 扩展**: TypeScript, React

## License

MIT
