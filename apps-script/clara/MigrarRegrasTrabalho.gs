/* Migração explícita, preservando entradas e respostas. Não é chamada por onOpen. */
function pfMigrarProcesso_(ss){
 const lock=LockService.getDocumentLock()||LockService.getScriptLock();if(!lock.tryLock(1000))throw Error('Outra gravação em curso.');
 try{
  const id=ss.getId(),lev=ss.getSheetByName(LEV.nome),ps=ss.getSheetByName(PEND.nome),hs=ss.getSheetByName('Registo de alterações'),date=Utilities.formatDate(new Date(),ss.getSpreadsheetTimeZone(),'yyyy-MM-dd');
  if(lev.getLastColumn()!==35)throw Error('Estrutura já alterada; conferir antes de repetir.');
  const lv=lev.getRange(10,1,1000,35).getValues(),lf=lev.getRange(10,1,1000,35).getFormulas(),pv=ps.getRange(6,1,ps.getLastRow()-5,ps.getLastColumn()).getValues(),pf=ps.getRange(6,1,pv.length,ps.getLastColumn()).getFormulas(),oldHistory=hs.getDataRange().getValues();
  const sig=JSON.stringify([lv,lf,pv,pf,oldHistory]),targets=pv.map((r,i)=>({r,i})).filter(x=>pfDocumentoDispensado_(x.r));
  if(!targets.length)throw Error('Nenhuma tarefa de upload documental ativa reconhecida; rever antes de migrar.');
  const check=lev.getRange(10,25,1000,4).getFormulasR1C1(),template=JSON.stringify(check[0]);if(check.some(r=>JSON.stringify(r)!==template||r.some(v=>!v)))throw Error('Há fórmulas individuais diferentes; não uniformizei.');
  const meta=Sheets.Spreadsheets.get(id,{fields:'sheets(properties(sheetId,title,gridProperties),tables)'}).sheets.find(s=>s.properties.sheetId===lev.getSheetId()),table=meta.tables&&meta.tables.find(t=>t.range.startRowIndex===8&&t.range.endColumnIndex===35);
  if(!table)throw Error('Tabela do Levantamento não reconhecida.');
  const header=hs.getRange(5,1,1,hs.getLastColumn()).getDisplayValues()[0];for(const h of ['Data da alteração','Referência EGO','ID da pendência','Autor','Onde foi alterado','Campo / assunto','Antes','Depois / alteração realizada','Motivo / fonte'])if(!header.includes(h))throw Error('Histórico sem coluna '+h);
  const requests=[],undo=[];
  function cellValue(v,f){return f?{formulaValue:pgFormulaLocal_(f,';')}:v===''||v===null?{}:v instanceof Date?{numberValue:v.getTime()/86400000+25569}:typeof v==='number'?{numberValue:v}:{stringValue:String(v)};}
  function put(sh,row,col,vals,formula=false){const h=vals.length,w=vals[0].length,rg=sh.getRange(row,col,h,w),old=rg.getValues(),fs=rg.getFormulas(),range={sheetId:sh.getSheetId(),startRowIndex:row-1,endRowIndex:row-1+h,startColumnIndex:col-1,endColumnIndex:col-1+w};requests.push({updateCells:{range,rows:vals.map(r=>({values:r.map(v=>({userEnteredValue:cellValue(formula?'':v,formula?v:'')}))})),fields:'userEnteredValue'}});undo.unshift({updateCells:{range,rows:old.map((r,i)=>({values:r.map((v,j)=>({userEnteredValue:cellValue(v,fs[i][j])}))})),fields:'userEnteredValue'}});}
  const reason='Upload documental dispensado por orientação da Sara em '+date+'. Plantas JPEG e letra energética mantêm seguimento próprio. Histórico, notas e respostas preservados.';
  const next=pv.map(r=>r.slice()),refs=new Set();targets.forEach(({r,i})=>{next[i][8]='Arquivado';refs.add(r[1]);put(ps,i+6,9,[['Arquivado']]);put(ps,i+6,11,[[date]]);put(ps,i+6,12,[[[String(r[11]||''),reason].filter(Boolean).join('\n')]]);});
  refs.forEach(ref=>{const found=lv.map((r,i)=>({r,i})).filter(x=>x.r[0]===ref);if(found.length===1)put(lev,found[0].i+10,32,[[pfResumo_(ref,next)]]);});
  put(lev,10,25,lv.map((_,i)=>pfFormulas_(i+10)),true);
  const logs=targets.map(({r})=>({'Data da alteração':date,'Referência EGO':r[1],'ID da pendência':r[0],'Autor':'Clara','Onde foi alterado':PEND.nome,'Campo / assunto':'Estado · '+r[3],'Antes':r[8],'Depois / alteração realizada':'Arquivado','Motivo / fonte':reason}));
  logs.push({'Data da alteração':date,'Autor':'Clara','Onde foi alterado':LEV.nome,'Campo / assunto':'Critérios do levantamento','Antes':'Upload de quatro anexos documentais','Depois / alteração realizada':'Planta JPEG e letra energética; anexos antigos apenas como histórico','Motivo / fonte':'Orientação de trabalho da Sara; não é dispensa legal de documentos.'});
  const start=hs.getLastRow()+1;const extra=start+logs.length-1-hs.getMaxRows();if(extra>0)requests.unshift({appendDimension:{sheetId:hs.getSheetId(),dimension:'ROWS',length:extra+50}});
  // O histórico é novo, mas a reserva é verificada antes do lote; não reescreve entradas existentes.
  requests.push({updateCells:{range:{sheetId:hs.getSheetId(),startRowIndex:start-1,endRowIndex:start-1+logs.length,startColumnIndex:0,endColumnIndex:header.length},rows:logs.map(log=>({values:header.map(h=>({userEnteredValue:cellValue(log[h]||'','')}))})),fields:'userEnteredValue'}});
  if(JSON.stringify([lev.getRange(10,1,1000,35).getValues(),lev.getRange(10,1,1000,35).getFormulas(),ps.getRange(6,1,pv.length,ps.getLastColumn()).getValues(),ps.getRange(6,1,pv.length,ps.getLastColumn()).getFormulas(),hs.getDataRange().getValues()])!==sig)throw Error('Alguém editou o documento entretanto. Nada foi alterado.');
  const schema=[],cols=JSON.parse(JSON.stringify(table.columnProperties));cols.push({columnIndex:35,columnName:'Classe energética',columnType:'DROPDOWN',dataValidationRule:{condition:{type:'ONE_OF_LIST',values:PF_ENERGIA.map(v=>({userEnteredValue:v}))}}});
  if(meta.properties.gridProperties.columnCount<36)schema.push({appendDimension:{sheetId:lev.getSheetId(),dimension:'COLUMNS',length:36-meta.properties.gridProperties.columnCount}});
  schema.push({copyPaste:{source:{sheetId:lev.getSheetId(),startRowIndex:8,endRowIndex:1009,startColumnIndex:10,endColumnIndex:11},destination:{sheetId:lev.getSheetId(),startRowIndex:8,endRowIndex:1009,startColumnIndex:35,endColumnIndex:36},pasteType:'PASTE_FORMAT'}});
  schema.push({updateCells:{range:{sheetId:lev.getSheetId(),startRowIndex:8,endRowIndex:1009,startColumnIndex:35,endColumnIndex:36},rows:[{values:[{userEnteredValue:{stringValue:'Classe energética'}}]},...lv.map(r=>({values:[{userEnteredValue:r[0]?{stringValue:'Por verificar'}:{}}]}))],fields:'userEnteredValue'}});
  schema.push({updateTable:{table:{tableId:table.tableId,range:{...table.range,endColumnIndex:36},columnProperties:cols},fields:'range,columnProperties'}});
  schema.push({updateDimensionProperties:{range:{sheetId:lev.getSheetId(),dimension:'COLUMNS',startIndex:35,endIndex:36},properties:{pixelSize:155},fields:'pixelSize'}});
  Sheets.Spreadsheets.batchUpdate({requests:schema},id);SpreadsheetApp.flush();
  // Teste limitado de interpretação de fórmula; restaura sempre a linha antes do lote.
  const oldTest=lev.getRange(10,25,1,4).getFormulas();let testError='';
  try{Sheets.Spreadsheets.batchUpdate({requests:[{updateCells:{range:{sheetId:lev.getSheetId(),startRowIndex:9,endRowIndex:10,startColumnIndex:24,endColumnIndex:28},rows:[{values:pfFormulas_(10).map(f=>({userEnteredValue:{formulaValue:f}}))}],fields:'userEnteredValue'}}]},id);SpreadsheetApp.flush();if(lev.getRange(10,25,1,4).getDisplayValues()[0].some(v=>/^#/.test(v)))testError='A fórmula de teste não foi interpretada.';}
  finally{Sheets.Spreadsheets.batchUpdate({requests:[{updateCells:{range:{sheetId:lev.getSheetId(),startRowIndex:9,endRowIndex:10,startColumnIndex:24,endColumnIndex:28},rows:oldTest.map(r=>({values:r.map(f=>({userEnteredValue:{formulaValue:f}}))})),fields:'userEnteredValue'}}]},id);SpreadsheetApp.flush();}
  if(testError)throw Error(testError+' As tarefas não foram alteradas; coluna de energia preparada.');
  try{Sheets.Spreadsheets.batchUpdate({requests},id);SpreadsheetApp.flush();const seen=ps.getRange(6,1,pv.length,ps.getLastColumn()).getValues();for(const {r,i} of targets){if(seen[i][8]!=='Arquivado'||String(seen[i][11]).indexOf(reason)<0||[0,1,2,3,4,5,6,7,12,17].some(c=>JSON.stringify(seen[i][c])!==JSON.stringify(r[c])))throw Error('Arquivo documental não corresponde ao previsto.');}if(lev.getRange(10,25,1000,4).getDisplayValues().some(r=>r.some(v=>/^#/.test(v))))throw Error('Erro numa fórmula de estado.');}
  catch(e){Sheets.Spreadsheets.batchUpdate({requests:undo},id);SpreadsheetApp.flush();throw Error('Tarefas e fórmulas repostas: '+e.message);}
  lev.hideColumns(15,4);
  return {arquivadas:targets.length,imoveis:refs.size,classeEnergetica:'Por verificar; sem inferir dos anexos',anexosAntigos:'Preservados em colunas ocultas',historico:logs.length};
 }finally{lock.releaseLock();}
}
