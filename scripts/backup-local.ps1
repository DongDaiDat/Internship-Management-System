param(
    [ValidateSet('main', 'qa', 'release')][string]$Stack = 'main',
    [switch]$Execute
)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
$composeFile = switch ($Stack) {
    'qa' { 'docker-compose.e2e.yml' }
    'release' { 'docker-compose.release.yml' }
    default { 'docker-compose.yml' }
}
$composeArgs = @('compose', '--project-directory', $projectRoot, '-f', (Join-Path $projectRoot $composeFile))
function Invoke-DockerChecked([string[]]$Arguments) {
    $result = & docker @Arguments
    if ($LASTEXITCODE -ne 0) { throw "Docker failed: $($Arguments[0]) (exit $LASTEXITCODE)" }
    return $result
}
if (-not $Execute) {
    Write-Output "Preview only: stack=$Stack; config=$composeFile. No containers or files changed."
    Write-Output 'With -Execute: pause running frontend/backend/MinIO, dump PostgreSQL, copy private storage, hash files, restart previously running services.'
    Write-Output 'Output: .local/backups/<stack>-<timestamp>-<random>. Keep this sensitive backup private.'
    exit 0
}
$ids = @{}
$wasRunning = @{}
foreach ($service in @('postgres', 'minio', 'backend', 'frontend')) {
    $id = Invoke-DockerChecked ($composeArgs + @('ps', '-a', '-q', $service))
    if (-not $id -or @($id).Count -ne 1) { throw "Expected exactly one existing container for $service; start the chosen stack first." }
    $ids[$service] = "$id".Trim()
    $wasRunning[$service] = (Invoke-DockerChecked @('inspect', '-f', '{{.State.Running}}', $ids[$service])) -eq 'true'
}
if (-not $wasRunning['postgres']) { throw 'PostgreSQL must be running. No services were stopped.' }
$suffix = [guid]::NewGuid().ToString('N')
$destination = Join-Path $projectRoot ".local/backups/$Stack-$(Get-Date -Format 'yyyyMMdd-HHmmss')-$suffix"
$dumpPath = "/tmp/internship-backup-$suffix.dump"
$resume = @('minio', 'backend', 'frontend') | Where-Object { $wasRunning[$_] }
$complete = $false
New-Item -ItemType Directory -Path $destination | Out-Null
try {
    $pause = @('frontend', 'backend', 'minio') | Where-Object { $wasRunning[$_] }
    if ($pause.Count -gt 0) { Invoke-DockerChecked ($composeArgs + @('stop') + $pause) | Out-Null }
    # Use container files, never a PowerShell binary pipeline. Credentials stay in the container.
    Invoke-DockerChecked @('exec', $ids['postgres'], 'sh', '-c', 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc -f "$1"', '--', $dumpPath) | Out-Null
    Invoke-DockerChecked @('exec', $ids['postgres'], 'pg_restore', '--list', $dumpPath) | Out-Null
    Invoke-DockerChecked @('cp', "$($ids['postgres']):$dumpPath", (Join-Path $destination 'database.dump')) | Out-Null
    Invoke-DockerChecked @('cp', "$($ids['minio']):/data", (Join-Path $destination 'minio-data')) | Out-Null
    $files = Get-ChildItem -LiteralPath $destination -File -Recurse -Force | ForEach-Object {
        @{ path = [IO.Path]::GetRelativePath($destination, $_.FullName); bytes = $_.Length; sha256 = (Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash }
    }
    $manifest = @{ version = 1; stack = $Stack; createdAtUtc = [DateTime]::UtcNow.ToString('o'); files = @($files); restoreVerified = $false }
    $manifest | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $destination 'manifest.json') -Encoding utf8
    $complete = $true
} finally {
    # Delete only this invocation's exact temporary dump inside the selected container.
    & docker exec $ids['postgres'] rm -f $dumpPath
    if ($resume.Count -gt 0) { Invoke-DockerChecked ($composeArgs + @('start') + $resume) | Out-Null }
    if (-not $complete) { Write-Warning "Incomplete backup retained for diagnosis: $destination. Do not use it for restore." }
}
Write-Output "Backup created: $destination. Restore has NOT yet been verified."
