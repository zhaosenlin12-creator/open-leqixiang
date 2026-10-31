#Requires -Version 5.1
# 乐启享展示系统 - 一键启动
# 用法: 双击 start.bat (会自动调用本脚本)
# 也可单独运行: powershell -ExecutionPolicy Bypass -File start.ps1
$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8
$Host.UI.RawUI.WindowTitle = "乐启享展示系统 - 启动中"

# 切到脚本所在目录
Set-Location $PSScriptRoot

$Port = 5180
$Url  = "http://127.0.0.1:$Port/"

function Write-Header($text) {
    Write-Host ""
    Write-Host "============================================================" -ForegroundColor Cyan
    Write-Host "  $text" -ForegroundColor Cyan
    Write-Host "============================================================" -ForegroundColor Cyan
    Write-Host ""
}

function Wait-Url([string]$url, [int]$timeoutSec = 60) {
    for ($i = 0; $i -lt $timeoutSec; $i++) {
        try {
            $r = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 2 -ErrorAction Stop
            if ($r.StatusCode -eq 200) { return $true }
        } catch {}
        Start-Sleep -Seconds 1
    }
    return $false
}

try {
    Write-Header "乐启享展示系统"

    # 1. 检查 Node.js
    $node = Get-Command node -ErrorAction SilentlyContinue
    if (-not $node) {
        Write-Host "[错误] 未检测到 node.exe，请先安装 Node.js 18+ 后重试。" -ForegroundColor Red
        Write-Host "        下载地址: https://nodejs.org/" -ForegroundColor Red
        Read-Host "按回车退出"
        exit 1
    }
    Write-Host ("[信息] Node 版本: " + (& node --version).Trim())

    # 2. 第一次运行：安装依赖
    if (-not (Test-Path "node_modules")) {
        Write-Host ""
        Write-Host "[信息] 首次运行，正在安装依赖（可能需要几分钟）..." -ForegroundColor Yellow
        Write-Host ""
        & npm.cmd install --no-audit --no-fund --loglevel=error
        if ($LASTEXITCODE -ne 0) {
            Write-Host "[错误] 依赖安装失败，请检查网络后重试。" -ForegroundColor Red
            Read-Host "按回车退出"
            exit 1
        }
        Write-Host "[信息] 依赖安装完成。" -ForegroundColor Green
    } else {
        Write-Host "[信息] 依赖已存在，跳过安装。"
    }

    # 3. 关闭之前可能残留的 5180 端口占用
    Write-Host ""
    Write-Host "[信息] 准备端口 $Port..."
    $existing = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
    foreach ($c in $existing) {
        Write-Host "[信息] 端口 $Port 被 PID $($c.OwningProcess) 占用，正在结束..."
        Stop-Process -Id $c.OwningProcess -Force -ErrorAction SilentlyContinue
        Start-Sleep -Milliseconds 500
    }

    # 4. 启动 Vite 开发服务器
    Write-Host ""
    Write-Host "[信息] 正在启动 Vite 开发服务器..." -ForegroundColor Yellow
    Write-Host "[信息] 访问地址: $Url"
    Write-Host ""

    $psi = New-Object System.Diagnostics.ProcessStartInfo
    $psi.FileName = "npx.cmd"
    $psi.Arguments = "vite --port $Port --host 127.0.0.1 --strictPort"
    $psi.WorkingDirectory = $PSScriptRoot
    $psi.UseShellExecute = $true
    $psi.WindowStyle = "Minimized"
    [void][System.Diagnostics.Process]::Start($psi)

    # 5. 等待服务器就绪
    Write-Host "[信息] 等待服务器就绪..."
    if (-not (Wait-Url $Url 60)) {
        Write-Host ""
        Write-Host "[错误] 服务器在 60 秒内未能启动，请到任务栏查看 Vite 窗口的错误信息。" -ForegroundColor Red
        Read-Host "按回车退出"
        exit 1
    }
    Write-Host "[信息] 服务器已就绪。" -ForegroundColor Green

    # 6. 打开默认浏览器（可通过 LEQX_NO_BROWSER=1 跳过）
    if ($env:LEQX_NO_BROWSER -eq "1") {
        Write-Host "[信息] LEQX_NO_BROWSER=1，跳过自动打开浏览器。"
    } else {
        Write-Host "[信息] 正在打开浏览器..."
        Start-Process $Url
    }

    Write-Header "启动完成"
    Write-Host "  - 应用地址: $Url" -ForegroundColor Green
    Write-Host "  - Vite 窗口已最小化在任务栏，可随时查看日志"
    Write-Host "  - 关闭本窗口不会停止服务器，请到任务栏右键 '乐启享-vite' 退出"
    Write-Host ""
    Read-Host "按回车关闭此窗口（服务器将继续在后台运行）"
    exit 0
} catch {
    Write-Host ""
    Write-Host "[错误] $($_.Exception.Message)" -ForegroundColor Red
    Read-Host "按回车退出"
    exit 1
}