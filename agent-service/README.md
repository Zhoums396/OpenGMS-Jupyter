# GeoModel Agent Service

基于 LangGraph 的地理建模 AI Agent 服务。

## 架构

```
前端 (JupyterLab Extension)
    ↓
Node.js 后端 (端口 3000) - 代理请求
    ↓
Python 后端 (端口 8000) - LangGraph Agent
├── 状态机管理
├── 工具路由（前端/后端工具分离）
└── LLM 调用（支持流式响应）
```

## 安装

```bash
cd agent-service

# 创建虚拟环境
python -m venv .venv
source .venv/bin/activate  # macOS/Linux
# .venv\Scripts\activate  # Windows

# 安装依赖
pip install -e .
```

## 配置

复制 `.env.example` 为 `.env` 并配置：

```bash
cp .env.example .env
```

## 运行

```bash
python run.py
```

或使用 uvicorn：

```bash
uvicorn agent_service.server:app --host 0.0.0.0 --port 8000 --reload
```

## API 端点

### POST /api/agent/chat
SSE 流式聊天接口

请求体：
```json
{
  "message": "帮我调用滑坡模型",
  "session_id": "optional-session-id",
  "user_name": "Zhoums396",
  "project_name": "Agent",
  "context": {
    "notebookName": "main.ipynb",
    "workspaceFiles": {...}
  }
}
```

### POST /api/agent/tool-results
提交前端工具执行结果

请求体：
```json
{
  "session_id": "xxx",
  "tool_results": [
    {"tool_call_id": "call_xxx", "result": "成功添加代码单元格"}
  ]
}
```

### GET /api/agent/session/{session_id}
获取会话状态

### DELETE /api/agent/session/{session_id}
删除会话

## LangGraph 工作流

```
[agent] → 调用 LLM
    ↓
[should_continue] → 检查是否有工具调用
    ↓
[tool_router] → 路由工具
├── 后端工具 (search_models) → 直接执行 → 继续 agent
└── 前端工具 (add_code_cell) → 返回给前端 → 暂停等待
    ↓
[前端执行] → POST /tool-results → 继续 agent
```

## 工具列表

| 工具 | 执行位置 | 功能 |
|------|----------|------|
| add_code_cell | 前端 | 添加代码单元格并运行 |
| add_markdown_cell | 前端 | 添加 Markdown 单元格 |
| search_models | 后端 | 搜索 OGMS 模型 |
| search_data_methods | 后端 | 搜索数据处理方法 |
