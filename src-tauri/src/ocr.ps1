$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)
Add-Type -AssemblyName System.Runtime.WindowsRuntime
$null=[Windows.Storage.StorageFile,Windows.Storage,ContentType=WindowsRuntime]
$null=[Windows.Graphics.Imaging.BitmapDecoder,Windows.Foundation,ContentType=WindowsRuntime]
$null=[Windows.Media.Ocr.OcrEngine,Windows.Foundation,ContentType=WindowsRuntime]
$asTask=[System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object { $_.Name -eq 'AsTask' -and $_.IsGenericMethod -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1' } | Select-Object -First 1
function Await($op,$type) { $task=$asTask.MakeGenericMethod($type).Invoke($null,@($op)); if (-not $task.Wait(30000)) { throw 'Tempo de leitura excedido.' }; $task.GetAwaiter().GetResult() }
$file=[System.IO.File]::OpenRead($env:CLARA_OCR_PATH)
$stream=[System.IO.WindowsRuntimeStreamExtensions]::AsRandomAccessStream($file)
try {
 $decoder=Await ([Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($stream)) ([Windows.Graphics.Imaging.BitmapDecoder])
 if ([long]$decoder.PixelWidth * [long]$decoder.PixelHeight -gt 100000000 -or $decoder.PixelWidth -gt [Windows.Media.Ocr.OcrEngine]::MaxImageDimension) { throw 'Imagem demasiado grande. Divide a captura em partes.' }
 $engine=[Windows.Media.Ocr.OcrEngine]::TryCreateFromUserProfileLanguages()
 if ($null -eq $engine) { throw 'OCR indisponivel. Instala um idioma OCR nas definicoes do Windows ou cola o texto.' }
 $lines=New-Object System.Collections.Generic.List[string]
 $height=[Math]::Min(3000,[Windows.Media.Ocr.OcrEngine]::MaxImageDimension)
 for ($y=0; $y -lt $decoder.PixelHeight; $y += ($height-64)) {
  $transform=New-Object Windows.Graphics.Imaging.BitmapTransform
  $bounds=New-Object Windows.Graphics.Imaging.BitmapBounds
  $bounds.X=0; $bounds.Y=$y; $bounds.Width=$decoder.PixelWidth; $bounds.Height=[Math]::Min($height,$decoder.PixelHeight-$y)
  $transform.Bounds=$bounds
  $bitmap=Await ($decoder.GetSoftwareBitmapAsync([Windows.Graphics.Imaging.BitmapPixelFormat]::Bgra8,[Windows.Graphics.Imaging.BitmapAlphaMode]::Ignore,$transform,[Windows.Graphics.Imaging.ExifOrientationMode]::IgnoreExifOrientation,[Windows.Graphics.Imaging.ColorManagementMode]::DoNotColorManage)) ([Windows.Graphics.Imaging.SoftwareBitmap])
  try { $result=Await ($engine.RecognizeAsync($bitmap)) ([Windows.Media.Ocr.OcrResult]); foreach($line in $result.Lines) { $lines.Add($line.Text) } } finally { $bitmap.Dispose() }
 }
 @{text=($lines -join "`n");language=$engine.RecognizerLanguage.LanguageTag} | ConvertTo-Json -Compress
} finally { $stream.Dispose(); $file.Dispose() }
