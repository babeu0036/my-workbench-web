@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo.
echo 待办清单启动中...
echo 启动后浏览器打开: http://localhost:4173/
echo.
call npm run preview -- --port 4173
pause