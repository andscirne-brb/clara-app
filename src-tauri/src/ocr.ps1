$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)
Add-Type -AssemblyName System.Runtime.WindowsRuntime
$null=[Windows.Storage.StorageFile,Windows.Storage,ContentType=WindowsRuntime]
$null=[Windows.Graphics.Imaging.BitmapDecoder,Windows.Foundation,ContentType=WindowsRuntime]
$null=[Windows.Media.Ocr.OcrEngine,Windows.Foundation,ContentType=WindowsRuntime]
$asTask=[System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object { $_.Name -eq 'AsTask' -and $_.IsGenericMethod -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1' } | Select-Object -First 1
function Await($op,$type) { $task=$asTask.MakeGenericMethod($type).Invoke($null,@($op)); if (-not $task.Wait(30000)) { throw 'Tempo de leitura excedido.' }; $task.GetAwaiter().GetResult() }
function Normal($text) {
 $s=$text.Normalize([Text.NormalizationForm]::FormD);$s=-join @($s.ToCharArray()|Where-Object{[Globalization.CharUnicodeInfo]::GetUnicodeCategory($_)-ne[Globalization.UnicodeCategory]::NonSpacingMark})
 return ($s.ToLowerInvariant()-replace'[^a-z0-9]','')
}
# Classify only bounded rows in the expanded eGO document panel. A button alone
# is never evidence of absence. Coordinates are kept independently of OCR order.
function Document-Rows($blocks,$imageHeight) {
 $labels=@('cadernetapredial','certificadoenergetico','contratodemediacaoimobiliaria','licencadehabitacao','outrosdocumentos');$fields=@('O','P','Q','R','')
 $headers=@();foreach($b in $blocks){$n=Normal $b.text;for($i=0;$i-lt$labels.Count;$i++){
  if($n-eq$labels[$i]-or$n-eq($labels[$i]+'adicionarficheiro')){$headers+=@([pscustomobject]@{block=$b;index=$i})}
 }}
 $headers=@($headers|Sort-Object{$_.block.top});$answer=@();$seen=@{}
 foreach($a in $headers){
  $h=$a.block;$i=$a.index;if($i-ge4-or$seen.ContainsKey($i)){continue}
  $next=@($headers|Where-Object{$_.index-eq($i+1)-and$_.block.top-gt($h.top+$h.height)-and[Math]::Abs($_.block.left-$h.left)-lt(2*$h.height)}|Select-Object -First 1)
  if($next.Count-ne1){continue};$end=$next[0].block
  # All category headings from the panel start must be visible and aligned.
  $first=@($headers|Where-Object{$_.index-eq0-and$_.block.top-le$h.top-and[Math]::Abs($_.block.left-$h.left)-lt(2*$h.height)}|Select-Object -Last 1)
  if($first.Count-ne1){continue}
  $panel=@($blocks|Where-Object{(Normal $_.text)-eq'documentos'-and$_.top-lt$first[0].block.top-and($first[0].block.top-$_.top)-lt(12*$h.height)})
  if(!$panel.Count-or$h.top-lt$h.height-or($end.top+$end.height)-gt($imageHeight-$h.height)){continue}
  $button=@($blocks|Where-Object{(Normal $_.text)-like'*adicionarficheiro'-and[Math]::Abs($_.top-$h.top)-le$h.height-and$_.right-gt($h.left+8*$h.height)})
  if(!$button.Count){continue};$right=($button|Measure-Object -Property right -Maximum).Maximum
  $inside=@($blocks|Where-Object{$_.top-gt($h.top+$h.height*0.75)-and($_.top+$_.height)-lt($end.top+$end.height*0.25)-and$_.left-ge($h.left-$h.height)-and$_.left-lt$right})
  $files=@($inside|Where-Object{$_.text-match'(?i)\.(pdf|docx?|png|jpe?g)\b'})
  $value='';$evidence=''
  if($files.Count){$value='Preenchido';$evidence='Ficheiro listado nesta categoria: '+$files[0].text}
  elseif(!$inside.Count-and($end.top-$h.top)-ge(1.7*[Math]::Max($h.height,$end.height))-and($end.top-$h.top)-le(3.8*[Math]::Max($h.height,$end.height))-and[Math]::Abs($end.height-$h.height)-le([Math]::Max($h.height,$end.height)*0.35)){
   $value='Em falta';$evidence='Categoria e ação Adicionar ficheiro visíveis; a categoria seguinte delimita a linha sem anexos. Confirmar antes de gravar.'
  }
  if($value){$answer+=@(@{field=$fields[$i];value=$value;evidence=$evidence});$seen[$i]=$true}
 }
 return ,$answer
}
$file=[System.IO.File]::OpenRead($env:CLARA_OCR_PATH)
$stream=[System.IO.WindowsRuntimeStreamExtensions]::AsRandomAccessStream($file)
try {
 $decoder=Await ([Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($stream)) ([Windows.Graphics.Imaging.BitmapDecoder])
 if ([long]$decoder.PixelWidth * [long]$decoder.PixelHeight -gt 100000000 -or $decoder.PixelWidth -gt [Windows.Media.Ocr.OcrEngine]::MaxImageDimension) { throw 'Imagem demasiado grande. Divide a captura em partes.' }
 $engine=[Windows.Media.Ocr.OcrEngine]::TryCreateFromUserProfileLanguages()
 if ($null -eq $engine) { throw 'OCR indisponivel. Instala um idioma OCR nas definicoes do Windows ou cola o texto.' }
 $lines=New-Object System.Collections.Generic.List[string]
 $blocks=New-Object System.Collections.Generic.List[object]
 $height=[Math]::Min(3000,[Windows.Media.Ocr.OcrEngine]::MaxImageDimension)
 for ($y=0; $y -lt $decoder.PixelHeight; $y += ($height-64)) {
  $transform=New-Object Windows.Graphics.Imaging.BitmapTransform
  $bounds=New-Object Windows.Graphics.Imaging.BitmapBounds
  $bounds.X=0; $bounds.Y=$y; $bounds.Width=$decoder.PixelWidth; $bounds.Height=[Math]::Min($height,$decoder.PixelHeight-$y)
  $transform.Bounds=$bounds
  $bitmap=Await ($decoder.GetSoftwareBitmapAsync([Windows.Graphics.Imaging.BitmapPixelFormat]::Bgra8,[Windows.Graphics.Imaging.BitmapAlphaMode]::Ignore,$transform,[Windows.Graphics.Imaging.ExifOrientationMode]::IgnoreExifOrientation,[Windows.Graphics.Imaging.ColorManagementMode]::DoNotColorManage)) ([Windows.Graphics.Imaging.SoftwareBitmap])
  try { $result=Await ($engine.RecognizeAsync($bitmap)) ([Windows.Media.Ocr.OcrResult]); foreach($line in $result.Lines) {
   $lines.Add($line.Text);$words=@($line.Words);if(!$words.Count){continue}
   $left=($words|ForEach-Object{$_.BoundingRect.X}|Measure-Object -Minimum).Minimum
   $top=($words|ForEach-Object{$_.BoundingRect.Y}|Measure-Object -Minimum).Minimum
   $right=($words|ForEach-Object{$_.BoundingRect.X+$_.BoundingRect.Width}|Measure-Object -Maximum).Maximum
   $bottom=($words|ForEach-Object{$_.BoundingRect.Y+$_.BoundingRect.Height}|Measure-Object -Maximum).Maximum
   $blocks.Add([pscustomobject]@{text=$line.Text;left=$left;right=$right;top=($top+$y);height=($bottom-$top)})
  } } finally { $bitmap.Dispose() }
 }
 $text=$lines -join "`n";$documents=Document-Rows $blocks $decoder.PixelHeight
 if($documents.Count){$text+="`n"+[char]30+'CLARA_DOCS_V1 '+(ConvertTo-Json -InputObject @($documents) -Depth 4 -Compress)}
 @{text=$text;language=$engine.RecognizerLanguage.LanguageTag} | ConvertTo-Json -Compress
} finally { $stream.Dispose(); $file.Dispose() }
