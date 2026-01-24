# OpenGeoLab - Jupyter 功能设置指南

## 1. 前置条件
- Docker Desktop 已安装并运行
- Node.js 已安装
- GitHub 账户

## 2. 创建 GitHub OAuth App

1. 访问 https://github.com/settings/developers
2. 点击 "New OAuth App"
3. 填写信息：
   - **Application name**: OpenGeoLab Jupyter
   - **Homepage URL**: http://localhost:5173
   - **Authorization callback URL**: http://localhost:3000/api/auth/github/callback
4. 创建后，记录 Client ID 和 Client Secret

## 3. 配置环境变量

在 `server` 目录下创建 `.env` 文件：

```
GITHUB_CLIENT_ID=你的GitHub_Client_ID
GITHUB_CLIENT_SECRET=你的GitHub_Client_Secret
JWT_SECRET=随机字符串作为密钥
PORT=3000
FRONTEND_URL=http://localhost:5173
USER_DATA_DIR=./jupyter-data
```

## 4. 拉取 Docker 镜像（可选，首次启动会自动拉取）

```bash
docker pull jupyter/datascience-notebook:latest
```

## 5. 启动服务

后端：
```bash
cd server
npm install
node index.js
```

前端：
```bash
cd client
npm install
npm run dev
```

## 6. 使用

1. 访问 http://localhost:5173
2. 点击导航栏的 "🚀 My Jupyter"
3. 使用 GitHub 登录
4. 点击 "启动 JupyterLab"
5. 等待容器启动，然后点击 "打开 JupyterLab"

## API 端点

### 认证
- `GET /api/auth/github` - 跳转到 GitHub OAuth
- `GET /api/auth/github/callback` - OAuth 回调
- `GET /api/auth/me` - 获取当前用户信息
- `POST /api/auth/logout` - 登出

### Jupyter 管理
- `GET /api/jupyter/status` - 获取容器状态
- `POST /api/jupyter/start` - 启动容器
- `POST /api/jupyter/stop` - 停止容器
- `GET /api/jupyter/projects` - 获取项目列表

## 注意事项

- 首次启动时需要拉取 Docker 镜像，可能需要几分钟
- 每个用户的数据存储在 `server/jupyter-data/{userId}/` 目录
- 用户会话使用 JWT token，有效期 7 天
- 容器会监听 8888+ 端口，确保端口未被占用
