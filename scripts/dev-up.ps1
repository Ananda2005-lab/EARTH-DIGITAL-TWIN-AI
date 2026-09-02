# One-command local startup: Docker (Postgres/Redis) + pm2-managed API & web.
# Usage:  powershell -ExecutionPolicy Bypass -File scripts/dev-up.ps1
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

# 1. Docker Desktop (Postgres + Redis)
if (-not (docker ps 2>$null)) {
  Write-Host 'Starting Docker Desktop...'
  Start-Process 'C:\Program Files\Docker\Docker\Docker Desktop.exe'
  Start-Sleep 40
}
docker compose -f infra/docker/docker-compose.yml up -d

# 2. Servers under pm2 (auto-restart on crash; logs in .scratch/pm2-*.log)
pm2 resurrect 2>$null | Out-Null
$running = pm2 jlist 2>$null | ConvertFrom-Json | Where-Object { $_.name -eq 'edt-web' -and $_.pm2_env.status -eq 'online' }
if (-not $running) { pm2 start ecosystem.config.cjs }
pm2 save | Out-Null

Write-Host ''
Write-Host 'Web app : http://localhost:3100'
Write-Host 'API docs: http://localhost:4000/api/docs'
Write-Host 'PM2 view: pm2 status   |   pm2 logs edt-web'
