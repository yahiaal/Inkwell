@echo off
:: Inkwell LMS - Direct Start (No background work, silent)

set PROJECT=%~dp0
set NODE=node

:: Start the API server (port 3001)
cd /d "%PROJECT%server"
start "" /B %NODE% index.js

:: Start the client static server (port 4173)  
cd /d "%PROJECT%client"
start "" /B %NODE% node_modules\serve\build\main.js -s dist -l 4173
