@echo off
chcp 65001 >nul
cd /d "%~dp0"
title 工作台启动器

set "NODE=C:\Program Files\nodejs\node.exe"
if not exist "%NODE%" set "NODE=node"

echo 正在启动工作台...
start "工作台服务器" /min "%NODE%" "node_modules\vite\bin\vite.js" --port 5173

timeout /t 4 /nobreak >nul
start "" "http://localhost:5173"

echo.
echo 工作台已打开：http://localhost:5173
echo 关闭任务栏里的「工作台服务器」窗口即可停止。
timeout /t 6 /nobreak >nul
