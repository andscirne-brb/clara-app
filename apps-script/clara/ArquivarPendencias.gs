/* Arquivo técnico preserva linhas, motivos e respostas; não é dispensa documental. */
function arFormula_(f){
 if(!f||f.includes('Arquivado'))return f;
 // Critérios de abertura: repetir o intervalo já observado com a exclusão nova.
 f=f.replace(/([^,;()]+)([,;])"<>Não aplicável"/g,(_,range,sep)=>range+sep+'"<>Não aplicável"'+sep+range+sep+'"<>Arquivado"');
 f=f.replace(/([^,;()]+)<>"Não aplicável"/g,(_,range)=>range+'<>"Não aplicável"'+(f.includes(';')?';':',')+range+'<>"Arquivado"');
 // Estado de equipa: linhas arquivadas são fechadas, sem as apresentar como trabalho concluído.
 const re=/COUNTIFS\(PendenciasEquipe\[Referência EGO\]([,;])(A\d+)\1PendenciasEquipe\[Estado\]\1"Não aplicável"\)/g;
 let criterio='';f=f.replace(re,(m,sep,ref)=>{criterio='COUNTIFS(PendenciasEquipe[Referência EGO]'+sep+ref+sep+'PendenciasEquipe[Estado]'+sep+'"Arquivado")';return '('+m+'+'+criterio+')';});
 if(criterio){const sep=criterio.includes(';')?';':',',ref=(criterio.match(/(?:;|,)(A\d+)(?:;|,)/)||[])[1],all='COUNTIFS(PendenciasEquipe[Referência EGO]'+sep+ref+')';f=f.replace('='+all+sep+'"Concluído"'+sep,'='+all+sep+'IF('+criterio+'='+all+sep+'"Arquivado"'+sep+'"Concluído")'+sep);}
 // Conferência da linha: arquivar também exige um motivo.
 const check=/IF\(AND\((I\d+)="Não aplicável"([,;])(L\d+)=""\)\2"Justificar N\/A"\2""\)/g;
 f=f.replace(check,(_,i,sep,l)=>'IF(AND('+i+'="Não aplicável"'+sep+l+'="")'+sep+'"Justificar N/A"'+sep+'IF(AND('+i+'="Arquivado"'+sep+l+'="")'+sep+'"Justificar arquivo"'+sep+'""))');
 return f;
}
function arquivarPendenciasSubstituidas(){
 const lock=LockService.getDocumentLock()||LockService.getScriptLock();if(!lock.tryLock(5000))throw Error('Outra gravação está em curso.');
 try{
 const ss=SpreadsheetApp.getActive(),ps=ss.getSheetByName(PEND.nome),range=ps.getDataRange(),v=range.getValues(),forms=range.getFormulas(),signature=JSON.stringify([v,forms]),requests=[],logs=[],hoje=dataHoje_(),ids=new Map(v.slice(5).filter(r=>r[0]).map(r=>[String(r[0]),r]));
 const cell=(sheetId,row,col,value,formula)=>requests.push({updateCells:{range:{sheetId,startRowIndex:row,endRowIndex:row+1,startColumnIndex:col,endColumnIndex:col+1},rows:[{values:[{userEnteredValue:formula?{formulaValue:arFormulaApi_(value)}:{stringValue:value}}]}],fields:'userEnteredValue'}});
 let arquivadas=0,formulaCount=0;v.slice(5).forEach((r,i)=>{
  if(r[8]!=='Não aplicável'||!edPendenciaSubstituida_(r))return;
  const m=String(r[11]||'').match(/^Duplicada: acompanhamento na pendência (P\d+)/);
  if(m){if(!ids.has(m[1])||ids.get(m[1])[1]!==r[1]||m[1]===r[0])throw Error('Destino da duplicada não confirmado.');}
  else {const nomes=r[2]==='Plantas'?[ED_CAMPOS[4]]:ED_CAMPOS.slice(0,4).filter(x=>String(r[4]||'').includes(x[2]));if(!nomes.length||nomes.some(x=>!v.slice(5).some(t=>t[1]===r[1]&&edCampoPendencia_(t)===x&&!edPendenciaSubstituida_(t))))throw Error('Pendências individuais não confirmadas.');}
  cell(ps.getSheetId(),i+5,8,'Arquivado');logs.push([hoje,String(r[1]),'Equipa',PEND.nome,'Estado · '+r[0],'Não aplicável','Arquivado','Arquivo técnico de pendências substituídas; motivo, notas e respostas preservados.','Confirmado']);arquivadas++;
 });
 const meta=edSheets_(ss,'?fields=sheets(properties(sheetId,title),tables,basicFilter,filterViews)');
 const pm=meta.sheets.find(s=>s.properties.sheetId===ps.getSheetId());
 (pm.tables||[]).forEach(t=>{const cols=JSON.parse(JSON.stringify(t.columnProperties)),cp=cols.find(x=>x.columnIndex===8-(t.range.startColumnIndex||0));if(!cp||!cp.dataValidationRule)throw Error('Dropdown de Estado não encontrado.');const vs=cp.dataValidationRule.condition.values||[];if(!vs.some(x=>x.userEnteredValue==='Arquivado')){cp.dataValidationRule.condition.values=vs.concat({userEnteredValue:'Arquivado'});requests.unshift({updateTable:{table:{tableId:t.tableId,columnProperties:cols},fields:'columnProperties'}});}});
 function filtro(f){const next=JSON.parse(JSON.stringify(f));if(next.tableId)delete next.range;if(next.filterSpecs&&next.filterSpecs.length){let spec=next.filterSpecs.find(x=>x.columnIndex===8);if(!spec){spec={columnIndex:8,filterCriteria:{}};next.filterSpecs.push(spec);}spec.filterCriteria=spec.filterCriteria||{};spec.filterCriteria.hiddenValues=[...new Set((spec.filterCriteria.hiddenValues||[]).concat('Arquivado'))];}else{next.criteria=next.criteria||{};const c=next.criteria['8']||(next.criteria['8']={});c.hiddenValues=[...new Set((c.hiddenValues||[]).concat('Arquivado'))];}return next;}
 // O filtro da tabela nativa é atualizado pela interface SpreadsheetApp após o lote de dados.

 const snapshots=[];ss.getSheets().filter(s=>['Dashboard',LEV.nome,PEND.nome].includes(s.getName())).forEach(sh=>{const rg=sh.getDataRange(),f=rg.getFormulas();snapshots.push({rg,f:JSON.stringify(f)});f.forEach((r,i)=>r.forEach((old,j)=>{const n=arFormula_(old);if(n!==old){cell(sh.getSheetId(),i,j,n,true);formulaCount++;}}));});
 if(!requests.length)return{arquivadas:0,formulas:0};
 const hs=estrutura_(ss,'Registo de alterações',['Data da alteração','Referência EGO','Autor','Onde foi alterado','Campo / assunto','Antes','Depois / alteração realizada','Motivo / fonte','Resultado da verificação']),cab=['Data da alteração','Referência EGO','Autor','Onde foi alterado','Campo / assunto','Antes','Depois / alteração realizada','Motivo / fonte','Resultado da verificação'];
 if(formulaCount)logs.push([hoje,'','Equipa','Dashboard e Levantamento','Critérios de estado fechado','Concluído / Não aplicável','Concluído / Não aplicável / Arquivado','Arquivo técnico de pendências; fórmulas e contagens coerentes.','Confirmado']);
 const start=hs.sh.getLastRow(),last=start+logs.length;if(last>hs.sh.getMaxRows())requests.push({appendDimension:{sheetId:hs.sh.getSheetId(),dimension:'ROWS',length:last-hs.sh.getMaxRows()+100}});
 if(logs.length)requests.push({updateCells:{range:{sheetId:hs.sh.getSheetId(),startRowIndex:start,endRowIndex:last,startColumnIndex:0,endColumnIndex:hs.sh.getLastColumn()},rows:logs.map(r=>{const values=Array.from({length:hs.sh.getLastColumn()},()=>({}));cab.forEach((k,i)=>values[hs.col(k)-1]={userEnteredValue:{stringValue:r[i]}});return{values};}),fields:'userEnteredValue'}});
 if(JSON.stringify([range.getValues(),range.getFormulas()])!==signature)throw Error('Pendências editadas entretanto. Não arquivei.');snapshots.forEach(s=>{if(JSON.stringify(s.rg.getFormulas())!==s.f)throw Error('Fórmulas alteradas entretanto.');});
 edSheets_(ss,':batchUpdate',{requests});SpreadsheetApp.flush();
 const active=ps.getFilter();if(active){const old=active.getColumnFilterCriteria(9),builder=old?old.copy():SpreadsheetApp.newFilterCriteria();builder.setHiddenValues([...new Set((old?old.getHiddenValues():[]).concat('Arquivado'))]);active.setColumnFilterCriteria(9,builder.build());}
 return{arquivadas,formulas:formulaCount,filtroAtualizado:!!active};
 }finally{lock.releaseLock();}
}

/* A API recebe separadores canónicos; os textos entre aspas ficam intactos. */
function arFormulaApi_(f){let quoted=false,out='';for(let i=0;i<f.length;i++){const ch=f[i];if(ch==='"'){if(quoted&&f[i+1]==='"'){out+='""';i++;continue;}quoted=!quoted;}out+=!quoted&&ch===';'?',':ch;}return out;}
