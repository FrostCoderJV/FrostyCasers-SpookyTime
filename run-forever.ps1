Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

Set-Location $PSScriptRoot

# Перезапускает проект при любом завершении node (OOM, ошибка, ручной exit, и т.д.)
# Остановить: Ctrl+C

# Постоянный лимит heap для V8 (16 ГБ) для этого проекта.
$env:NODE_OPTIONS="--max-old-space-size=16384"

$sleepSeconds = 5

while ($true) {
  $start = Get-Date
  Write-Host ("[{0}] starting: node main.js" -f $start.ToString("s"))

  # ВАЖНО: не используем Start-Process, чтобы Ctrl+C останавливал и node, и цикл
  node .\main.js

  $code = $LASTEXITCODE
  $end = Get-Date
  $runFor = [int]($end - $start).TotalSeconds
  Write-Host ("[{0}] exited: code={1}, ran={2}s, restart in {3}s" -f $end.ToString("s"), $code, $runFor, $sleepSeconds)

  Start-Sleep -Seconds $sleepSeconds
}

