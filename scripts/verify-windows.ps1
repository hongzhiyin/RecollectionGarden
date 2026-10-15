param([string]$Package)
$ErrorActionPreference = 'Stop'
$Package = (Resolve-Path $Package).Path
$env:RG_DESKTOP_DATA_DIR = Join-Path $env:RUNNER_TEMP ('rg-smoke-' + [guid]::NewGuid())
New-Item -ItemType Directory -Path $env:RG_DESKTOP_DATA_DIR | Out-Null
$report = Join-Path $env:RG_DESKTOP_DATA_DIR 'native.json'
$fixture = (Resolve-Path 'tests/fixtures/text-navigation.pdf').Path
$app = Start-Process (Join-Path $Package 'RecollectionGarden.exe') -ArgumentList "--verify `"$fixture`" `"$report`"" -PassThru
try {
    $deadline = (Get-Date).AddSeconds(90)
    while (!(Test-Path $report)) {
        if ($app.HasExited -or (Get-Date) -gt $deadline) { throw 'Native app did not complete its verification.' }
        Start-Sleep -Milliseconds 250
    }
    $result = Get-Content $report -Raw | ConvertFrom-Json
    if (!$result.ok) { throw ($result | ConvertTo-Json -Depth 8) }
    node scripts/windows-mcp-smoke.mjs $Package (Join-Path $env:RG_DESKTOP_DATA_DIR 'mcp.json')
    if ($LASTEXITCODE -ne 0) { throw 'Packaged CLI/MCP verification failed.' }
} finally {
    Set-Content ($report + '.stop') 'stop'
    if (!$app.WaitForExit(10000)) { Stop-Process -Id $app.Id -Force }
    New-Item -ItemType Directory -Force 'test-results/windows-native' | Out-Null
    Get-ChildItem $env:RG_DESKTOP_DATA_DIR -File | Where-Object { $_.Name -in @('native.json','native.json.png','mcp.json','desktop.log') } | Copy-Item -Destination 'test-results/windows-native'
}
