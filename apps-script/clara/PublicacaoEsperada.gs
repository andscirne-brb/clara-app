/* Decisões manuais por imóvel. Não altera anúncios, levantamento ou pendências. */
const PE_FOLHA='Publicação esperada';
const PE_HEADERS=['Referência EGO','Idealista','Green-Acres','Rightmove','Data da decisão','Autor','ID da decisão','Confirmação da Idília'];
const PE_ESTADOS=['Por confirmar','Publicar','Não publicar'];
function peAtual_(ref,rows){const r=rows.filter(r=>r[0]===ref).slice(-1)[0];return{estados:r?r.slice(1,4):['Por confirmar','Por confirmar','Por confirmar'],data:r?r[4]:'',origem:r?r[7]:'',assinatura:JSON.stringify(r||null)};}
function peLinhas_(ss){const s=ss.getSheetByName(PE_FOLHA);if(!s)return[];const h=s.getRange(1,1,1,8).getDisplayValues()[0];if(PE_HEADERS.some((v,i)=>h[i]!==v))throw Error('Estrutura das decisões de publicação diferente da esperada. Nenhuma decisão foi alterada.');return s.getLastRow()>1?s.getRange(2,1,s.getLastRow()-1,8).getDisplayValues():[];}
function peEnriquecer_(ss,m){const rows=peLinhas_(ss);m.imoveis.forEach(x=>x.publicacao=peAtual_(x.ref,rows));return m;}
function peValidar_(ref,estados){if(typeof ref!=='string'||!ref.trim()||ref!==ref.trim().toUpperCase())throw Error('Referência inválida.');if(!Array.isArray(estados)||estados.length!==3||estados.some(v=>!PE_ESTADOS.includes(v)))throw Error('Seleciona uma opção válida para cada portal.');}
function guardarPublicacaoEsperada(ref,estados,assinatura,origem){
 peValidar_(ref,estados);if(typeof origem!=='string'||!origem.trim()||origem.length>500)throw Error('Regista onde e quando a Idília confirmou esta decisão (até 500 caracteres).');const lock=LockService.getDocumentLock();if(!lock.tryLock(1000))throw Error('Outra gravação em curso. Tenta novamente.');try{
 const ss=SpreadsheetApp.getActive(),s=ss.getSheetByName(LEV.nome);if(!s)throw Error('Levantamento não encontrado.');const h=s.getRange(9,1,1,s.getLastColumn()).getDisplayValues()[0],ri=h.indexOf('Referência EGO'),pi=h.indexOf('Prioridade');if(ri<0||pi<0)throw Error('Cabeçalhos do levantamento por confirmar.');const found=s.getRange(10,1,Math.max(1,s.getLastRow()-9),h.length).getDisplayValues().filter(r=>String(r[ri]||'').trim().toUpperCase()===ref);if(found.length!==1||found[0][pi]!=='Prioritária')throw Error('O imóvel já não é prioritário ou a referência não é única. Atualiza a consulta.');
 const rows=peLinhas_(ss),atual=peAtual_(ref,rows);if(assinatura!==atual.assinatura)throw Error('Esta decisão foi alterada entretanto. Atualiza a consulta antes de guardar.');if(JSON.stringify(estados)===JSON.stringify(atual.estados))return{...atual,alterada:false};
 const existente=ss.getSheetByName(PE_FOLHA),id=existente?existente.getSheetId():Math.max(0,...ss.getSheets().map(s=>s.getSheetId()))+1,linha=[ref,...estados,Utilities.formatDate(new Date(),ss.getSpreadsheetTimeZone(),'yyyy-MM-dd HH:mm:ss'),'Equipa — decisão da Idília',Utilities.getUuid(),origem.trim()],requests=[];
 if(!existente)requests.push({addSheet:{properties:{sheetId:id,title:PE_FOLHA,hidden:true,gridProperties:{rowCount:1000,columnCount:8}}}});
 const values=(r)=>({values:r.map(v=>({userEnteredValue:{stringValue:String(v)}}))});
 if(!existente)requests.push({updateCells:{start:{sheetId:id,rowIndex:0,columnIndex:0},rows:[values(PE_HEADERS)],fields:'userEnteredValue'}});
 if(existente&&existente.getMaxRows()<rows.length+2)requests.push({appendDimension:{sheetId:id,dimension:'ROWS',length:100}});
 requests.push({updateCells:{start:{sheetId:id,rowIndex:rows.length+1,columnIndex:0},rows:[values(linha)],fields:'userEnteredValue'}});
 Sheets.Spreadsheets.batchUpdate({requests},ss.getId());const guardado=peAtual_(ref,peLinhas_(ss));if(guardado.assinatura!==JSON.stringify(linha))throw Error('Não foi possível confirmar a gravação. Atualiza a consulta antes de repetir; a decisão pode ter sido guardada.');return{...guardado,alterada:true};
 }finally{lock.releaseLock();}
}
function verificarPublicacaoEsperada(){const m=consultarAuditoriaPrioritarios(),r={prioritarios:m.quantidade,decisoesExplicitas:m.imoveis.reduce((n,x)=>n+x.publicacao.estados.filter(v=>v!=='Por confirmar').length,0),somenteLeitura:true};console.log(JSON.stringify(r));return r;}
