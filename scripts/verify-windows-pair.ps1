param([string]$ReaderPackage, [string]$AiPackage)
$ErrorActionPreference = 'Stop'
$ReaderPackage = (Resolve-Path $ReaderPackage).Path
$AiPackage = (Resolve-Path $AiPackage).Path
$root = Join-Path $env:RUNNER_TEMP ('rg-pair-' + [guid]::NewGuid())
New-Item -ItemType Directory $root | Out-Null
$fixtureHost = Start-Process node -ArgumentList "scripts/windows-pair-fixture.mjs `"$ReaderPackage`" `"$AiPackage`" `"$root`"" -PassThru -RedirectStandardOutput "$root/fixture.stdout" -RedirectStandardError "$root/fixture.stderr"
$app = $null
try {
    $deadline = (Get-Date).AddSeconds(30)
    while (!(Test-Path "$root/ready.json")) {
        if ($fixtureHost.HasExited -or (Get-Date) -gt $deadline) { throw "Fixture startup failed: $(Get-Content "$root/fixture.stderr" -Raw)" }
        Start-Sleep -Milliseconds 200
    }
    $ready = Get-Content "$root/ready.json" -Raw | ConvertFrom-Json
    $env:RG_DESKTOP_DATA_DIR = $ready.readerProfile
    $env:DREAMEDGE_DATA_DIR = $ready.aiProfile
    $env:DREAMEDGE_NO_DIALOGS = '1'
    $env:DREAMEDGE_LAUNCH_DIAGNOSTICS = '1'
    $env:RG_VERIFY_AI_PAIR = '1'
    $report = Join-Path $root 'native.json'
    $fixture = (Resolve-Path 'tests/fixtures/text-navigation.pdf').Path
    $app = Start-Process (Join-Path $ReaderPackage 'RecollectionGarden.exe') -ArgumentList "--verify `"$fixture`" `"$report`"" -PassThru
    $deadline = (Get-Date).AddMinutes(4)
    while (!(Test-Path $report)) {
        if ($app.HasExited -or (Get-Date) -gt $deadline) { throw 'Packaged Windows pair verification timed out.' }
        Start-Sleep -Milliseconds 250
    }
    $result = Get-Content $report -Raw | ConvertFrom-Json
    if (!$result.ok) { throw ($result | ConvertTo-Json -Depth 8) }
    $pair = Get-Content "$report.pair.json" -Raw | ConvertFrom-Json
    if (!$pair.ok) { throw 'Pair verification did not pass.' }
} finally {
    if ($app) { Set-Content "$root/native.json.stop" 'stop'; if (!$app.WaitForExit(10000)) { Stop-Process -Id $app.Id -Force } }
    $env:DREAMEDGE_DATA_DIR = Join-Path $root 'ai'
    try { $state = & (Join-Path $AiPackage 'dreamedge-cli.exe') status | ConvertFrom-Json; if ($state.data.pid) { Stop-Process -Id $state.data.pid -Force } } catch { }
    if (!$fixtureHost.HasExited) { Stop-Process -Id $fixtureHost.Id -Force }
    New-Item -ItemType Directory -Force 'test-results/windows-pair' | Out-Null
    Get-ChildItem $root -File | Copy-Item -Destination 'test-results/windows-pair'
    Get-ChildItem (Join-Path $root 'reader') -Filter '*diagnostic*' | Copy-Item -Destination 'test-results/windows-pair'
    Get-ChildItem (Join-Path $root 'reader') -Filter 'native-events.jsonl' | Copy-Item -Destination 'test-results/windows-pair'
    Get-ChildItem (Join-Path $root 'ai') -Filter '*diagnostics.log' | Copy-Item -Destination 'test-results/windows-pair'
    Remove-Item Env:RG_VERIFY_AI_PAIR -ErrorAction SilentlyContinue
}
