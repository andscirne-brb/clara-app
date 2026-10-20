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
 $shared=@();if($archive.GetEntry('xl/sharedStrings.xml')){$sd=Xml-Read (Entry-Text $archive 'xl/sharedStrings.xml');$sn=Namespace $sd;$shared=@($sd.SelectNodes('//m:si',$sn)|ForEach-Object{$_.InnerText})}
 if($hash-ne$request.expected_hash){throw 'O ficheiro mudou durante a gravação. Guarda novamente para repetir.'}
 if(!$book.SelectSingleNode("//m:sheet[@name='Levantamento']",$bn)){throw 'Escolhe o levantamento principal.'}
 $headers=@('Portal','Assunto','Ação / observação','Estado','Depende de','Data do registo','Ligação','ID da versão','Texto original','Proposta','Idioma')
 $types=Xml-Read (Entry-Text $archive '[Content_Types].xml')
 $styles=Xml-Read (Entry-Text $archive 'xl/styles.xml');$styNs=Namespace $styles
 $xfs=$styles.SelectSingleNode('//m:cellXfs',$styNs);$bodyStyle=$xfs.ChildNodes.Count
 $xf=$styles.CreateElement('xf',$styNs.LookupNamespace('m'));$xf.SetAttribute('numFmtId','0');$xf.SetAttribute('fontId','0');$xf.SetAttribute('fillId','0');$xf.SetAttribute('borderId','0');$xf.SetAttribute('xfId','0');$xf.SetAttribute('applyAlignment','1');$align=$styles.CreateElement('alignment',$styNs.LookupNamespace('m'));$align.SetAttribute('wrapText','1');$align.SetAttribute('vertical','top');[void]$xf.AppendChild($align);[void]$xfs.AppendChild($xf);$xfs.SetAttribute('count',[string]$xfs.ChildNodes.Count)
 $headerStyle=$bodyStyle
 $reg=$book.SelectSingleNode("//m:sheet[@name='Registo de alterações']",$bn)
 if($reg){$rid=$reg.GetAttribute('id',$bn.LookupNamespace('r'));$rr=@($rels.DocumentElement.ChildNodes|Where-Object{$_.Id-eq$rid});if($rr.Count-eq1){$rd=Xml-Read (Entry-Text $archive (Entry-Path 'xl' $rr[0].Target));$rn=Namespace $rd;$hc=$rd.SelectSingleNode("//m:c[@r='A5']",$rn);if($hc-and$hc.HasAttribute('s')){$headerStyle=[int]$hc.s}}}
 function Save-Part($d,[string]$p){$e=$archive.GetEntry($p);if($e){$e.Delete()};$e=$archive.CreateEntry($p);$st=$e.Open();$o=[Xml.XmlWriterSettings]::new();$o.Encoding=[Text.UTF8Encoding]::new($false);$wr=[Xml.XmlWriter]::Create($st,$o);try{$d.Save($wr)}finally{$wr.Dispose();$st.Dispose()}}
 function Get-Sheet([string]$name){
  $node=$book.SelectSingleNode("//m:sheet[@name='$name']",$bn)
  if($node){$id=$node.GetAttribute('id',$bn.LookupNamespace('r'));$rel=@($rels.DocumentElement.ChildNodes|Where-Object{$_.Id-eq$id});if($rel.Count-ne1-or$rel[0].TargetMode-eq'External'){throw 'Relação de perfil inválida.'};$p=Entry-Path 'xl' $rel[0].Target;$d=Xml-Read (Entry-Text $archive $p)}else{
   $n=1;while($archive.GetEntry("xl/worksheets/claraProfiles$n.xml")){$n++};$p="xl/worksheets/claraProfiles$n.xml"
   $rid='claraProfiles'+[guid]::NewGuid().ToString('N');$node=$book.CreateElement('sheet',$bn.LookupNamespace('m'));$node.SetAttribute('name',$name);$max=($book.SelectNodes('//m:sheet',$bn)|ForEach-Object{[int]$_.sheetId}|Measure-Object -Maximum).Maximum;$node.SetAttribute('sheetId',[string]($max+1));[void]$node.SetAttribute('id',$bn.LookupNamespace('r'),$rid);[void]$book.SelectSingleNode('//m:sheets',$bn).AppendChild($node)
   $rel=$rels.CreateElement('Relationship',$rels.DocumentElement.NamespaceURI);$rel.SetAttribute('Id',$rid);$rel.SetAttribute('Type','http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet');$rel.SetAttribute('Target',$p.Substring(3));[void]$rels.DocumentElement.AppendChild($rel)
   $ov=$types.CreateElement('Override',$types.DocumentElement.NamespaceURI);$ov.SetAttribute('PartName','/'+$p);$ov.SetAttribute('ContentType','application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml');[void]$types.DocumentElement.AppendChild($ov)
   $d=Xml-Read '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><dimension ref="A1:K1"/><sheetViews><sheetView workbookViewId="0"><pane xSplit="2" ySplit="1" topLeftCell="C2" activePane="bottomRight" state="frozen"/></sheetView></sheetViews><cols><col min="1" max="1" width="18" customWidth="1"/><col min="2" max="2" width="30" customWidth="1"/><col min="3" max="3" width="70" customWidth="1"/><col min="4" max="5" width="24" customWidth="1"/><col min="6" max="8" width="25" customWidth="1"/><col min="9" max="10" width="70" customWidth="1"/><col min="11" max="11" width="12" customWidth="1"/></cols><sheetData/><autoFilter ref="A1:K1"/></worksheet>'
   $ns=Namespace $d;$r=$d.CreateElement('row',$ns.LookupNamespace('m'));$r.SetAttribute('r','1');$r.SetAttribute('ht','36');$r.SetAttribute('customHeight','1');[void]$d.SelectSingleNode('//m:sheetData',$ns).AppendChild($r)
   for($i=0;$i-lt$headers.Count;$i++){Put-Cell $d $r $ns ([char](65+$i)).ToString() $headers[$i]}
  }
  $ns=Namespace $d
  for($i=0;$i-lt$headers.Count;$i++){$addr=([char](65+$i)).ToString()+'1';if((Cell-Text ($d.SelectSingleNode("//m:c[@r='$addr']",$ns)) $ns $shared)-ne$headers[$i]){throw 'Cabeçalhos dos perfis alterados. O ficheiro não foi modificado.'}}
  return @{doc=$d;path=$p;ns=$ns}
 }
 $current=Get-Sheet 'Perfis dos portais';Save-Part $current.doc $current.path
 $history=Get-Sheet 'Histórico dos perfis'
 $versions=@($request.profiles);if(!$versions.Count){throw 'Sem versões para guardar.'}
 $portal=[string]$versions[0].data.portal;if($portal-notin@('idealista','green-acres','rightmove')){throw 'Portal inválido.'}
 $changed=$false
 $labels=@{empresa='Nome e dados da empresa';contactos='Contactos e localização';imagens='Logótipo e imagens';apresentacao='Apresentação e idiomas';ligacoes='Ligações e anúncios'}
 function Add-Rows($target,$version){
  $d=$target.doc;$ns=$target.ns;$sd=$d.SelectSingleNode('//m:sheetData',$ns);$p=$version.data
  $date=[TimeZoneInfo]::ConvertTimeBySystemTimeZoneId([DateTimeOffset]::Parse($version.saved_at),'GMT Standard Time').ToString('yyyy-MM-dd HH:mm:ss')
  $values=[Collections.Generic.List[object]]::new()
  foreach($item in $p.items){$values.Add(@($portal,$labels[[string]$item.field],[string]$item.note,[string]$item.state,'',$date,[string]$p.url,[string]$version.id,'','',''))}
  $values.Add(@($portal,'Próxima ação',[string]$p.next_action,[string]$p.stage,'',$date,[string]$p.url,[string]$version.id,'','',''))
  $values.Add(@($portal,'Origem da consulta',[string]$p.source,'Fonte','',$date,[string]$p.url,[string]$version.id,'','',''))
  if($p.applied_confirmed){$values.Add(@($portal,'Conferência pública',[string]$p.applied_date,'Aplicado e conferido','',$date,[string]$p.url,[string]$version.id,'','',''))}
  if($p.sara){$values.Add(@($portal,'Pontos para a Sara',[string]$p.sara,'Pendente','Sara',$date,[string]$p.url,[string]$version.id,'','',''))}
  foreach($lang in @('PT','EN','FR','ES','DE')){foreach($t in @($p.texts|Where-Object{$_.language-eq$lang})){if($t.original-or$t.proposed){$values.Add(@($portal,'Texto do perfil','Texto original e proposta registados; publicação depende de confirmação.',[string]$p.stage,'',$date,[string]$p.url,[string]$version.id,[string]$t.original,[string]$t.proposed,$lang))}}}
  $n=1;foreach($old in $sd.SelectNodes('m:row',$ns)){$n=[Math]::Max($n,[int]$old.r)}
  if($n+$values.Count-gt15000){throw 'O histórico excede 15 000 linhas.'}
  foreach($v in $values){$n++;$r=$d.CreateElement('row',$ns.LookupNamespace('m'));$r.SetAttribute('r',[string]$n);$height=45;foreach($i in @(2,8,9)){$lines=0;foreach($line in ([string]$v[$i]-split"`n")){$lines+=[Math]::Max(1,[Math]::Ceiling($line.Length/65))};$height=[Math]::Max($height,[Math]::Min(409,$lines*16+12))};$r.SetAttribute('ht',[string]$height);$r.SetAttribute('customHeight','1');[void]$sd.AppendChild($r);for($i=0;$i-lt11;$i++){Put-Cell $d $r $ns ([char](65+$i)).ToString() ([string]$v[$i])}}
 }
 # Append only unseen versions, in chronological order. Retrying never duplicates rows.
 $latest=$versions[0]
 [array]::Reverse($versions)
 foreach($v in $versions){if($v.data.portal-ne$portal-or$v.id-notmatch'^[a-zA-Z0-9-]{1,80}$'){throw 'Versão inválida.'};$id=[string]$v.id;$found=@($history.doc.SelectNodes('//m:row/m:c',$history.ns)|Where-Object{$_.r-match'^H[0-9]+$'-and(Cell-Text $_ $history.ns $shared)-eq$id});if(!$found.Count){Add-Rows $history $v;$changed=$true}}
 $id=[string]$latest.id
 $latestRows=@($current.doc.SelectNodes('//m:row',$current.ns)|Where-Object{$_.r-ne'1'-and(Cell-Text ($_.SelectSingleNode('m:c[1]',$current.ns)) $current.ns $shared)-eq$portal})
 $same=$latestRows.Count-gt0;foreach($row in $latestRows){if((Cell-Text ($row.SelectSingleNode("m:c[starts-with(@r,'H')]",$current.ns)) $current.ns $shared)-ne$id){$same=$false}}
 if(!$same){foreach($row in $latestRows){[void]$row.ParentNode.RemoveChild($row)};Add-Rows $current $latest;$changed=$true}
 if(!$changed){@{already_written=$true;file_name=[IO.Path]::GetFileName($path);recovery_file=$null}|ConvertTo-Json -Compress;exit 0}
 foreach($target in @($current,$history)){
  $d=$target.doc;$ns=$target.ns;$n=1
  foreach($row in $d.SelectNodes('//m:sheetData/m:row',$ns)){$old=[string]$row.r;$row.SetAttribute('r',[string]$n);foreach($c in $row.SelectNodes('m:c',$ns)){$c.SetAttribute('r',($c.r-replace'[0-9]+$',[string]$n));$c.SetAttribute('s',[string]$(if($n-eq1){$headerStyle}else{$bodyStyle}))};$n++}
  $d.SelectSingleNode('//m:dimension',$ns).SetAttribute('ref',"A1:K$($n-1)");$d.SelectSingleNode('//m:autoFilter',$ns).SetAttribute('ref',"A1:K$($n-1)");Save-Part $d $target.path
 }
 Save-Part $book 'xl/workbook.xml';Save-Part $rels 'xl/_rels/workbook.xml.rels';Save-Part $types '[Content_Types].xml';Save-Part $styles 'xl/styles.xml'

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
