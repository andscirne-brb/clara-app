$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem
function Xml-Read([string]$text) {
 $settings=[System.Xml.XmlReaderSettings]::new();$settings.DtdProcessing='Prohibit';$settings.XmlResolver=$null
 $reader=[System.Xml.XmlReader]::Create([System.IO.StringReader]::new($text),$settings)
 $doc=[System.Xml.XmlDocument]::new();$doc.PreserveWhitespace=$true;$doc.XmlResolver=$null
 try{$doc.Load($reader)}finally{$reader.Dispose()};return ,$doc
}
function Entry-Text($zip,[string]$name){$e=$zip.GetEntry($name);if(!$e){throw 'Componente do Excel em falta.'};$r=[IO.StreamReader]::new($e.Open());try{return $r.ReadToEnd()}finally{$r.Dispose()}}
function Entry-Path([string]$base,[string]$target){
 if($target.StartsWith('/')){$base='';$target=$target.TrimStart('/')}
 $parts=[Collections.Generic.List[string]]::new();foreach($v in (($base+'/'+$target)-split'/')){if(!$v-or$v-eq'.'){continue};if($v-eq'..'){if(!$parts.Count){throw 'Caminho inválido no Excel.'};$parts.RemoveAt($parts.Count-1)}else{$parts.Add($v)}};return $parts -join '/'
}
function Namespace($doc){$n=[Xml.XmlNamespaceManager]::new($doc.NameTable);$n.AddNamespace('m','http://schemas.openxmlformats.org/spreadsheetml/2006/main');$n.AddNamespace('r','http://schemas.openxmlformats.org/officeDocument/2006/relationships');return ,$n}
function Cell-Text($cell,$ns,$shared){
 if(!$cell){return ''};$v=$cell.SelectSingleNode('m:v',$ns)
 if($cell.GetAttribute('t')-eq's'){return $shared[[int]$v.InnerText]}
 if($cell.GetAttribute('t')-eq'inlineStr'){return $cell.SelectSingleNode('m:is',$ns).InnerText}
 if($v){return $v.InnerText};return ''
}
function Put-Cell($doc,$row,$ns,[string]$column,[string]$text,[bool]$number=$false){
 $addr=$column+$row.GetAttribute('r');$c=$row.SelectSingleNode("m:c[@r='$addr']",$ns)
 if(!$c){$c=$doc.CreateElement('c',$ns.LookupNamespace('m'));$c.SetAttribute('r',$addr);[void]$row.AppendChild($c)}
 while($c.HasChildNodes){[void]$c.RemoveChild($c.FirstChild)}
 if($number){$c.RemoveAttribute('t');$v=$doc.CreateElement('v',$ns.LookupNamespace('m'));$v.InnerText=$text;[void]$c.AppendChild($v)}else{
 $c.SetAttribute('t','inlineStr');$i=$doc.CreateElement('is',$ns.LookupNamespace('m'));$t=$doc.CreateElement('t',$ns.LookupNamespace('m'));[void]$t.SetAttribute('space','http://www.w3.org/XML/1998/namespace','preserve');$t.InnerText=$text;[void]$i.AppendChild($t);[void]$c.AppendChild($i)
 }
}
$handle=$null;$archive=$null;$memory=$null;$original=$null;$mutating=$false
try{
 $request=([Console]::In.ReadToEnd()|ConvertFrom-Json);$path=[IO.Path]::GetFullPath($request.path);$w=$request.work
 # The exclusive handle blocks Excel/Drive writes locally until the operation finishes.
 $handle=[IO.FileStream]::new($path,[IO.FileMode]::Open,[IO.FileAccess]::ReadWrite,[IO.FileShare]::None)
 if($handle.Length-gt20971520){throw 'O Excel excede 20 MB.'}
 $original=[byte[]]::new([int]$handle.Length);$offset=0;while($offset-lt$original.Length){$n=$handle.Read($original,$offset,$original.Length-$offset);if(!$n){throw 'Leitura incompleta.'};$offset+=$n}
 $sha=[Security.Cryptography.SHA256]::Create();try{$hash=([BitConverter]::ToString($sha.ComputeHash($original))).Replace('-','').ToLowerInvariant()}finally{$sha.Dispose()}
 $memory=[IO.MemoryStream]::new();$memory.Write($original,0,$original.Length);$memory.Position=0
 $archive=[IO.Compression.ZipArchive]::new($memory,[IO.Compression.ZipArchiveMode]::Update,$true)
 if($archive.Entries.Count-gt5000-or(($archive.Entries|Measure-Object -Property Length -Sum).Sum)-gt134217728){throw 'Estrutura do Excel demasiado grande.'}
 $book=Xml-Read (Entry-Text $archive 'xl/workbook.xml');$bn=Namespace $book
 $rels=Xml-Read (Entry-Text $archive 'xl/_rels/workbook.xml.rels')
 $sheet=$book.SelectSingleNode("//m:sheet[@name='Registo de alterações']",$bn);$main=$book.SelectSingleNode("//m:sheet[@name='Levantamento']",$bn)
 if(!$sheet-or!$main){throw 'Escolhe o levantamento principal atualizado.'}
 function Sheet-Path($node){$id=$node.GetAttribute('id',$bn.LookupNamespace('r'));$link=@($rels.DocumentElement.ChildNodes|Where-Object{$_.Id-eq$id});if($link.Count-ne1-or$link[0].TargetMode-eq'External'){throw 'Relação do Excel inválida.'};return Entry-Path 'xl' $link[0].Target}
 $shared=@();if($archive.GetEntry('xl/sharedStrings.xml')){$sd=Xml-Read (Entry-Text $archive 'xl/sharedStrings.xml');$sn=Namespace $sd;$shared=@($sd.SelectNodes('//m:si',$sn)|ForEach-Object{$_.InnerText})}
 $sheetPath=Sheet-Path $sheet;$doc=Xml-Read (Entry-Text $archive $sheetPath);$ns=Namespace $doc
 $header=$doc.SelectSingleNode("//m:row[@r='5']",$ns);$expected=@('Data da alteração','Referência EGO','ID da pendência','Autor','Onde foi alterado','Campo / assunto','Antes','Depois / alteração realizada','Motivo / fonte','Resultado da verificação','Data da verificação','Verificado por')
 for($i=0;$i-lt12;$i++){$addr=([char](65+$i)).ToString()+'5';if((Cell-Text ($header.SelectSingleNode("m:c[@r='$addr']",$ns)) $ns $shared)-ne$expected[$i]){throw 'Cabeçalhos do registo diferentes. Não foi alterado o ficheiro.'}}
 $marker='Clara registo '+$w.id
 $existing=@($doc.SelectNodes('//m:row/m:c',$ns)|Where-Object{$_.GetAttribute('r')-match'^I[0-9]+$'-and(Cell-Text $_ $ns $shared).Contains($marker)})
 if($existing.Count){@{already_written=$true;file_name=[IO.Path]::GetFileName($path);recovery_file=$null}|ConvertTo-Json -Compress;exit 0}
 if($hash-ne$request.expected_hash){throw 'O ficheiro mudou desde a pré-visualização. Atualiza a leitura e confirma novamente.'}
 $mainDoc=Xml-Read (Entry-Text $archive (Sheet-Path $main));$mn=Namespace $mainDoc
 $matching=@($mainDoc.SelectNodes('//m:row/m:c',$mn)|Where-Object{$_.GetAttribute('r')-match'^A[0-9]+$'-and(Cell-Text $_ $mn $shared)-eq$w.reference})
 if($matching.Count-ne1){throw 'A referência não existe ou está repetida no levantamento.'}
 $part=$doc.SelectSingleNode('//m:tablePart',$ns);if(!$part){throw 'A tabela do registo não foi encontrada.'}
 $dir=$sheetPath.Substring(0,$sheetPath.LastIndexOf('/'));$leaf=[IO.Path]::GetFileName($sheetPath)
 $sr=Xml-Read (Entry-Text $archive ($dir+'/_rels/'+$leaf+'.rels'));$rid=$part.GetAttribute('id',$ns.LookupNamespace('r'));$tr=@($sr.DocumentElement.ChildNodes|Where-Object{$_.Id-eq$rid})
 if($tr.Count-ne1-or$tr[0].TargetMode-eq'External'){throw 'Tabela do registo inválida.'}
 $table=Xml-Read (Entry-Text $archive (Entry-Path $dir $tr[0].Target));$range=$table.DocumentElement.GetAttribute('ref');if($range-notmatch'^A5:L([0-9]+)$'){throw 'O formato da tabela foi alterado.'};$last=[int]$Matches[1]
 $row=$null;for($i=6;$i-le$last;$i++){
  $candidate=$doc.SelectSingleNode("//m:row[@r='$i']",$ns);if(!$candidate){continue};$occupied=$false
  foreach($c in $candidate.SelectNodes('m:c',$ns)){if($c.SelectSingleNode('m:f',$ns)-or(Cell-Text $c $ns $shared)-ne''){$occupied=$true;break}}
  if(!$occupied){$row=$candidate;break}
 }
 if(!$row){throw 'A tabela de alterações está cheia. O trabalho continua guardado na Clara; amplia a tabela no Excel antes de repetir.'}
 if($request.audit){
 function Save-Part($partDoc,[string]$partPath){$e=$archive.GetEntry($partPath);$e.Delete();$e=$archive.CreateEntry($partPath);$st=$e.Open();$opt=[Xml.XmlWriterSettings]::new();$opt.Encoding=[Text.UTF8Encoding]::new($false);$wr=[Xml.XmlWriter]::Create($st,$opt);try{$partDoc.Save($wr)}finally{$wr.Dispose();$st.Dispose()}}
 $docs=@{'Levantamento'=$mainDoc};$paths=@{'Levantamento'=(Sheet-Path $main)}
 foreach($change in $request.audit.cells){
  $name=[string]$change.sheet;if($name-notin@('Levantamento','Textos por idioma')){throw 'Destino de levantamento inválido.'}
  if(!$docs.ContainsKey($name)){$node=$book.SelectSingleNode("//m:sheet[@name='$name']",$bn);if(!$node){throw 'Folha de textos em falta.'};$paths[$name]=Sheet-Path $node;$docs[$name]=Xml-Read (Entry-Text $archive $paths[$name])}
  $dd=$docs[$name];$nn=Namespace $dd;$rn=[int]$change.row;$rr=$dd.SelectSingleNode("//m:row[@r='$rn']",$nn);if(!$rr){throw 'Linha do levantamento em falta.'}
  if((Cell-Text ($rr.SelectSingleNode("m:c[@r='A$rn']",$nn)) $nn $shared)-ne$w.reference){throw 'A linha já não pertence ao imóvel.'}
  $column=[string]$change.column;if($column-notmatch'^[A-W]$'){throw 'Coluna inválida.'}
  $addr=$column+$rn;$cc=$rr.SelectSingleNode("m:c[@r='$addr']",$nn);if($cc-and$cc.SelectSingleNode('m:f',$nn)){throw 'Não é permitido substituir uma fórmula.'}
  if((Cell-Text $cc $nn $shared)-cne[string]$change.before){throw 'Um valor mudou desde a revisão.'}
  if($name-eq'Textos por idioma'-and$column-eq'F'){$dt=[datetime]::ParseExact([string]$change.after,'yyyy-MM-dd',[Globalization.CultureInfo]::InvariantCulture);Put-Cell $dd $rr $nn $column ([string][int](($dt-([datetime]'1899-12-30')).TotalDays)) $true}else{Put-Cell $dd $rr $nn $column ([string]$change.after)}
 }
 # Invalidate only computed caches of the edited property. Excel recalculates on opening.
 $rr=$mainDoc.SelectSingleNode("//m:row[@r='$($matching[0].ParentNode.GetAttribute('r'))']",$mn)
 foreach($cc in $rr.SelectNodes('m:c[m:f]',$mn)){$vv=$cc.SelectSingleNode('m:v',$mn);if($vv){[void]$cc.RemoveChild($vv)}}
 foreach($name in $docs.Keys){Save-Part $docs[$name] $paths[$name]}
 $calc=$book.SelectSingleNode('//m:calcPr',$bn);if(!$calc){$calc=$book.CreateElement('calcPr',$bn.LookupNamespace('m'));[void]$book.DocumentElement.AppendChild($calc)};$calc.SetAttribute('fullCalcOnLoad','1');$calc.SetAttribute('forceFullCalc','1');Save-Part $book 'xl/workbook.xml'
}
$date=[datetime]::ParseExact($w.date,'yyyy-MM-dd',[Globalization.CultureInfo]::InvariantCulture)
 $serial=[int](($date-([datetime]'1899-12-30')).TotalDays)
 Put-Cell $doc $row $ns 'A' ([string]$serial) $true
 $values=@($w.reference,'',$w.author,$w.location,$w.field,$w.before,$w.after,($w.reason+"`n"+$marker).Trim(),$w.verification,'','')
 for($i=0;$i-lt11;$i++){Put-Cell $doc $row $ns ([char](66+$i)).ToString() ([string]$values[$i])}
 $row.SetAttribute('ht','90');$row.SetAttribute('customHeight','1')
 $entry=$archive.GetEntry($sheetPath);$entry.Delete();$entry=$archive.CreateEntry($sheetPath);$stream=$entry.Open();$settings=[Xml.XmlWriterSettings]::new();$settings.Encoding=[Text.UTF8Encoding]::new($false);$settings.CloseOutput=$false
 $writer=[Xml.XmlWriter]::Create($stream,$settings);try{$doc.Save($writer)}finally{$writer.Dispose();$stream.Dispose()}
 $archive.Dispose();$archive=$null;$result=$memory.ToArray();if($result.Length-gt20971520){throw 'A gravação excederia o limite de 20 MB. O original não foi alterado.'}
 $recovery=Join-Path ([IO.Path]::GetDirectoryName($path)) ('.Clara-recuperacao-'+$w.id+[IO.Path]::GetExtension($path))
 if([IO.File]::Exists($recovery)){throw 'Já existe uma cópia de recuperação desta operação. Confirma o ficheiro antes de repetir.'}
 $copy=[IO.FileStream]::new($recovery,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::None);try{$copy.Write($original,0,$original.Length);$copy.Flush($true)}finally{$copy.Dispose()}
 $mutating=$true;$handle.Position=0;$handle.Write($result,0,$result.Length);$handle.SetLength($result.Length);$handle.Flush($true)
 $handle.Position=0;$verified=[byte[]]::new($result.Length);$offset=0;while($offset-lt$verified.Length){$n=$handle.Read($verified,$offset,$verified.Length-$offset);if(!$n){throw 'Não foi possível confirmar a gravação.'};$offset+=$n}
 $sha=[Security.Cryptography.SHA256]::Create();try{if([Convert]::ToBase64String($sha.ComputeHash($result))-ne[Convert]::ToBase64String($sha.ComputeHash($verified))){throw 'A leitura após gravação não corresponde ao registo.'}}finally{$sha.Dispose()};$mutating=$false
 @{already_written=$false;file_name=[IO.Path]::GetFileName($path);recovery_file=[IO.Path]::GetFileName($recovery)}|ConvertTo-Json -Compress
}catch{
 if($mutating-and$handle-and$original){try{$handle.Position=0;$handle.Write($original,0,$original.Length);$handle.SetLength($original.Length);$handle.Flush($true)}catch{}}
 [Console]::Error.WriteLine($_.Exception.Message);exit 1
}finally{if($archive){$archive.Dispose()};if($memory){$memory.Dispose()};if($handle){$handle.Dispose()}}
