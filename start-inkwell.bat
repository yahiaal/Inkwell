@echo off
:: Inkwell LMS - Portable Startup Script
set PROJECT=%~dp0
cd /d "%PROJECT%"

:: Auto-install dependencies if missing
if not exist "node_modules\" (
    echo Installing root dependencies...
    call npm install
)
if not exist "server\node_modules\" (
    echo Installing server dependencies...
    call npm install --prefix server
)
if not exist "client\node_modules\" (
    echo Installing client dependencies...
    call npm install --prefix client
)

:: Start the API server (port 3001)
start "" /B npm run start --prefix server

:: Start the client dev server (port 5173)
start "" /B npm run dev --prefix client

echo Inkwell LMS is starting...
echo Once ready, visit http://localhost:5173 in your browser.
