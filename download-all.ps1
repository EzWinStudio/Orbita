$ErrorActionPreference = 'Stop'

$output = Join-Path (Get-Location) 'EZWIN-REPOS'
New-Item -ItemType Directory -Force -Path $output | Out-Null

$repos = @(
    'ezwin-hub-app',
    'ezwin-hub-website',
    'simsek-diecast-website',
    'cata-store-website',
    'ezcraft-website',
    'ezwinmusic-website',
    'ezwin-corporation-website',
    'ezwin-fivem-website',
    'ezwin-hesap-website',
    'ezwin-site-sys-website',
    'ezwin-template-website',
    'ezwin-uncopylocked-website',
    'ezwin-cheat-website',
    'Project2',
    'EzWinStudio'
)

foreach ($repo in $repos) {
    $zip = Join-Path $output "$repo.zip"
    $url = "https://github.com/EzWinStudio/$repo/archive/refs/heads/main.zip"
    Write-Host "İndiriliyor: $repo"
    Invoke-WebRequest -Uri $url -OutFile $zip
    Expand-Archive -Path $zip -DestinationPath $output -Force
    Remove-Item $zip
}

$installer = Join-Path $output 'Orbita-Setup-2.0.1.exe'
$installerUrl = 'https://github.com/EzWinStudio/ezwin-hub-app/releases/download/v2.0.1/Orbita-Setup-2.0.1.exe'
Write-Host 'İndiriliyor: Windows kurulum paketi'
Invoke-WebRequest -Uri $installerUrl -OutFile $installer
$hash = (Get-FileHash -Algorithm SHA256 -Path $installer).Hash.ToLower()
if ($hash -ne 'c6655a0fc10c9c4cadc9b31c1c7cedc4d080f4100e071df4a1a04ee7fdf14344') {
    throw "Kurulum paketi doğrulanamadı: $hash"
}

Write-Host "Tamamlandı: $output"
