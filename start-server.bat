@echo off
REM Запускает PowerShell-скрипт start-server.ps1 в той же папке.
REM Использование: start-server.bat [порт]
setlocal
set "SCRIPT_DIR=%~dp0"
if "%~1"=="" (
  set "PORT=3000"
) else (
  set "PORT=%~1"
)
echo Starting PowerShell script in "%SCRIPT_DIR%" on port %PORT%
powershell -NoExit -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT_DIR%start-server.ps1" -Port %PORT%