' Launch the local workbench server hidden, then open the browser.
' Uses this script's own folder instead of a hard-coded drive, so a fresh
' clone works no matter where it lives.
Set fso = CreateObject("Scripting.FileSystemObject")
Set sh = CreateObject("WScript.Shell")
baseDir = fso.GetParentFolderName(WScript.ScriptFullName)
sh.CurrentDirectory = baseDir
sh.Run "cmd /c """ & baseDir & "\serve.bat""", 0, False
WScript.Sleep 5000
sh.Run "http://localhost:5173", 1, False
