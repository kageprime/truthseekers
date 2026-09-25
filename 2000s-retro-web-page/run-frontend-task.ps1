# Task entrypoint: keeps `pnpm dev` alive outside any shell session
# (shell-spawned processes are reaped when the session ends).
Set-Location $PSScriptRoot
[Environment]::SetEnvironmentVariable("NEXT_PUBLIC_API_URL", "http://localhost:4097", "Process")
# ponytail: :3000 belongs to another project on this machine (linkedge) —
# ours lives on :3001 to stop fighting over the port.
& "C:\Users\kage\AppData\Roaming\npm\pnpm.cmd" dev -- -p 3001 >> dev.out.log 2>> dev.err.log
