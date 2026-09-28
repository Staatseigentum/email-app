$ErrorActionPreference = 'Stop'

$repo = Split-Path $PSScriptRoot -Parent
$release = [IO.Path]::GetFullPath((Join-Path $repo 'release'))
$sandbox = [IO.Path]::GetFullPath((Join-Path $release ("bootstrap-smoke-" + [guid]::NewGuid().ToString('N'))))
$releasePrefix = $release.TrimEnd([IO.Path]::DirectorySeparatorChar) + [IO.Path]::DirectorySeparatorChar
if (-not $sandbox.StartsWith($releasePrefix, [StringComparison]::OrdinalIgnoreCase)) {
    throw 'Testordner liegt außerhalb von release.'
}

$csc = @(
    (Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'),
    (Join-Path $env:WINDIR 'Microsoft.NET\Framework\v4.0.30319\csc.exe')
) | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
if (-not $csc) { throw 'csc.exe wurde nicht gefunden.' }

try {
    $install = Join-Path $sandbox 'MailWave Test'
    $update = Join-Path $sandbox 'mailwave-update-deadbeef'
    New-Item -ItemType Directory -Path $install, $update -Force | Out-Null

    $bootstrap = Join-Path $update 'Updater.exe'
    $setup = Join-Path $update 'MailWave-Setup-9.9.9.exe'
    $launch = Join-Path $install 'MailWave.exe'
    $fixture = Join-Path $PSScriptRoot 'BootstrapFixture.cs'

    & $csc /nologo /target:winexe "/out:$bootstrap" /reference:System.Windows.Forms.dll (Join-Path $repo 'installer\Updater.cs')
    if ($LASTEXITCODE -ne 0) { throw 'Updater-Kompilierung fehlgeschlagen.' }
    & $csc /nologo /target:winexe /define:SETUP "/out:$setup" $fixture
    if ($LASTEXITCODE -ne 0) { throw 'Test-Setup-Kompilierung fehlgeschlagen.' }
    & $csc /nologo /target:winexe "/out:$launch" $fixture
    if ($LASTEXITCODE -ne 0) { throw 'Test-App-Kompilierung fehlgeschlagen.' }

    $updaterProcess = Start-Process -FilePath $bootstrap -ArgumentList @(
        '--setup', "`"$setup`"", '--wait', '999999999',
        '--launch', "`"$launch`"", '--version', '9.9.9'
    ) -Wait -PassThru -WindowStyle Hidden
    if ($updaterProcess.ExitCode -ne 0) { throw "Updater beendete sich mit Code $($updaterProcess.ExitCode)." }

    $argsFile = Join-Path $install 'setup-args.txt'
    $versionFile = Join-Path $install 'resources\mailwave-version.txt'
    $launchedFile = Join-Path $install 'launch-ok.txt'
    if (-not (Test-Path -LiteralPath $argsFile)) { throw 'Test-Setup wurde nicht ausgeführt.' }
    if ((Get-Content -LiteralPath $versionFile -Raw).Trim() -ne '9.9.9') { throw 'Version wurde nicht installiert.' }
    $argsText = Get-Content -LiteralPath $argsFile -Raw
    if (-not $argsText.Contains("/D=$install")) { throw 'Installationsordner wurde nicht übergeben.' }
    for ($attempt = 0; $attempt -lt 50 -and -not (Test-Path -LiteralPath $launchedFile); $attempt++) {
        Start-Sleep -Milliseconds 100
    }
    if (-not (Test-Path -LiteralPath $launchedFile)) { throw 'MailWave wurde nicht neu gestartet.' }
    Write-Output 'Bootstrap-Smoke-Test erfolgreich: Setup, Zielordner, Version und Neustart.'
}
finally {
    # Der zu löschende absolute Pfad wurde oben auf den release-Unterordner begrenzt.
    for ($attempt = 0; $attempt -lt 30 -and (Test-Path -LiteralPath $sandbox); $attempt++) {
        try {
            Remove-Item -LiteralPath $sandbox -Recurse -Force -ErrorAction Stop
        }
        catch [System.UnauthorizedAccessException] {
            Start-Sleep -Milliseconds 200
        }
    }
    if (Test-Path -LiteralPath $sandbox) {
        Write-Warning 'Windows sperrt die gerade ausgeführte Test-EXE noch; Rest liegt unter release/.'
    }
}
