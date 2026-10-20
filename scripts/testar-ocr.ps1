$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.Drawing
$folder=Join-Path $PSScriptRoot '../qa-output/ocr'
[void][IO.Directory]::CreateDirectory($folder)
$path=[IO.Path]::GetFullPath((Join-Path $folder 'TESTE-01.png'))
$bmp=[Drawing.Bitmap]::new(1500,650);$g=[Drawing.Graphics]::FromImage($bmp);$g.Clear([Drawing.Color]::White);$font=[Drawing.Font]::new('Arial',28)
try{$g.DrawString("TESTE-01`nDESCRIÇÃO`nMoradia de teste com cozinha equipada.`nCARACTERÍSTICAS",$font,[Drawing.Brushes]::Black,30,30);$bmp.Save($path,[Drawing.Imaging.ImageFormat]::Png)}finally{$font.Dispose();$g.Dispose();$bmp.Dispose()}
$env:CLARA_OCR_PATH=$path
$script=Join-Path $PSScriptRoot '../src-tauri/src/ocr.ps1'
# Same complete-program launch used by the app; do not substitute -File or stdin.
$program=[IO.File]::ReadAllText($script,[Text.Encoding]::UTF8)
$encoded=[Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes($program))
$result=& powershell.exe -NoProfile -NonInteractive -EncodedCommand $encoded
if($LASTEXITCODE-ne0){throw 'OCR local indisponível ou falhou.'}
$data=($result -join "`n")|ConvertFrom-Json
if($data.text-notmatch'TESTE-[0O][1Il]'-or$data.text-notmatch'cozinha equipada'){throw 'OCR não reconheceu o texto fictício esperado.'}
Write-Output 'PASS: OCR Windows reconheceu a referência e o texto da imagem fictícia.'
