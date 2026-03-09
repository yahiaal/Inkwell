@echo off
:: Inkwell LMS - Perform full update (Code + Dependencies + Build)

set PROJECT=C:\Users\Thinkpad\Desktop\Course Player

echo --------------------------------------------------
echo [INKWELL] Starting full update...
echo --------------------------------------------------

cd /d "%PROJECT%"

:: Pull latest code
echo [1/3] Pulling latest changes from Git...
git pull

:: Install dependencies
echo [2/3] Installing/Updating dependencies (Root, Server, Client)...
call npm run install:all

:: Build frontend
echo [3/3] Building client...
call npm run build --prefix client

echo --------------------------------------------------
echo [INKWELL] Update complete!
echo You can now run the app via start-inkwell.vbs or .bat
pause
