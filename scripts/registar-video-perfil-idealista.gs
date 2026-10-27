/* Operação pontual e repetível no documento ativo. Não altera o portal nem envia email. */
function registarVideoPerfilIdealista(){
  const lock=LockService.getDocumentLock();if(!lock.tryLock(5000))throw Error('Outra gravação em curso.');
  try{
    const ss=SpreadsheetApp.getActive(),sh=ss.getSheetByName(PEND.nome),vs=sh.getRange(6,1,sh.getLastRow()-5,sh.getLastColumn()).getValues();
    const existente=vs.findIndex(r=>norm_(r[1])==='idealista'&&r[2]==='Perfil do portal'&&/video/.test(norm_(r[3]))&&!['Concluído','Não aplicável'].includes(r[8]));
    const livre=vs.findIndex(r=>r.every((v,j)=>j===15||v===''||v==null));if(existente<0&&livre<0)throw Error('Sem linha livre; não gravei.');
    const row=6+(existente>=0?existente:livre),old=existente>=0?vs[existente]:null;
    let max=0;vs.forEach(r=>{if(/^P\d+$/.test(r[0]))max=Math.max(max,+r[0].slice(1));});
    const id=old?old[0]:'P'+String(max+1).padStart(4,'0'),requests=[],hoje=Utilities.formatDate(new Date(),ss.getSpreadsheetTimeZone(),'yyyy-MM-dd'),serial=Date.parse(hoje+'T00:00:00Z')/86400000+25569;
    if(old&&old[6]==='Sara'&&old[8]==='A aguardar esclarecimento'&&old[16]==='Sara'){console.log(JSON.stringify({id,linha:row,jaExiste:true}));return;}
    function cell(sheet,row,col,value){requests.push({updateCells:{range:{sheetId:sheet.getSheetId(),startRowIndex:row-1,endRowIndex:row,startColumnIndex:col-1,endColumnIndex:col},rows:[{values:[{userEnteredValue:typeof value==='number'?{numberValue:value}:{stringValue:String(value)}}]}],fields:'userEnteredValue'}});}
    if(!old){const dados=[id,'idealista','Perfil do portal','Vídeo de apresentação da agência no perfil Idealista','Pedido de Andreia: verificar o vídeo de apresentação da agência. Existência e publicação por confirmar.','Confirmar se existe um vídeo de apresentação da agência adequado para o perfil Idealista e se está publicado. Se faltar, indicar qual vídeo utilizar ou os próximos passos necessários.','Sara','Normal','A aguardar esclarecimento',serial,serial,'','','Idealista','Por verificar'];dados.forEach((v,i)=>cell(sh,row,i+1,v));}
    else{[[7,'Sara'],[9,'A aguardar esclarecimento'],[11,serial]].forEach(x=>cell(sh,row,x[0],x[1]));}
    cell(sh,row,17,'Sara');
    const h=estrutura_(ss,'Registo de alterações',['Data da alteração','Referência EGO','Autor','Onde foi alterado','Campo / assunto','Antes','Depois / alteração realizada','Motivo / fonte','Resultado da verificação']),hr=h.sh.getLastRow()+1;
    if(hr>h.sh.getMaxRows())throw Error('Sem linha livre no histórico; não gravei.');
    const hist={'Data da alteração':serial,'Referência EGO':'idealista','ID da pendência':id,'Autor':'Andreia','Onde foi alterado':PEND.nome,'Campo / assunto':'Perfil Idealista · vídeo de apresentação da agência','Antes':old?'Responsável: '+old[6]+'; estado: '+old[8]:'Pendência não registada','Depois / alteração realizada':'Verificação atribuída à Sara · '+id,'Motivo / fonte':'Pedido explícito de Andreia; publicação do vídeo por confirmar.','Resultado da verificação':'Confirmado'};
    Object.keys(hist).forEach(k=>{if(h.col(k))cell(h.sh,hr,h.col(k),hist[k]);});
    edSheets_(ss,':batchUpdate',{requests});
    const check=edSheets_(ss,'/values/'+encodeURIComponent("'"+PEND.nome+"'!A"+row+':R'+row)).values[0];
    if(check[0]!==id||check[6]!=='Sara'||check[8]!=='A aguardar esclarecimento'||check[16]!=='Sara')throw Error('Conferir a gravação antes de repetir.');
    console.log(JSON.stringify({id,linha:row,responsavel:check[6],estado:check[8],historico:hr}));
  }finally{lock.releaseLock();}
}
