@echo off
REM start-server.bat — открывает PowerShell, устанавливает зависимости (если нужно) и запускает сервер.
REM Помести этот файл в корень проекта (рядом с server.js и package.json).
REM Запуск: двойной клик в проводнике или из cmd: start-server.bat [порт]
REM Пример: start-server.bat 4000

setlocal

REM Папка, где лежит этот bat (корень проекта)
set "SCRIPT_DIR=%~dp0"

REM Порт можно передать первым аргументом; по умолчанию 3000
if "%~1"=="" (
  set "PORT=3000"
) else (
  set "PORT=%~1"
)

echo ==============================================
echo Запуск сервера в PowerShell из: %SCRIPT_DIR%
echo Порт: %PORT%
echo ============================================== 

REM Открыть PowerShell и выполнить команды. -NoExit удерживает окно открытым после старта.
powershell -NoExit -NoProfile -ExecutionPolicy Bypass -Command ^
  "Set-Location -LiteralPath '%SCRIPT_DIR%'; ^
   $env:PORT = '%PORT%'; ^
   if (-not (Test-Path -LiteralPath (Join-Path $PWD 'node_modules'))) { Write-Host 'node_modules не найдены — выполняется npm install...'; npm install } else { Write-Host 'node_modules найдены — пропускаем npm install.' }; ^
   Write-Host 'Запуск: npm start'; npm start"