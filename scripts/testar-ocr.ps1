# Apenas dados sinteticos. Nenhuma captura real entra no repositorio.
$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.Drawing
$bitmap=New-Object System.Drawing.Bitmap(1200,9000)
$g=[System.Drawing.Graphics]::FromImage($bitmap)
$g.Clear([System.Drawing.Color]::White)
$font=New-Object System.Drawing.Font('Arial',36)
$g.DrawString('CLARA TESTE MORADIA', $font, [System.Drawing.Brushes]::Black, 40, 40)
$g.DrawString('COZINHA EQUIPADA TESTE', $font, [System.Drawing.Brushes]::Black, 40, 8000)
$path=Join-Path ([System.IO.Path]::GetTempPath()) ('clara-ocr-'+[guid]::NewGuid().ToString()+'.png')
try {
 $bitmap.Save($path,[System.Drawing.Imaging.ImageFormat]::Png)
 $env:CLARA_OCR_PATH=$path
 $scriptPath=if($PSScriptRoot){Join-Path $PSScriptRoot '../src-tauri/src/ocr.ps1'}else{Join-Path (Get-Location) 'clara/src-tauri/src/ocr.ps1'}
 $result=Get-Content -Raw $scriptPath | & "$env:SystemRoot/System32/WindowsPowerShell/v1.0/powershell.exe" -NoProfile -NonInteractive -Command -
 if ($LASTEXITCODE -ne 0) {throw 'OCR falhou.'}
 $parsed=$result | ConvertFrom-Json
 if ($parsed.text -notmatch 'MORADIA' -or $parsed.text -notmatch 'EQUIPADA') {throw 'OCR nao leu o principio e o fim da captura longa.'}
 Write-Output 'OCR local: PASS (captura sintetica longa, principio e fim).'
} finally {$g.Dispose();$font.Dispose();$bitmap.Dispose();if(Test-Path -LiteralPath $path){Remove-Item -LiteralPath $path}}
