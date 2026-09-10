@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Install Node.js 24 LTS, then run Setup.cmd again.
  pause
  exit /b 1
)
node -e "process.exit(Number(process.versions.node.split('.')[0]) >= 24 ? 0 : 1)"
if errorlevel 1 (
  echo This project needs Node.js 24 or newer.
  pause
  exit /b 1
)
echo Installing Season Shelf dependencies...
call npm ci
if errorlevel 1 goto failed
echo Running offline tests...
call npm test
if errorlevel 1 goto failed
echo Setup complete. Run Start.cmd to open the desktop app.
pause
exit /b 0
:failed
echo Setup did not complete. Review the error above.
pause
exit /b 1
