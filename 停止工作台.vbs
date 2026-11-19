' Stop the workbench server on port 5173
Set sh = CreateObject("WScript.Shell")
sh.Run "cmd /c for /f ""tokens=5"" %a in ('netstat -ano ^| findstr :5173') do taskkill /PID %a /F", 0, True
MsgBox "Workbench server stopped."
