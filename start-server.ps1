param(
  [int]$Port = 3000,
  [switch]$ForceInstall
)

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
Set-Location -LiteralPath $ScriptDir

Write-Host "Using directory: $ScriptDir"
$env:PORT = $Port

# Попробуем найти npm
$npmCmd = (Get-Command npm -ErrorAction SilentlyContinue).Path
if (-not $npmCmd) {
  $where = & where.exe npm 2>$null
  if ($where) { $npmCmd = $where -split "`r?`n" | Select-Object -First 1 }
}

if (-not $npmCmd) {
  Write-Warning "npm не найден в PowerShell. Попробуем вызвать через cmd (если npm.cmd в PATH, это сработает)."
}

if ($ForceInstall.IsPresent -or -not (Test-Path -LiteralPath (Join-Path $ScriptDir 'node_modules'))) {
  Write-Host "Выполняем установку зависимостей (npm install)..."
  $rc = & cmd /c "npm install"
  if ($LASTEXITCODE -ne 0) {
    Write-Error "npm install завершился с кодом $LASTEXITCODE"
    exit $LASTEXITCODE
  }
} else {
  Write-Host "node_modules найдены — пропускаем npm install."
}

Write-Host "Запуск npm start (порт $Port)..."
& cmd /c "npm start"