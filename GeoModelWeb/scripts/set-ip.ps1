# 一键修改 IP 配置脚本
# 用法: .\set-ip.ps1 192.168.1.134

param(
    [Parameter(Mandatory=$true)]
    [string]$IP
)

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RootDir = Split-Path -Parent $ScriptDir

Write-Host "正在将 IP 更新为: $IP" -ForegroundColor Green

# 更新 server/.env
$ServerEnv = Join-Path $RootDir "server\.env"
if (Test-Path $ServerEnv) {
    (Get-Content $ServerEnv) -replace 'HOST_IP=.*', "HOST_IP=$IP" | Set-Content $ServerEnv
    Write-Host "  ✓ 已更新 server/.env" -ForegroundColor Cyan
} else {
    Write-Host "  ✗ server/.env 不存在" -ForegroundColor Red
}

# 更新 client/.env
$ClientEnv = Join-Path $RootDir "client\.env"
$ClientEnvContent = @"
# =====================================================
# 【核心配置】只需修改此 IP 即可
# 本地开发用 localhost，局域网访问时改为实际 IP
# =====================================================
VITE_HOST_IP=$IP
VITE_API_BASE_URL=http://${IP}:3000
"@
$ClientEnvContent | Set-Content $ClientEnv
Write-Host "  ✓ 已更新 client/.env" -ForegroundColor Cyan

Write-Host ""
Write-Host "配置完成！请重启 server 和 client 服务。" -ForegroundColor Green
Write-Host ""
Write-Host "提示: " -ForegroundColor Yellow
Write-Host "  cd server && npm run dev" -ForegroundColor Gray
Write-Host "  cd client && npm run dev" -ForegroundColor Gray
