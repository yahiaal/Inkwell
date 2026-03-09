Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
' Get the directory of the current script
strPath = fso.GetParentFolderName(WScript.ScriptFullName)
' Run the batch file hidden (0) and don't wait (False) for startup
WshShell.Run """" & strPath & "\start-inkwell.bat""", 0, False
Set WshShell = Nothing
