$ErrorActionPreference='Stop'
$script=Get-Content -Raw -Encoding UTF8 (Join-Path $PSScriptRoot '../src-tauri/src/ocr.ps1')
# Run the same row classifier using synthetic OCR rectangles; no client captures.
$start=$script.IndexOf('function Normal(');$end=$script.IndexOf('$file=[System.IO.File]')
Invoke-Expression $script.Substring($start,$end-$start)
function Block($text,$top,$left=25,$height=12){[pscustomobject]@{text=$text;top=$top;left=$left;right=($left+150);height=$height}}
function Expect($condition,$message){if(!$condition){throw $message}}
$rows=@((Block 'Documentos' 20),(Block 'Caderneta Predial' 100),(Block 'Certificado Energético' 136),(Block 'Contrato de Mediação Imobiliária' 172),(Block 'Licença de Habitação' 208),(Block 'Outros documentos' 244),(Block 'Lux Garden_Faro.pdf' 280))
foreach($y in @(100,136,172,208,244)){$rows+=Block 'Adicionar ficheiro' $y 500}
$result=Document-Rows $rows 400
Expect ($result.Count-eq4) 'Quatro categorias vazias delimitadas.'
Expect (@($result|Where-Object{$_.value-ne'Em falta'}).Count-eq0) 'Outros documentos não preenche categorias anteriores.'
Expect ((Document-Rows @($rows|Where-Object{$_.text-ne'Documentos'}) 400).Count-eq0) 'Painel sem início visível é desconhecido.'
Expect (@((Document-Rows $rows 220)|Where-Object{$_.field-eq'R'}).Count-eq0) 'Categoria cortada não prova ausência.'
Expect ((Document-Rows @($rows|Where-Object{$_.left-lt500}) 400).Count-eq0) 'Lado direito cortado não prova ausência.'
$attached=@($rows|ForEach-Object{if($_.top-ge136){Block $_.text ($_.top+36) $_.left $_.height}else{$_}})+(Block 'Caderneta_TESTE.pdf' 136)
$result=Document-Rows $attached 450
Expect (@($result|Where-Object{$_.field-eq'O'-and$_.value-eq'Preenchido'}).Count-eq1) 'Anexo dentro da categoria dá proposta de presença.'
$unreadable=@($attached|ForEach-Object{if($_.text-eq'Caderneta_TESTE.pdf'){Block 'Nome ilegível' $_.top}else{$_}})
Expect (@((Document-Rows $unreadable 450)|Where-Object{$_.field-eq'O'}).Count-eq0) 'Conteúdo não reconhecido não é uma ausência.'
Write-Output 'PASS: vazio delimitado, anexo, Outros, recortes e conteúdo ilegível.'
