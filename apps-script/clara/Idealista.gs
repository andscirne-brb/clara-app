const IDEALISTA_CABECALHOS=['Data da recolha','Tipo de página','Início do período','Fim do período','Filtros','Referência EGO','Código Idealista','Indicador','Valor','Cobertura','ID da recolha','Ligação','Observação'];
function colarLeituraIdealista() {
  const ui=SpreadsheetApp.getUi(), p=ui.prompt('Clara · Idealista','Cola aqui a leitura copiada pelo botão Clara no Idealista.',ui.ButtonSet.OK_CANCEL);
  if(p.getSelectedButton()!==ui.Button.OK)return;
  const texto=p.getResponseText().trim();
  try {
    if(!texto.startsWith('CLARA2:'))throw new Error('Isto não é uma leitura Idealista da Clara. Atualiza o marcador em Clara > Instalar o marcador.');
    const a=analisarIdealista(texto);
    if(a.duplicada){ui.alert('Esta recolha já está guardada. Não foi duplicada.');return;}
    const periodo=a.periodo.inicio?a.periodo.inicio+' a '+a.periodo.fim:a.periodo.etiqueta||'Estado atual';
    const resumo=a.tipo+' · '+a.quantidade+' registos · '+a.indicadores+' indicadores\n'+periodo+'\n'+a.cobertura+'\nFiltros: '+(a.filtros||[]).join(' · ')+'\n\nGuardar no histórico Idealista - recolhas?';
    if(ui.alert('Rever recolha Idealista',resumo,ui.ButtonSet.OK_CANCEL)!==ui.Button.OK)return;
    const r=gravarIdealista(texto);ui.alert(r.duplicada?'Esta recolha já estava guardada.':'Gravado: '+r.quantidade+' registos e '+r.escritos+' indicadores. '+r.cobertura);
  } catch(e){ui.alert('Não gravei a recolha. '+e.message);}
}
function lerIdealista_(texto) {
  if(String(texto).length>2000000)throw new Error('Leitura demasiado grande. Recolhe uma página de cada vez.');
  const d=JSON.parse(String(texto).trim().slice(7));
  if(d.v!==2||d.origem!=='idealista'||!['lista','ranking','zona','geral'].includes(d.tipo)||!/^https:\/\/(?:www\.)?idealista\.pt\//.test(d.url||''))throw new Error('Leitura Idealista inválida.');
  if(!Array.isArray(d.registos)||!d.registos.length||d.registos.length>1000)throw new Error('Sem dados válidos.');
  const tz=SpreadsheetApp.getActive().getSpreadsheetTimeZone();
  if(!dataTexto_(String(d.lido||'').slice(0,10),tz))throw new Error('Data de recolha inválida.');
  if(!Array.isArray(d.filtros)||d.filtros.length>30||d.filtros.some(function(f){return typeof f!=='string'||f.length>200;}))throw new Error('Filtros inválidos.');
  const relativoZona=d.tipo==='zona'&&/^(Hoje|7 dias|30 dias|90 dias)$/.test(d.periodo&&d.periodo.etiqueta||'');
  if(d.tipo!=='lista'&&!relativoZona&&(!dataTexto_(d.periodo&&d.periodo.inicio,tz)||!dataTexto_(d.periodo&&d.periodo.fim,tz)))throw new Error('O período não ficou identificado. Abre o gráfico no período pretendido, volta ao ranking se necessário e recolhe novamente.');
  if(d.tipo!=='lista'&&d.periodo.inicio>d.periodo.fim)throw new Error('Período inválido.');
  d.registos.forEach(function(r){if(!r.metricas||typeof r.metricas!=='object'||Array.isArray(r.metricas))throw new Error('Indicadores inválidos.');Object.keys(r.metricas).forEach(function(k){const v=r.metricas[k];if(v!==null&&(typeof v!=='number'||!Number.isFinite(v)||v<0))throw new Error('Valor inválido em '+k);if(k==='qualidade'&&v>100)throw new Error('Qualidade fora da escala.');});});
  return d;
}
function prepararIdealista_(texto, ss) {
  const d=lerIdealista_(texto), sh=ss.getSheetByName('Idealista - recolhas');
  if(sh && sh.getRange(1,1,1,13).getDisplayValues()[0].join('|')!==IDEALISTA_CABECALHOS.join('|'))throw new Error('A estrutura das recolhas Idealista mudou. Não gravei.');
  const assinatura=JSON.stringify({data:String(d.lido||'').slice(0,10),tipo:d.tipo,url:d.url,periodo:d.periodo,filtros:d.filtros,registos:d.registos,cobertura:d.cobertura});
  const hash=Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,assinatura).map(function(b){return('0'+(b&255).toString(16)).slice(-2);}).join('');
  const mapa={},existentes=ss.getSheetByName('Idealista - recolhas');
  if(existentes&&existentes.getLastRow()>1)existentes.getRange(2,6,existentes.getLastRow()-1,2).getDisplayValues().forEach(function(r){if(r[1]&&r[0]){if(mapa[r[1]]&&mapa[r[1]]!==r[0])mapa[r[1]]='';else mapa[r[1]]=r[0];}});
  let duplicada=false;if(sh&&sh.getLastRow()>1)duplicada=sh.getRange(2,11,sh.getLastRow()-1,1).getDisplayValues().some(function(r){return r[0]===hash;});
  const linhas=[],observacao=d.tipo==='zona'?'Comparativo da zona; não associar automaticamente à carteira. '+(d.periodo.etiqueta||'')+(!d.periodo.inicio?'; datas exatas não indicadas na página.':''):'';
  d.registos.forEach(function(r){const ref=r.ref||(d.tipo==='ranking'?mapa[r.id]||'':'');const campos=Object.assign({},r.metricas);['publicacao','rendimento','aviso','posicao'].forEach(function(k){if(r[k]!==undefined&&r[k]!==null&&r[k]!=='')campos[k]=r[k];});Object.keys(campos).forEach(function(k){if(campos[k]===null)return;linhas.push([dataTexto_(String(d.lido).slice(0,10),ss.getSpreadsheetTimeZone()),d.tipo,d.periodo.inicio||'',d.periodo.fim||'',JSON.stringify(d.filtros||[]),ref,r.id||'',k,campos[k],d.cobertura||'Página atual',hash,d.url,observacao]);});});
  if(!linhas.length)throw new Error('Não há indicadores para registar.');
  return {d:d,linhas:linhas,hash:hash,duplicada:duplicada};
}
function analisarIdealista(texto) {
  const p=prepararIdealista_(texto,SpreadsheetApp.getActive());
  return {origem:'idealista',tipo:p.d.tipo,periodo:p.d.periodo,cobertura:p.d.cobertura,filtros:p.d.filtros,quantidade:p.d.registos.length,indicadores:p.linhas.length,duplicada:p.duplicada,amostra:p.d.registos.slice(0,5)};
}
function gravarIdealista(texto) {
  const lock=LockService.getDocumentLock();if(!lock.tryLock(30000))throw new Error('Outra gravação em curso.');
  try {
    const ss=SpreadsheetApp.getActive(),p=prepararIdealista_(texto,ss);if(p.duplicada)return{origem:'idealista',duplicada:true,escritos:0};
    let sh=ss.getSheetByName('Idealista - recolhas');if(!sh){sh=ss.insertSheet('Idealista - recolhas');sh.getRange(1,1,1,13).setValues([IDEALISTA_CABECALHOS]);sh.setFrozenRows(1);sh.getRange(1,1,1,13).setFontWeight('bold').setBackground('#155c53').setFontColor('#ffffff');}
    const inicio=sh.getLastRow()+1,n=p.linhas.length;if(sh.getMaxRows()<inicio+n-1)sh.insertRowsAfter(sh.getMaxRows(),inicio+n-1-sh.getMaxRows());
    // Evita que texto copiado seja interpretado como fórmula.
    const seguro=p.linhas.map(function(r){return r.map(function(v){return typeof v==='string'&&/^[=+@-]/.test(v)?"'"+v:v;});});
    try {sh.getRange(inicio,1,n,13).setValues(seguro);sh.getRange(inicio,1,n,1).setNumberFormat('yyyy-mm-dd');SpreadsheetApp.flush();const a=sh.getRange(inicio,11,n,1).getValues();if(a.some(function(r){return r[0]!==p.hash;}))throw new Error('Conferência da gravação falhou.');}
    catch(e){sh.getRange(inicio,1,n,13).clearContent();throw e;}
    return{origem:'idealista',duplicada:false,escritos:n,quantidade:p.d.registos.length,cobertura:p.d.cobertura};
  } finally {lock.releaseLock();}
}
