$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$AppPath = Join-Path $Root "Windows\AppStore - Config Manager.exe"

if (-not (Test-Path -LiteralPath $AppPath -PathType Leaf)) {
    Write-Host "Windows application was not found:" -ForegroundColor Red
    Write-Host $AppPath
    exit 1
}

$Command = '"' + $AppPath + '" "%1"'
$ProtocolKey = "HKCU:\Software\Classes\appstore-config"
New-Item -Path "$ProtocolKey\shell\open\command" -Force | Out-Null
Set-Item -Path $ProtocolKey -Value "URL:AppStore Config Manager Protocol"
New-ItemProperty -Path $ProtocolKey -Name "URL Protocol" -Value "" -PropertyType String -Force | Out-Null
Set-Item -Path "$ProtocolKey\shell\open\command" -Value $Command

Write-Host ""
Write-Host "Run button is now registered for this Windows user." -ForegroundColor Green
Write-Host "You can close this window and return to usage.html."
Write-Host "If the browser is already open, refresh usage.html."
