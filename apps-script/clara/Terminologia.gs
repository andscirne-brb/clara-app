/* Uniformização ortográfica dos textos atuais; histórico e cópias originais preservados. */
function termoDossieClara_(v){return typeof v==='string'?v.replace(/\bdossier\b/gi,'dossiê'):v;}
function uniformizarTerminologiaClara(){
 const lock=LockService.getDocumentLock()||LockService.getScriptLock();if(!lock.tryLock(5000))throw Error('Outra gravação está em curso.');
 try{
 const ss=SpreadsheetApp.getActive(),nomes=['Dashboard',LEV.nome,PEND.nome,'Perfis dos portais','Ficha do imóvel'],requests=[],logs=[],snapshots=[],hoje=dataHoje_();
 const meta=edSheets_(ss,'?fields=sheets(properties(sheetId,title),tables,conditionalFormats,basicFilter,filterViews)');
 let textos=0,formulas=0,regras=0;
 function cell(id,row,col,value,formula){requests.push({updateCells:{range:{sheetId:id,startRowIndex:row,endRowIndex:row+1,startColumnIndex:col,endColumnIndex:col+1},rows:[{values:[{userEnteredValue:formula?{formulaValue:value}:{stringValue:value}}]}],fields:'userEnteredValue'}});}
 ss.getSheets().filter(sh=>nomes.includes(sh.getName())).forEach(sh=>{
  const rg=sh.getDataRange(),values=rg.getValues(),fs=rg.getFormulas(),notes=rg.getNotes(),id=sh.getSheetId();snapshots.push({rg,signature:JSON.stringify([values,fs,notes])});let nf=0;
  values.forEach((row,i)=>row.forEach((v,j)=>{const old=fs[i][j]||v,n=termoDossieClara_(old);if(n!==old){cell(id,i,j,n,!!fs[i][j]);if(fs[i][j]){formulas++;nf++;}else{textos++;logs.push([hoje,sh.getName()===LEV.nome?String(row[0]||''):sh.getName()===PEND.nome?String(row[1]||''):'','Equipa',sh.getName(),rg.getCell(i+1,j+1).getA1Notation(),String(old),n,'Uniformização terminológica: dossiê; significado e seguimento preservados.','Confirmado']);}}
   const note=termoDossieClara_(notes[i][j]);if(note!==notes[i][j])requests.push({updateCells:{range:{sheetId:id,startRowIndex:i,endRowIndex:i+1,startColumnIndex:j,endColumnIndex:j+1},rows:[{values:[{note}]}],fields:'note'}});
  }));
  if(nf)logs.push([hoje,'','Equipa',sh.getName(),'Fórmulas',String(nf)+' fórmulas com a grafia anterior','Mesmas fórmulas com dossiê','Uniformização terminológica; critérios atualizados com os estados.','Confirmado']);
  const m=meta.sheets.find(x=>x.properties.sheetId===id)||{};
  (m.tables||[]).forEach(t=>{const old=JSON.stringify(t.columnProperties),n=termoDossieClara_(old);if(n!==old){requests.push({updateTable:{table:{tableId:t.tableId,columnProperties:JSON.parse(n)},fields:'columnProperties'}});regras++;}});
  (m.conditionalFormats||[]).forEach((r,index)=>{const old=JSON.stringify(r),n=termoDossieClara_(old);if(n!==old){requests.push({updateConditionalFormatRule:{sheetId:id,index,rule:JSON.parse(n)}});regras++;}});
  if(m.basicFilter){const old=JSON.stringify(m.basicFilter),n=termoDossieClara_(old);if(n!==old){requests.push({setBasicFilter:{filter:JSON.parse(n)}});regras++;}}
  (m.filterViews||[]).forEach(r=>{const old=JSON.stringify(r),n=termoDossieClara_(old);if(n!==old){requests.push({updateFilterView:{filter:JSON.parse(n),fields:'*'}});regras++;}});
 });
 if(!requests.length)return{textos:0,formulas:0,regras:0};
 requests.sort((a,b)=>Number(!!b.updateTable)-Number(!!a.updateTable));
 const hs=estrutura_(ss,'Registo de alterações',['Data da alteração','Referência EGO','Autor','Onde foi alterado','Campo / assunto','Antes','Depois / alteração realizada','Motivo / fonte','Resultado da verificação']);
 const cab=['Data da alteração','Referência EGO','Autor','Onde foi alterado','Campo / assunto','Antes','Depois / alteração realizada','Motivo / fonte','Resultado da verificação'];
 const start=hs.sh.getLastRow(),last=start+logs.length;if(last>hs.sh.getMaxRows())requests.push({appendDimension:{sheetId:hs.sh.getSheetId(),dimension:'ROWS',length:last-hs.sh.getMaxRows()+100}});
 if(logs.length){const rows=logs.map(log=>{const vs=Array.from({length:hs.sh.getLastColumn()},()=>({}));cab.forEach((k,i)=>vs[hs.col(k)-1]={userEnteredValue:{stringValue:log[i]}});return{values:vs};});requests.push({updateCells:{range:{sheetId:hs.sh.getSheetId(),startRowIndex:start,endRowIndex:last,startColumnIndex:0,endColumnIndex:hs.sh.getLastColumn()},rows,fields:'userEnteredValue'}});}
 snapshots.forEach(s=>{if(JSON.stringify([s.rg.getValues(),s.rg.getFormulas(),s.rg.getNotes()])!==s.signature)throw Error('O documento foi editado entretanto. Volta a executar a uniformização.');});
 edSheets_(ss,':batchUpdate',{requests});SpreadsheetApp.flush();
 ss.getSheets().filter(sh=>nomes.includes(sh.getName())).forEach(sh=>{if(sh.getDataRange().getValues().some(r=>r.some(v=>termoDossieClara_(v)!==v))||sh.getDataRange().getFormulas().some(r=>r.some(v=>termoDossieClara_(v)!==v)))throw Error('Há grafias antigas por rever.');});
 return{textos,formulas,regras};
 }finally{lock.releaseLock();}
}
