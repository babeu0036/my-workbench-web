@echo off
cd /d "%~dp0"
if exist "C:\Program Files\nodejs\node.exe" (
  "C:\Program Files\nodejs\node.exe" "node_modules\vite\bin\vite.js" --port 5173
) else (
  node "node_modules\vite\bin\vite.js" --port 5173
)
