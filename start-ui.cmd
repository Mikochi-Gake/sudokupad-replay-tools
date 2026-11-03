@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js 20 or newer is required.
  echo Download it from https://nodejs.org/ and try again.
  pause
  exit /b 1
)
if not exist node_modules (
  echo Installing project dependencies for the first run...
  call npm install
  if errorlevel 1 goto :failed
)
call npm run ui
if errorlevel 1 goto :failed
exit /b 0

:failed
echo.
echo Sudoku Replay Desk could not start. The message above may explain why.
pause
exit /b 1
