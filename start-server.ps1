<#
start-server.ps1 — PowerShell-скрипт для запуска сервера в папке проекта.

Использование:
  .\start-server.ps1             # запускает с портом 3000
  .\start-server.ps1 -Port 4000  # указывает порт
  .\start-server.ps1 -ForceInstall  # принудительно выполнит npm install

Если политика выполнения блокирует скрипты, открой PowerShell от администратора и выполните:
  Set-ExecutionPolicy RemoteSigned

Этот скрипт помещай в корень проекта рядом с server.js и package.json.
#>

param(
  [int]$Port = 3000,
  [switch]$ForceInstall
)

# Корневая папка скрипта
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
Write-Host "Script directory: $ScriptDir"

# Перейти в папку проекта
Set-Location -LiteralPath $ScriptDir

# Проверка наличия node и npm
$node = Get-Command node -ErrorAction SilentlyContinue
$npm = Get-Command npm -ErrorAction SilentlyContinue
if (-not $node) {
  Write-Error "Node.js не найден. Пожалуйста, установи Node.js (версия 16+ рекомендуется) и попробуй снова."
  exit 1
}
if (-not $npm) {
  Write-Error "npm не найден. Пожалуйста, установи Node.js/npm и попробуй снова."
  exit 1
}

# Устанавливаем переменную окружения PORT (используется server.js)
$env:PORT = $Port

# Установка зависимостей если требуется
if ($ForceInstall -or -not (Test-Path -LiteralPath (Join-Path $ScriptDir 'node_modules'))) {
  Write-Host "node_modules не найдены или принудительная установка указана — выполняется npm install..."
  npm install
  if ($LASTEXITCODE -ne 0) {
    Write-Error "npm install завершился с ошибкой (код $LASTEXITCODE)."
    exit $LASTEXITCODE
  }
} else {
  Write-Host "node_modules найдены — пропускаем npm install."
}

# Запуск сервера (npm start). Этот вызов будет держать окно PowerShell открытым.
Write-Host "Запуск npm start (порт $Port)..."
npm start

# При желании можно запускать в новой консоли:
# Start-Process powershell -ArgumentList "-NoProfile -NoExit -Command \"Set-Location -LiteralPath '$ScriptDir'; $env:PORT=$Port; npm start\""