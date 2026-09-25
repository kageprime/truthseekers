# Scheduled-task entrypoint: keeps the backend alive outside any shell session.
# Reads env.env (skips blanks + DATABASE_URL), then the Heroku URL captured in
# .database-url.local (created once via `heroku config:get`), then execs the server.
# ponytail: repo root is TWO levels up from this script (…/veritas/env.env
# does not exist — one Parent short cost a boot panic on missing JWT_SECRET).
$root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
Get-Content "$root\env.env" | ForEach-Object {
  if ($_ -match "^\s*([A-Za-z_][A-Za-z0-9_]*)=(.*)$") {
    $k = $Matches[1].Trim(); $v = $Matches[2].Trim()
    if (($v -ne "") -and ($k -ne "DATABASE_URL")) { [Environment]::SetEnvironmentVariable($k, $v, "Process") }
  }
}
$urlFile = Join-Path $PSScriptRoot ".database-url.local"
if (Test-Path $urlFile) {
  [Environment]::SetEnvironmentVariable("DATABASE_URL", (Get-Content $urlFile -Raw).Trim(), "Process")
}
[Environment]::SetEnvironmentVariable("PORT", "4097", "Process")
[Environment]::SetEnvironmentVariable("CORS_ORIGIN", "http://localhost:3000,http://localhost:3001,https://dosco.live,https://truthopedia-web.vercel.app", "Process")
Set-Location $PSScriptRoot
& ".\veritas-server.exe" >> server.out.log 2>> server.err.log
