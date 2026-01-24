# OpenGeoLab 环境配置指南

## 快速配置 IP

当你的 IP 地址改变时，只需要修改 **两个文件** 中的 `HOST_IP` 即可：

### 1. 修改 Server 端配置

编辑 `GeoModelWeb/server/.env` 文件：

```env
# 将 localhost 改为你的局域网 IP
HOST_IP=192.168.1.134
```

### 2. 修改 Client 端配置

编辑 `GeoModelWeb/client/.env` 文件：

```env
# 将 localhost 改为你的局域网 IP
VITE_HOST_IP=192.168.1.134
VITE_API_BASE_URL=http://192.168.1.134:3000
```

### 3. 重启服务

```bash
# 重启 Server
cd GeoModelWeb/server
npm run dev

# 重启 Client（新终端）
cd GeoModelWeb/client  
npm run dev
```

---

## 一键修改脚本（可选）

### Windows PowerShell

在项目根目录运行：

```powershell
# 设置你的 IP
$IP = "192.168.1.134"

# 更新 server/.env
(Get-Content GeoModelWeb/server/.env) -replace 'HOST_IP=.*', "HOST_IP=$IP" | Set-Content GeoModelWeb/server/.env

# 更新 client/.env
@"
VITE_HOST_IP=$IP
VITE_API_BASE_URL=http://${IP}:3000
"@ | Set-Content GeoModelWeb/client/.env

Write-Host "IP 已更新为: $IP"
```

---

## 配置说明

| 文件 | 变量 | 说明 |
|------|------|------|
| `server/.env` | `HOST_IP` | 服务器 IP，影响 CORS、Jupyter 访问地址等 |
| `client/.env` | `VITE_HOST_IP` | 客户端使用的 IP |
| `client/.env` | `VITE_API_BASE_URL` | Vite 代理目标地址 |

## 常见问题

### Q: 为什么要分开两个文件？
A: Server 和 Client 是两个独立的应用，各自有自己的环境变量系统。Vite 要求使用 `VITE_` 前缀。

### Q: 本地开发用什么 IP？
A: 使用 `localhost` 即可，只有局域网访问时才需要改为实际 IP。
