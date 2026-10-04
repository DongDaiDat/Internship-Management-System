param(
    [Parameter(Mandatory)][string]$BackupPath,
    [switch]$Execute
)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
$backupRoot = [IO.Path]::GetFullPath((Join-Path $projectRoot '.local/backups')) + [IO.Path]::DirectorySeparatorChar
$source = (Resolve-Path -LiteralPath $BackupPath).Path
if (-not $source.StartsWith($backupRoot, [StringComparison]::OrdinalIgnoreCase)) { throw 'Only local backups under this project .local/backups are accepted.' }
if ((Get-Item -LiteralPath $source -Force).Attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'Backup directory links are not accepted.' }
$manifest = Get-Content -LiteralPath (Join-Path $source 'manifest.json') -Raw | ConvertFrom-Json
if ($manifest.version -ne 1 -or $manifest.stack -ne 'qa') { throw 'Rehearsal accepts version 1 QA backups only; never restore main data here.' }
$seen = @{}
foreach ($entry in $manifest.files) {
    $path = [IO.Path]::GetFullPath((Join-Path $source $entry.path))
    if (-not $path.StartsWith($source + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) { throw 'Invalid manifest path.' }
    if ($seen.ContainsKey($path)) { throw 'Duplicate manifest path.' }
    $seen[$path] = $true
    $file = Get-Item -LiteralPath $path -Force
    if ($file.PSIsContainer -or $file.Length -ne $entry.bytes -or (Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash -ne $entry.sha256) { throw "Backup checksum mismatch: $($entry.path)" }
}
foreach ($file in Get-ChildItem -LiteralPath $source -Force -Recurse) {
    if ($file.Attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'Backup links are not accepted.' }
    if (-not $file.PSIsContainer -and $file.Name -ne 'manifest.json' -and -not $seen.ContainsKey($file.FullName)) { throw 'Unlisted backup file.' }
}
if (-not $seen.ContainsKey((Join-Path $source 'database.dump')) -or -not (Test-Path -LiteralPath (Join-Path $source 'minio-data') -PathType Container)) { throw 'Backup is missing database or storage.' }
if (-not $Execute) { Write-Output 'PASS: QA backup checksums verified. Preview only; no Docker changes.'; exit 0 }
$project = 'internship-restore-' + [guid]::NewGuid().ToString('N').Substring(0, 12)
$composeArgs = @('compose', '--project-directory', $projectRoot, '-f', (Join-Path $projectRoot 'docker-compose.restore.yml'), '-p', $project)
function Invoke-DockerChecked([string[]]$Arguments) {
    $result = & docker @Arguments
    if ($LASTEXITCODE -ne 0) { throw "Docker failed (exit $LASTEXITCODE). Restore project retained: $project" }
    return $result
}
# A fresh random project owns fresh volumes. Never use --clean or overwrite existing data.
if (Invoke-DockerChecked @('ps', '-aq', '--filter', "label=com.docker.compose.project=$project")) { throw 'Restore project already exists.' }
Write-Output "Isolated restore project: $project"
Invoke-DockerChecked ($composeArgs + @('up', '-d', '--wait', 'postgres')) | Out-Null
Invoke-DockerChecked ($composeArgs + @('create', 'minio')) | Out-Null
$pg = Invoke-DockerChecked ($composeArgs + @('ps', '-q', 'postgres'))
$minio = Invoke-DockerChecked ($composeArgs + @('ps', '-a', '-q', 'minio'))
Invoke-DockerChecked @('cp', (Join-Path $source 'database.dump'), "${pg}:/tmp/restore.dump") | Out-Null
Invoke-DockerChecked @('exec', $pg, 'sh', '-c', 'pg_restore --exit-on-error --no-owner --no-privileges -U "$POSTGRES_USER" -d "$POSTGRES_DB" /tmp/restore.dump') | Out-Null
Invoke-DockerChecked @('cp', ((Join-Path $source 'minio-data') + '/.'), "${minio}:/data") | Out-Null
Invoke-DockerChecked ($composeArgs + @('start', 'minio')) | Out-Null
Write-Output "Restore loaded; data comparison still required. Project: $project"
Write-Output "Compare: docker compose -f docker-compose.restore.yml -p $project run --rm verify"
Write-Output "Stop afterward (preserve volumes): docker compose -f docker-compose.restore.yml -p $project stop"
