Set WshShell = CreateObject("WScript.Shell")
' Added --host to allow course.my to connect to the port
WshShell.Run "cmd /c npm run preview -- --port 4173 --host 0.0.0.0", 0, False
Set WshShell = Nothing