/**
 * Clara · assistente do levantamento, dentro do Google Sheet.
 * Script ligado ao Sheet (Extensões > Apps Script). Não usa IDs: trabalha no Sheet onde está.
 * Regras: docs/ESTADO-E-PLANO.md. Esclarecimentos vão para a Sara; trabalho operacional é da Andreia.
 * MARCADOR_JS é preenchido a partir de apps-script/clara/marcador.js (scripts/construir-clara.py).
 */
const LEV = { nome: 'Levantamento', titulos: 9 };
const PEND = { nome: 'Pendências da equipa', titulos: 5 };
const IDIOMAS = { PT: 'português', EN: 'inglês', FR: 'francês', DE: 'alemão', ES: 'espanhol' };
const DOCS = [
  ['caderneta', 'Caderneta Predial (anexo)', 'Caderneta Predial'],
  ['certificado', 'Certificado Energético (anexo)', 'Certificado Energético'],
  ['contrato', 'Contrato Mediação (anexo)', 'Contrato de Mediação'],
  ['licenca', 'Licença Habitação (anexo)', 'Licença de Habitação']
];

/** Simplifica a apresentação sem mover registos, alterar estados ou perder detalhes. */
function simplificarPendenciasEquipa() {
  const s=SpreadsheetApp.getActive().getSheetByName(PEND.nome);
  if(!s)throw Error('Pendências da equipa não encontrada.');
  const cab=s.getRange(5,1,1,17).getDisplayValues()[0];
  if(cab[0]!=='ID'||cab[8]!=='Estado'||cab[16]!=='Aguarda análise de')throw Error('Estrutura de pendências diferente da esperada.');
  s.setFrozenColumns(0);
  s.getRange('A1:Q4').breakApart().clearContent();
  s.getRange('B2:Q2').merge().setValue('Pendências da equipa').setFontSize(20).setFontWeight('bold').setFontColor('#183746');
  s.getRange('B3:Q3').merge().setValue('O que falta fazer · quem é responsável · qual é o estado. Usa os filtros nos cabeçalhos.').setFontSize(10).setFontColor('#607786');
  s.getRange('B4:Q4').merge().setValue('Detalhes e histórico preservados em colunas ocultas. Para consultar tarefas concluídas, ajusta o filtro Estado.').setFontSize(9).setFontColor('#607786');
  s.showColumns(1,17);
  [[1,1],[3,1],[5,1],[8,1],[10,1],[12,6]].forEach(x=>s.hideColumns(x[0],x[1]));
  [[2,125],[4,245],[6,355],[7,125],[9,195],[11,140]].forEach(x=>s.setColumnWidth(x[0],x[1]));
  s.setFrozenRows(5);s.setFrozenColumns(0);s.setHiddenGridlines(true);
  s.getRange(5,1,1,17).setBackground('#183746').setFontColor('#ffffff').setFontWeight('bold').setWrap(true);s.setRowHeight(5,48);
  if(s.getLastRow()>5){s.getRange(6,1,s.getLastRow()-5,17).setFontFamily('Arial').setFontSize(10).setVerticalAlignment('top').setWrap(true);s.autoResizeRows(6,s.getLastRow()-5);}
  const dados=s.getLastRow()>5?s.getRange(6,1,s.getLastRow()-5,17).getValues():[],h=SpreadsheetApp.getActive().getSheetByName('Registo de alterações'),agora=Utilities.formatDate(new Date(),SpreadsheetApp.getActive().getSpreadsheetTimeZone(),'yyyy-MM-dd');
  const hc=h?colunas_(h,5):null,registos=[];
  dados.forEach(function(r,i){if(r[8]!=='A aguardar esclarecimento')return;if(r[6]!=='Sara'){
    if(!hc)throw Error('Falta histórico para registar a mudança de responsável.');
    const linha=Array(hc.titulos.length).fill(''),campos={'Data da alteração':agora,'Referência EGO':r[1],'ID da pendência':r[0],'Autor':'Andreia','Onde foi alterado':'Pendências da equipa','Campo / assunto':'Responsável','Antes':r[6],'Depois / alteração realizada':'Sara','Motivo / fonte':'Regra aprovada: aguardar esclarecimento atribui a tarefa à Sara.','Resultado da verificação':'Confirmado'};
    Object.keys(campos).forEach(k=>{if(hc.col(k))linha[hc.col(k)-1]=campos[k];});registos.push(linha);
  }});
  if(registos.length)h.getRange(h.getLastRow()+1,1,registos.length,hc.titulos.length).setValues(registos);
  dados.forEach(function(r,i){if(r[8]==='A aguardar esclarecimento'){if(r[6]!=='Sara')s.getRange(i+6,7).setValue('Sara');if(r[16]!=='Sara')s.getRange(i+6,17).setValue('Sara');}});
  SpreadsheetApp.flush();
  return {colunasVisiveis:6,registos:Math.max(0,s.getLastRow()-5)};
}


function textoCurtoClara_(t){return String(t||'').replace(/Fotografias/g,'Fotos').replace(/fotografias/g,'fotos');}
function simplificarAcaoClara_(t,tema){
 let partes=textoCurtoClara_(t).split('\nNota da equipa: '),base=partes.shift();
 const mapa={'Procurar no dossier e inserir no eGO.':'Verif. dossiê > digitalizar > upload eGO','Verif. dossiê > digitalizar > carregar no eGO.':'Verif. dossiê > digitalizar > upload eGO','Digitalizar, preparar e inserir no eGO.':'Digitalizar > upload eGO','Digitalizar > carregar no eGO.':'Digitalizar > upload eGO','Preparar o ficheiro digitalizado e inserir no eGO.':'Upload eGO','Carregar no eGO.':'Upload eGO','Converter a planta em imagem (JPG) e carregar no eGO.':'Converter para JPG > upload eGO','Converter para JPG > carregar no eGO.':'Converter para JPG > upload eGO','Preencher o texto alternativo e a legenda das fotos no eGO.':'Alt-text e legendas das fotos > eGO','Carregar fotos no eGO.':'Upload de fotos > eGO'};
 base=mapa[base]||base.replace(/Verif\. dossiê > digitalizar > carregar no eGO:/g,'Verif. dossiê > digitalizar > upload eGO:').replace(/ > carregar no eGO\.?/g,' > upload eGO');
 if(tema==='Plantas'&&/upload eGO/.test(base))partes=partes.filter(n=>!['Carregar a planta em imagem (JPG) no eGO.','Carregar a planta em imagem (JPG) no eGO','Converter a planta em imagem (JPG) e carregar no eGO.'].includes(n.trim()));
 return base+(partes.length?'\nNota da equipa: '+partes.join('\nNota da equipa: '):'');
}

const ESTADOS_VIDEO_CLARA=['A carregar vídeo','Sem vídeo disponível','Criar vídeo'];
function acaoFluxoPendencia_(r,estado){
 const acao=String(r[5]||''),partes=acao.split('\nNota da equipa: '),base=partes.shift(),nota=partes.join('\nNota da equipa: ');
 let nova=null;
 if(estado==='Não aplicável'&&typeof edMotivoCurto_==='function'&&edMotivoCurto_(r[11]))return edMotivoCurto_(r[11]);
 if(r[2]==='Vídeo'&&['Existe vídeo do imóvel?','Vídeo em falta'].includes(r[3])){
   const acoes={'A aguardar esclarecimento':'Confirmar com a Sara: carregar vídeo ou indicar se não há vídeo disponível.','A carregar vídeo':'Sara: carregar vídeo no eGO.','Sem vídeo disponível':'Pedir à Sara a criação de vídeo ou confirmar que não é necessário.','Criar vídeo':'Sara: criar vídeo > carregar no eGO.','Não aplicável':'Vídeo dispensado pela equipa.','Concluído':'Vídeo carregado no eGO.'};
   const antigas=['Esclarecer se existe vídeo e onde está, para a Andreia o carregar no eGO.','Confirmar se há vídeo disponível e anexar, ou justificar se não aplicável.','Esclarecer se existe vídeo e onde está, para a Andreia o carregar no eGO. Confirmado sem ficheiro no eGO nem no dossier; aguarda Sara: .'];
   if(acoes[estado]&&(antigas.includes(base)||Object.values(acoes).includes(base)||!base||ESTADOS_VIDEO_CLARA.includes(estado)))nova=acoes[estado];
   if(nova&&base&&!antigas.includes(base)&&!Object.values(acoes).includes(base))return nova+'\nNota da equipa: '+acao;
 }
 if(r[2]==='Plantas'&&['Planta','Planta só em PDF','Imóvel sem planta'].includes(r[3])&&estado==='Formato errado'){
   if(['Preparar o formato correto e inserir no eGO.','Converter a planta em imagem (JPG) e carregar no eGO.','Converter para JPG > carregar no eGO.',''].includes(base))nova='Converter para JPG > carregar no eGO.';
 }
 if(r[2]==='Documentos'){
   if(/^Verificar no dossier do escritório e carregar no eGO: [^\n]+$/.test(base))nova=base.replace('Verificar no dossier do escritório e carregar no eGO: ','Verif. dossiê > digitalizar > carregar no eGO: ').replace(/\s*Se não estiverem no dossier, pedir esclarecimento à Sara\.$/,'');
   const campo=typeof edCampoPendencia_==='function'?edCampoPendencia_(r):null;
   if(campo&&typeof edAcao_==='function'&&edAcoesAntigas_().includes(base))nova=edAcao_(estado,campo[2])||(base==='Esclarecer a ausência e disponibilizar o documento.'?'Pedir esclarecimento à Sara.':null);
 }
 const resultado=simplificarAcaoClara_(nova===null?acao:nova+(nota?'\nNota da equipa: '+nota:''),r[2]);
 return resultado===acao?null:resultado;
}
function atualizarFluxosPendencias(){
 const lock=LockService.getDocumentLock()||LockService.getScriptLock();if(!lock.tryLock(5000))throw Error('Outra gravação está em curso.');
 try{const ss=SpreadsheetApp.getActive(),sh=ss.getSheetByName(PEND.nome);
 edConfigurarDropdowns_(ss,[{nome:PEND.nome,col:9,opcoes:ESTADOS_VIDEO_CLARA}]);
 return sh.getLastRow()>5?sincronizarGestaoPendencias_(ss,6,sh.getLastRow()-5,0):{alteracoes:0};}finally{lock.releaseLock();}
}

function gestaoPendencia_(r,coluna,anterior){
  let responsavel=String(r[6]||''),estado=String(r[8]||'');
  const fechada=estado==='Concluído'||estado==='Não aplicável';
  if(!fechada){
    if(coluna===7&&responsavel==='Sara')estado='A aguardar esclarecimento';
    else if(coluna===7&&responsavel==='Andreia'&&estado==='A aguardar esclarecimento')estado='Por tratar';
    else if(coluna===9&&anterior==='A aguardar esclarecimento'&&estado!=='A aguardar esclarecimento'&&responsavel==='Sara')responsavel='Andreia';
    if(estado==='A aguardar esclarecimento')responsavel='Sara';
  }
  const video=r[2]==='Vídeo'&&['Existe vídeo do imóvel?','Vídeo em falta'].includes(r[3]);
  if(video&&!fechada){
    if(estado==='A carregar vídeo'||estado==='Criar vídeo')responsavel='Sara';
    if(estado==='Sem vídeo disponível')responsavel='Andreia';
  }
  if(r[2]==='Plantas'&&estado==='Formato errado')responsavel='Andreia';
  return{responsavel:responsavel,estado:estado,aguarda:!fechada&&responsavel==='Sara'?'Sara':'',acao:acaoFluxoPendencia_(r,estado)};
}
function responsavelPendencia_(r){return gestaoPendencia_(r,0).responsavel;}
function sincronizarGestaoPendencias_(ss,inicio,n,coluna,anterior){
  const sh=ss.getSheetByName(PEND.nome),hs=estrutura_(ss,'Registo de alterações',['Data da alteração','Referência EGO','Autor','Onde foi alterado','Campo / assunto','Antes','Depois / alteração realizada','Motivo / fonte','Resultado da verificação']);
  const linhas=sh.getRange(inicio,1,n,17).getValues(),plano=[],historico=[],hoje=dataHoje_();
  function agendar(sheet,row,col,novo){const cel=sheet.getRange(row,col),antes=cel.getValue();if(mesmoValor_(antes,novo))return;if(cel.getFormula())throw Error('Há uma fórmula na célula de gestão.');plano.push({sh:sheet,linha:row,col:col,cel:cel,antes:antes,depois:novo,antesFormato:cel.getNumberFormat()});}
  function nota(r,campo,antes,depois){historico.push({ref:r[1],id:r[0],campo:campo,antes:String(antes||''),depois:String(depois||'')});}
  linhas.forEach(function(r,i){if(!r[0]||!r[1])return;const row=inicio+i,g=gestaoPendencia_(r,coluna,anterior),changes=[[7,g.responsavel,'Responsável'],[9,g.estado,'Estado'],[17,g.aguarda,'Aguarda análise de']];changes.push([4,textoCurtoClara_(r[3]),'Assunto'],[5,textoCurtoClara_(r[4]),'Evidência']);if(g.acao!==null)changes.push([6,g.acao,'Ação necessária']);let mudou=false;
    if(n===1&&(coluna===7||coluna===9)&&anterior!==undefined&&String(anterior)!==String(r[coluna-1])){nota(r,coluna===7?'Responsável':'Estado',anterior,r[coluna-1]);mudou=true;}
    changes.forEach(function(x){if(String(r[x[0]-1]||'')!==x[1]){agendar(sh,row,x[0],x[1]);nota(r,x[2],r[x[0]-1],x[1]);mudou=true;}});
    if(mudou)agendar(sh,row,11,hoje);
  });
  if(!historico.length)return{alteracoes:0};
  const first=hs.sh.getLastRow()+1,last=first+historico.length-1,max=hs.sh.getMaxRows();
  if(last>max){const add=Math.max(200,last-max);hs.sh.insertRowsAfter(max,add);hs.sh.getRange(max,1,1,hs.sh.getLastColumn()).copyFormatToRange(hs.sh,1,hs.sh.getLastColumn(),max+1,max+add);}
  historico.forEach(function(h,i){const row=first+i,values={'Data da alteração':hoje,'Referência EGO':h.ref,'ID da pendência':h.id,'Autor':'Equipa','Onde foi alterado':PEND.nome,'Campo / assunto':h.campo,'Antes':h.antes,'Depois / alteração realizada':h.depois,'Motivo / fonte':'Sincronização de responsável e estado da pendência','Resultado da verificação':'Confirmado'};Object.keys(values).forEach(k=>{if(hs.col(k))agendar(hs.sh,row,hs.col(k),values[k]);});});
  const lotes=lotesGravacaoClara_(plano),aplicados=[];conferirLotesClara_(lotes,true);
  try{lotes.forEach(l=>{aplicados.push(l);escreverLoteClara_(l,false);});SpreadsheetApp.flush();conferirLotesClara_(lotes,false);}catch(e){aplicados.slice().reverse().forEach(l=>escreverLoteClara_(l,true));SpreadsheetApp.flush();conferirLotesClara_(aplicados,true);throw e;}
  return{alteracoes:historico.length};
}
function sincronizarResponsaveisPendencias(){const lock=LockService.getDocumentLock();if(!lock.tryLock(5000))throw Error('Há outra gravação em curso.');try{const ss=SpreadsheetApp.getActive(),sh=ss.getSheetByName(PEND.nome);return sh.getLastRow()>5?sincronizarGestaoPendencias_(ss,6,sh.getLastRow()-5,0):{alteracoes:0};}finally{lock.releaseLock();}}
function onEditGestaoAnterior_(e){
  if(!e||!e.range)return;const r=e.range,sh=r.getSheet();if(sh.getName()==='Ficha do imóvel'){if(r.getRow()===3&&r.getColumn()===2)try{mostrarFichaImovel(r.getDisplayValue());}catch(err){e.source.toast(err.message,'Clara',10);}return;}if(sh.getName()!==PEND.nome||r.getLastRow()<6)return;
  const first=r.getColumn(),last=r.getLastColumn();if(!(first<=7&&last>=7)&&!(first<=9&&last>=9))return;
  const lock=LockService.getDocumentLock();if(!lock.tryLock(5000)){e.source.toast('Há uma gravação em curso. Confirma depois o responsável e o estado.','Clara',8);return;}
  try{const inicio=Math.max(6,r.getRow()),col=r.getNumRows()===1&&r.getNumColumns()===1?first:0;sincronizarGestaoPendencias_(e.source,inicio,r.getLastRow()-inicio+1,col,e.oldValue);}catch(err){console.error('Gestão de pendências: '+err.message);e.source.toast('Não foi possível sincronizar a pendência. Confirma o responsável e o estado.','Clara',10);}finally{lock.releaseLock();}
}
function onEdit(e){
  onEditGestaoAnterior_(e);
  if(!e||!e.range||typeof edSincronizarEdicao_!=='function')return;
  try{edSincronizarEdicao_(e);}catch(err){console.error(err);e.source.toast('A edição foi mantida. Falta sincronizar: '+err.message,'Clara',12);}
}
function onOpen() {
  SpreadsheetApp.getUi().createMenu('Clara')
    .addItem('eGO: estado', 'abrirPainel')
    .addSeparator()
    .addItem('Idealista: estatísticas', 'colarLeituraIdealista')
    .addItem('Idealista: ranking dos anúncios', 'conferirPaginasIdealista')
    .addSeparator()
    .addItem('Rightmove: estatísticas', 'abrirRightmove')
    .addSeparator()
    .addItem('Green-Acres: estatísticas', 'abrirGreenAcres')
    .addSeparator()
    .addItem('Portais: imóveis', 'abrirImoveisPortais')
    .addItem('Portais: auditoria', 'abrirAuditoriaPrioritarios')
    .addItem('Portais: identificar anúncios', 'identificarAnunciosPortais')
    .addItem('Portais: conferência', 'abrirConferenciaPortais')
    .addSeparator()
    .addItem('Progresso', 'abrirLista')
    .addItem('Resumo semanal', 'abrirResumo')
    .addItem('Instalar o marcador', 'mostrarMarcador')
    .addToUi();
  try {const ss=SpreadsheetApp.getActive(),d=ss.getSheetByName('Dashboard');if(d&&d.getRange('A2').getValue()==='Resultados dos portais')atualizarDashboardSeNecessario();} catch(e){console.warn('Dashboard: '+e.message);}
}

function abrirPainel(){abrirPainelPlataforma_('ego');}
function abrirPainelPlataforma_(tipo){
  if(!['ego','idealista','rightmove','green-acres'].includes(tipo))throw Error('Plataforma inválida.');
  const titulo=tipo==='green-acres'?'Green-Acres: estatísticas':tipo==='idealista'?'Idealista: estatísticas':tipo==='rightmove'?'Rightmove: estatísticas':'eGO: estado';
  let html=PAINEL_HTML.replace('__CLARA_DOCUMENTO__',SpreadsheetApp.getActive().getId()).split('__CLARA_MARCA__').join(tipo).replace('id="titulo">eGO: estado','id="titulo">'+titulo);
  if(tipo!=='ego')html=html.replace('<fieldset id="blocoDocs">','<fieldset id="blocoDocs" hidden>');
  SpreadsheetApp.getUi().showSidebar(HtmlService.createHtmlOutput(html).setTitle('Clara'));
}

function abrirLista() {
  SpreadsheetApp.getUi().showSidebar(HtmlService.createHtmlOutput(LISTA_HTML).setTitle('Clara · progresso'));
}

/* ---------- lista de trabalho ---------- */
function listaTrabalho() {
  const ss = SpreadsheetApp.getActive();
  const lev = ss.getSheetByName(LEV.nome);
  const c = colunas_(lev, LEV.titulos);
  const n = lev.getLastRow() - LEV.titulos;
  const v = lev.getRange(LEV.titulos + 1, 1, n, c.titulos.length).getDisplayValues();
  const k = function (nome) { return c.col(nome) - 1; };
  const iRef = k('Referência EGO'), iNat = k('Natureza'), iCon = k('Concelho'), iPri = k('Prioridade'), iEst = k('Estado da verificação'), iUrl = k('Página pública'), iFal = k('Categorias com faltas');
  const imoveis = {};
  let total = 0, verificados = 0;
  const porVerificar = { 'Prioritária': [], 'Alta': [] }, contagem = { 'Prioritária': [0, 0], 'Alta': [0, 0], 'Normal': [0, 0] };
  v.forEach(function (r, i) {
    const ref = r[iRef]; if (!ref) return;
    total++;
    const ok = r[iEst] === 'Verificado'; if (ok) verificados++;
    const pr = r[iPri] || 'Normal';
    if (contagem[pr]) { contagem[pr][1]++; if (ok) contagem[pr][0]++; }
    const im = { ref: ref, natureza: r[iNat], concelho: r[iCon], prioridade: pr, estado: r[iEst], url: iUrl >= 0 ? r[iUrl] : '', faltas: iFal >= 0 ? r[iFal] : '', linha: LEV.titulos + 1 + i };
    imoveis[ref] = im;
    if (!ok && porVerificar[pr]) porVerificar[pr].push(im);
  });
  const ps = ss.getSheetByName(PEND.nome);
  const minhas = {}, sara = [];
  ps.getRange(PEND.titulos + 1, 1, Math.max(1, ps.getLastRow() - PEND.titulos), 17).getDisplayValues().forEach(function (r, i) {
    if (!r[1] || r[2] === 'Perfil do portal' || r[8] === 'Concluído' || r[8] === 'Não aplicável') return;
    const p = { id: r[0], ref: r[1], tema: r[2], assunto: r[3], acao: r[5], estado: r[8], linha: PEND.titulos + 1 + i };
    if (responsavelPendencia_(r) === 'Andreia') { (minhas[r[1]] = minhas[r[1]] || []).push(p); }
    else if (responsavelPendencia_(r) === 'Sara') sara.push(p);
  });
  const minhasLista = Object.keys(minhas).map(function (ref) { const im = imoveis[ref] || { ref: ref }; return { ref: ref, url: im.url || '', prioridade: im.prioridade || '', natureza: im.natureza || '', pendencias: minhas[ref] }; });
  const ordem = { 'Prioritária': 0, 'Alta': 1, 'Normal': 2 };
  const o = function (x) { return x.prioridade in ordem ? ordem[x.prioridade] : 3; };
  minhasLista.sort(function (a, b) { return o(a) - o(b) || b.pendencias.length - a.pendencias.length; });
  // As tarefas dos portais usam a mesma lista da equipa.
  const perfis = [];
  ps.getRange(PEND.titulos + 1, 1, Math.max(1, ps.getLastRow() - PEND.titulos), 17).getDisplayValues().forEach(function (r, i) {
    if (r[2] !== 'Perfil do portal' || r[8] === 'Concluído' || r[8] === 'Não aplicável') return;
    perfis.push({ portal: r[1], assunto: r[3], acao: r[5], estado: r[8], url: '', linha: PEND.titulos + 1 + i });
  });
  // Compatibilidade enquanto a reorganização ainda aguarda confirmação.
  const pf = ss.getSheetByName('Perfis dos portais');
  if (!perfis.length && pf && pf.getLastRow() > 1 && pf.getRange(1,2).getValue() === 'Assunto') {
    pf.getRange(2,1,pf.getLastRow()-1,7).getDisplayValues().forEach(function(r,i) {
      if (r[0] && /^(Ajustar|Por verificar|Em curso|Pendente)$/.test(r[3])) perfis.push({portal:r[0],assunto:r[1],acao:r[2],estado:r[3],url:r[6],linha:i+2,origem:'Perfis dos portais'});
    });
  }
  return { perfis: perfis, total: total, verificados: verificados, contagem: contagem, prioritarios: porVerificar['Prioritária'], alta: porVerificar['Alta'].slice(0, 15), altaTotal: porVerificar['Alta'].length, minhas: minhasLista, sara: sara };
}

/* ---------- resumo semanal: a Clara prepara, a Andreia copia para o webmail da Janela e envia ---------- */
function abrirResumo() {
  const inicial=JSON.stringify(previewResumo(7,'')).replace(/</g,'\\u003c').replace(/\u2028/g,'\\u2028').replace(/\u2029/g,'\\u2029');
  SpreadsheetApp.getUi().showModalDialog(HtmlService.createHtmlOutput(RESUMO_HTML.replace('/*RS_INICIAL*/null',inicial)).setWidth(1000).setHeight(720),'Clara · resumo semanal');
}
function dataDe_(txt) { const s = String(txt || ''); let m = /^(\d{4})-(\d{2})-(\d{2})(?:$|[ T])/.exec(s); if (m) return new Date(+m[1], +m[2] - 1, +m[3]); m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(s); return m ? new Date(+m[3], +m[2] - 1, +m[1]) : null; }
function resumoSemanal(dias) {
  dias=Number(dias||7);if(![7,14,30].includes(dias))throw Error('Escolhe 7, 14 ou 30 dias.');
  const ss=SpreadsheetApp.getActive(),tz=ss.getSpreadsheetTimeZone(),hoje=dataDe_(Utilities.formatDate(new Date(),tz,'dd/MM/yyyy')),de=new Date(hoje);de.setDate(de.getDate()-(dias-1));
  const lev=ss.getSheetByName(LEV.nome),c=colunas_(lev,LEV.titulos),ps=ss.getSheetByName(PEND.nome),hs=ss.getSheetByName('Registo de alterações');
  const ls=lev.getLastRow()>9?lev.getRange(10,1,lev.getLastRow()-9,c.titulos.length).getDisplayValues():[],pv=ps.getLastRow()>5?ps.getRange(6,1,ps.getLastRow()-5,17).getDisplayValues():[],history=hs&&hs.getLastRow()>5?hs.getRange(6,1,hs.getLastRow()-5,12).getDisplayValues():[];
  return rsModelo_(c.titulos,ls,pv,history,de,hoje);
}
function htmlResumo_(r){return rsHtml_(r);}
function previewResumo(dias,plano) {
  const r=resumoSemanal(dias),ss=SpreadsheetApp.getActive(),base=ss.getUrl(),dashboard=ss.getSheetByName('Dashboard'),pend=ss.getSheetByName(PEND.nome),vista=PropertiesService.getScriptProperties().getProperty('CLARA_VISTA_SARA_FVID')||'';
  r.links={documento:base+(dashboard?'#gid='+dashboard.getSheetId():''),sara:base+(pend?'#gid='+pend.getSheetId():'')+(/^\d+$/.test(vista)?'&fvid='+vista:''),filtrada:/^\d+$/.test(vista)};
  r.proximosPassos=String(plano||'').split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
  if(r.proximosPassos.join('\n').length>10000)throw Error('O plano é demasiado extenso. Resume os próximos passos.');
  r.html=htmlResumo_(r);r.assunto='Anúncios: ponto de situação de '+r.de+' a '+r.ate;return r;
}

function irPara(separador, linha) {
  const sh = SpreadsheetApp.getActive().getSheetByName(separador);
  sh.showSheet(); sh.activate(); sh.setActiveRange(sh.getRange(linha, 1, 1, Math.min(sh.getLastColumn(), 6)));
}

function mostrarMarcador() {
  const codigo = 'javascript:' + encodeURIComponent(MARCADOR_JS);
  const html = '<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.5">' +
    '<p style="font-size:12px;color:#526b78">Versão 20261028.2 · Idealista e Green-Acres: recolha conjunta</p><p><b>1.</b> Arrasta este botão para a barra de marcadores do navegador:</p>' +
    '<p style="text-align:center"><a href="' + codigo + '" style="display:inline-block;padding:8px 18px;background:#1a73e8;color:#fff;border-radius:6px;text-decoration:none;font-weight:bold">Clara</a></p>' +
    '<p>Se não der para arrastar: cria um marcador novo, chama-lhe <b>Clara</b> e cola isto no endereço:</p>' +
    '<label for="codigoMarcador">Código para o endereço do marcador</label><textarea id="codigoMarcador" style="width:100%;height:72px;font-size:11px" onclick="this.select()">' + codigo.replace(/&/g, '&amp;').replace(/</g, '&lt;') + '</textarea>' +
    '<button style="background:#087f8c;color:white;border:0;border-radius:6px;padding:9px 14px" onclick="var t=document.getElementById(&quot;codigoMarcador&quot;),e=document.getElementById(&quot;estadoCopia&quot;);t.focus();t.select();if(navigator.clipboard&amp;&amp;navigator.clipboard.writeText){navigator.clipboard.writeText(t.value).then(function(){e.textContent=&quot;Código copiado. Substitui o endereço do marcador Clara que já tens.&quot;;},function(){t.focus();t.select();e.textContent=&quot;Código selecionado. Copia com Ctrl+C.&quot;;});}else{e.textContent=&quot;Código selecionado. Copia com Ctrl+C.&quot;;}">Copiar código</button><p id="estadoCopia" role="status" style="font-size:12px;color:#526b78">Atualiza o marcador existente para usar a recolha guiada.</p>' +
    '<p><b>2.</b> No site da Janela, Idealista, Rightmove Plus ou Green-Acres com sessão iniciada, carrega no marcador <b>Clara</b>. Para atualizar um marcador antigo, substitui o seu endereço por este.</p>' +
    '<p><b>Idealista:</b> abre <b>Gráfico</b> nas estatísticas. Um clique tenta recolher totais, contactos diários, carteira ativa e Excel completo do ranking. No fim repõe o gráfico. Revê os componentes em falta antes de guardar.</p>' +
    '<p><b>Green-Acres:</b> abre <b>Resumo da conta</b>. Um clique tenta recolher os cinco CSV e todas as páginas da lista de anúncios. Copia e cola apenas uma vez; o resumo indica o que ficou por recolher.</p>' +
    '<p><b>3.</b> Para o Idealista: <b>Clara &gt; Idealista: estatísticas</b>, cola (Ctrl+V), revê e guarda. Para Rightmove: <b>Clara &gt; Rightmove: estatísticas</b>. Para Green-Acres: <b>Clara &gt; Green-Acres: estatísticas</b>. Para imóveis do site da Janela: <b>Clara &gt; eGO: estado</b>.</p></div>';
  SpreadsheetApp.getUi().showModalDialog(HtmlService.createHtmlOutput(html).setWidth(520).setHeight(600), 'Instalar o marcador Clara');
}

/* ---------- utilitários ---------- */
// Datas só com dia (pedido da Andreia: horas são informação irrelevante).
function dataHoje_() { const tz = SpreadsheetApp.getActive().getSpreadsheetTimeZone(); return Utilities.parseDate(Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd'), tz, 'yyyy-MM-dd'); }
function norm_(s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, ''); }
function colunas_(sh, linhaTitulos) {
  const t = sh.getRange(linhaTitulos, 1, 1, sh.getLastColumn()).getDisplayValues()[0];
  const m = {}; t.forEach(function (h, i) { if (h) m[norm_(h)] = i + 1; });
  return { titulos: t, col: function (nome) { return m[norm_(nome)] || 0; } };
}
function linhaDoImovel_(sh, c, ref) {
  const cr = c.col('Referência EGO'); if (!cr) throw new Error('Não encontrei a coluna "Referência EGO" no Levantamento.');
  const n = sh.getLastRow() - LEV.titulos; if (n < 1) return 0;
  const refs = sh.getRange(LEV.titulos + 1, cr, n, 1).getDisplayValues();
  for (let i = 0; i < refs.length; i++) if (refs[i][0].trim().toUpperCase() === ref) return LEV.titulos + 1 + i;
  return 0;
}

/* ---------- análise (não grava nada) ---------- */
// Comparação conservadora de um conjunto explícito de características; não prova existência física.
function cruzarCaracteristicasClara_(d){
  const normal=function(t){return String(t||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();};
  const nomes=d.nomesCaracteristicas,pt=d.textos&&d.textos.PT;
  if((d.idiomaCaracteristicas&&['PT','EN'].indexOf(d.idiomaCaracteristicas)<0)||(d.parcial&&!d.nomesCaracteristicasCompletos)||!Array.isArray(nomes)||(!d.nomesCaracteristicasCompletos&&nomes.length!==d.caracteristicas)||nomes.some(function(n){return typeof n!=='string'||!n.trim();})||!pt||pt.erro||typeof pt.descricao!=='string'||!pt.descricao.trim())return {estado:'Não foi possível verificar',sugestoes:[],assinaladasSemTexto:[],avaliadas:0};
  const regras=[['Piscina',/\bpiscinas?\b|\bswimming pool\b/],['Garagem',/\bgarage(?:m|ns)\b|\bgarage\b/],['Elevador',/\belevador\b|\blift\b|\belevator\b/],['Ar condicionado',/\bar condicionado\b|\bair conditioning\b/],['Terraço',/\bterracos?\b|\bterrace\b/],['Varanda',/\bvarandas?\b|\bbalcony\b/],['Jardim',/\bjardim\b|\bgarden\b/],['Lareira',/\blareira\b|\bfireplace\b/],['Painéis solares',/\bpaineis solares\b|\bsolar panels\b/],['Vidros duplos',/\bvidros duplos\b|\bdouble glazing\b/]];
  const frases=pt.descricao.replace(/<[^>]*>/g,' ').split(/[.!?;\n]+/).map(function(t){return t.trim();}).filter(Boolean),lista=nomes.map(normal),sugestoes=[],semTexto=[];
  regras.forEach(function(r){const assinalada=lista.some(function(n){return r[1].test(n);});const f=frases.find(function(t){const n=normal(t);return r[1].test(n)&&!/(\bsem\b|\bnao\b|possibilidade|potencial|poder[aã]|projeto|pre.instalacao|previst)/.test(n);});
    if(f&&!assinalada)sugestoes.push({nome:r[0],excerto:f.slice(0,300)});if(assinalada&&!f)semTexto.push(r[0]);
  });
  return {estado:sugestoes.length||semTexto.length?'Há diferenças a rever':'Sem divergências nos itens avaliados',sugestoes:sugestoes,assinaladasSemTexto:semTexto,avaliadas:regras.length};
}
function analisar(texto, docs) {
  texto = String(texto || '').trim();
  if(texto.indexOf('CLARA6:')===0)return analisarConjunto_(texto);
  if(texto.indexOf('CLARA5:')===0)return analisarLigacaoPortal(texto);
  if(texto.indexOf('CLARA4:')===0)return conferirAnalisePortal_(analisarGreenAcres(texto),texto);
  if(texto.indexOf('CLARA3:')===0)return conferirAnalisePortal_(analisarRightmove(texto),texto);
  if(texto.indexOf('CLARA2:')===0)return conferirAnalisePortal_(analisarIdealista(texto),texto);
  if (texto.indexOf('CLARA1:') !== 0) throw new Error('Isto não é uma leitura da Clara. Carrega no marcador Clara na página do imóvel e cola outra vez.');
  const d = JSON.parse(texto.slice(7));
  const ref = String(d.ref || '').trim().toUpperCase();
  if (!ref) throw new Error('A leitura não trouxe a referência do imóvel.');
  const sh = SpreadsheetApp.getActive().getSheetByName(LEV.nome);
  const c = colunas_(sh, LEV.titulos);
  const linha = linhaDoImovel_(sh, c, ref);
  if (!linha) throw new Error('A referência ' + ref + ' não está no Levantamento.');
  const atual = sh.getRange(linha, 1, 1, c.titulos.length).getDisplayValues()[0];
  const campos = [], pend = [], notas = [], naoVerificados = [];
  const prop = function (coluna, valor, motivo) {
    const k = c.col(coluna); if (!k) { notas.push('Coluna "' + coluna + '" não encontrada; ignorada.'); return; }
    // Uma ausência no site não apaga trabalho documental confirmado no dossier.
    if(coluna==='Vídeo'&&valor==='Em falta'&&['N/A','Não aplicável'].includes(atual[k-1]))valor=atual[k-1];
    if(coluna==='Planta'&&['Em falta','Formato errado','Por verificar'].includes(valor)&&['Digitalizado','No dossier > digitalizar','Falta no eGO + dossier','Falta no eGO > ver dossier','Categoria errada','Formato errado','N/A','Não aplicável','Preenchido'].includes(atual[k-1])){valor=atual[k-1];notas.push('Planta: estado operacional preservado. A leitura pública não confirma a situação no eGO nem no dossier.');}
    if(valor==='Em falta'&&DOCS.some(x=>x[1]===coluna)&&['Digitalizado','No dossier > digitalizar','Falta no eGO + dossier','Falta no eGO > ver dossier','Categoria errada','Formato errado','N/A','Não aplicável'].includes(atual[k-1]))valor=atual[k-1];
    const existente = campos.find(function (x) { return x.col === k; });
    if (existente) { existente.novo = valor; existente.motivo = motivo || ''; }
    else campos.push({ coluna: coluna, col: k, atual: atual[k - 1], novo: valor, motivo: motivo || '' });
  };
  const preservar = function(coluna,motivo){
    const k=c.col(coluna);if(!k)return;
    const anterior=atual[k-1], conhecido=anterior!==''&&anterior!=='Por verificar';
    const i=campos.findIndex(function(x){return x.col===k;});if(i>=0)campos.splice(i,1);
    naoVerificados.push({coluna:coluna,anterior:anterior,preservado:conhecido,motivo:motivo});
    prop(coluna,conhecido?anterior:'Por verificar',motivo+(conhecido?' Mantido o último estado registado; não foi reconfirmado.':''));
  };
  const nova = function (tema, assunto, evidencia, acao, ondeCorrigir, sara) {
    pend.push({ tema: tema, assunto: assunto, evidencia: evidencia, acao: simplificarAcaoClara_(acao,tema), onde: ondeCorrigir || 'eGO', sara: !!sara });
  };
  const hoje = Utilities.formatDate(new Date(), 'Europe/Lisbon', 'dd/MM/yyyy');
  const fonte = ' (site público, ' + hoje + ')';

  // Fotos
  if (d.fotos != null) {
    prop('Imagens', d.fotos > 0 ? 'Preenchido' : 'Em falta', d.fotos + ' fotos');
    if (c.col('N.º de imagens')) prop('N.º de imagens', d.fotos, '');
    if (d.fotos === 0) nova('Imagens', 'Imóvel sem fotos', 'O site não mostra fotos' + fonte + '.', 'Carregar fotos no eGO.');
  }
  if ((!d.parcial || d.fotosComAltCompletos === true) && d.fotosComAlt != null && d.fotos > 0) {
    const ok = d.fotosComAlt === d.fotos;
    prop('Alt-text', ok ? 'Preenchido' : 'Em falta', d.fotosComAlt + ' de ' + d.fotos + ' com texto alternativo');
    if (!ok) nova('Imagens', 'Fotos sem texto alternativo', 'No site, ' + (d.fotos - d.fotosComAlt) + ' de ' + d.fotos + ' fotos sem texto alternativo; ' + d.fotosComLegenda + ' com legenda' + fonte + '.', 'Preencher o texto alternativo e a legenda das fotos no eGO.');
  }
  // Textos por idioma
  const T = d.textos || {};
  Object.keys(IDIOMAS).forEach(function (k) {
    const t = T[k];
    let falta = '';
    if (!t || t.erro) falta = 'a página em ' + IDIOMAS[k] + ' não foi lida';
    else if (!String(t.descricao || '').trim()) falta = 'descrição vazia';
    else if (k !== 'EN' && k !== 'PT' && T.EN && t.descricao === T.EN.descricao) falta = 'a página em ' + IDIOMAS[k] + ' mostra o texto inglês';
    else if (k === 'EN' && T.PT && t.descricao === T.PT.descricao) falta = 'a página em inglês mostra o texto português';
    if (!t || t.erro) { preservar('Descrição ' + k, falta); return; }
    prop('Descrição ' + k, falta ? 'Em falta' : 'Preenchido', falta || (t.descricao.length + ' caracteres'));
    if (falta) {
      const nome = { PT: 'português', EN: 'inglês', FR: 'francês', DE: 'alemão', ES: 'espanhol' }[k];
      nova('Textos', 'Descrição em ' + nome + ' em falta', 'No site, ' + falta + fonte + '.', 'Preencher a descrição em ' + nome + ' no eGO.');
    }
    if (t && k !== 'PT' && k !== 'EN' && T.EN && t.titulo && t.titulo === T.EN.titulo)
      nova('Textos', 'Título em ' + IDIOMAS[k] + ' em falta', 'No site, o título em ' + IDIOMAS[k] + ' é igual ao inglês' + fonte + '.', 'Preencher o título em ' + IDIOMAS[k] + ' no eGO.');
  });
  // Características, vídeo, visita virtual, planta, folheto
  if ((!d.parcial || d.nomesCaracteristicasCompletos === true) && d.caracteristicas != null) prop('Características', d.caracteristicas > 0 ? 'Preenchido' : 'Em falta', d.caracteristicas + ' características assinaladas');
  const cruzamento=cruzarCaracteristicasClara_(d);
  if(c.col('Campos de características em falta')){
    if(cruzamento.avaliadas)prop('Campos de características em falta',cruzamento.sugestoes.length?'Sugestões por confirmar: '+cruzamento.sugestoes.map(function(x){return x.nome;}).join(', '):'Sem divergências nos itens avaliados','Comparação da descrição PT com os itens assinalados; requer revisão.');
    else preservar('Campos de características em falta','Não foi possível cruzar descrição e nomes das características.');
  }
  if (d.videos != null) {
    prop('Vídeo', d.videos > 0 ? 'Preenchido' : 'Em falta', d.videos + ' vídeos');
    if (d.videos === 0) nova('Vídeo', 'Existe vídeo do imóvel?', 'O site não mostra vídeo' + fonte + '.', 'Confirmar com a Sara: carregar vídeo ou indicar se não há vídeo disponível.', 'eGO', true);
  }
  // Visita virtual: descontinuada na Janela (22/10/2026), não se avalia.
  if (d.plantas) {
    const img = d.plantas.filter(function (e) { return /jpg|png|webp|gif/.test(e); }).length;
    const pdf = d.plantas.filter(function (e) { return e === 'pdf'; }).length;
    if (!d.plantas.length) { prop('Planta', 'Em falta', 'sem planta'); nova('Plantas', 'Imóvel sem planta', 'O site não mostra planta' + fonte + '.', 'Carregar a planta em imagem (JPG) no eGO.'); }
    else if (!img && pdf) { prop('Planta', 'Formato errado', pdf + ' planta(s) só em PDF: não são exportadas para os portais'); nova('Plantas', 'Planta só em PDF', 'O site mostra ' + pdf + ' planta(s) em PDF' + fonte + '. Plantas em PDF não são exportadas para os portais.', 'Converter a planta em imagem (JPG) e carregar no eGO.'); }
    else if (!img) prop('Planta', 'Por verificar', 'formato da planta não reconhecido');
    else prop('Planta', 'Preenchido', img + ' planta(s) em imagem' + (pdf ? ' e ' + pdf + ' em PDF' : ''));
  }
  if (d.folhetos != null) prop('Folheto', d.folhetos > 0 ? 'Preenchido' : 'Em falta', d.folhetos + ' folhetos');
  // Documentos (marcados no painel a partir da ficha do EGO)
  const emFalta = [], noutra = [], semDossier = [], verificarDossier = [];
  DOCS.forEach(function (x) {
    const v = docs && docs[x[0]];
    if (v === 'sim') prop(x[1], 'Preenchido', 'ficha do EGO');
    else if (v === 'nao' || v === 'sem_dossier') { prop(x[1], 'Em falta', v === 'sem_dossier' ? 'Sem ficheiro no eGO nem no dossier; aguarda Sara.' : 'ficha do EGO'); emFalta.push(x[2]); (v === 'sem_dossier' ? semDossier : verificarDossier).push(x[2]); }
    else if (v === 'categoria') { prop(x[1], 'Categoria errada', 'o ficheiro existe mas está noutra categoria'); noutra.push(x[2]); }
    else if (v === 'na') prop(x[1], 'N/A', 'não se aplica a este imóvel');
  });
  // Distingue o dossier no Levantamento sem alterar os estados usados pelas fórmulas.
  if(c.col('Observações / justificação N/A')){
    const anterior=String(atual[c.col('Observações / justificação N/A')-1]||'');let linhas=anterior.split(/\r?\n/);
    DOCS.forEach(function(x){const v=docs&&docs[x[0]];if(['sim','nao','sem_dossier','categoria','na'].indexOf(v)<0)return;
      const prefixo=x[2]+': ';linhas=linhas.filter(function(l){return l.indexOf(prefixo)!==0;});
      if(v==='nao')linhas.push(prefixo+'em falta no eGO; dossier por verificar.');
      if(v==='sem_dossier')linhas.push(prefixo+'em falta no eGO e no dossier; aguarda análise da Sara.');
    });
    const novo=linhas.filter(Boolean).join('\n');if(novo!==anterior)prop('Observações / justificação N/A',novo,'Situação documental por documento; outras observações preservadas.');
  }
  if (emFalta.length) nova('Documentos', 'Documentos obrigatórios sem ficheiro no eGO', 'Na ficha do eGO sem ficheiro: ' + emFalta.join(', ') + ' (' + hoje + ').' + (semDossier.length ? ' Confirmado também em falta no dossier: ' + semDossier.join(', ') + '.' : ''), (verificarDossier.length ? 'Verif. dossiê > digitalizar > carregar no eGO: ' + verificarDossier.join(', ') + '.' : '') + (semDossier.length ? (verificarDossier.length?'\n':'')+'Pedir esclarecimento à Sara: ' + semDossier.join(', ') + '.' : ''), 'eGO', semDossier.length > 0);
  if (noutra.length) nova('Documentos', 'Documentos na categoria errada no eGO', 'Na ficha do eGO, carregados noutra categoria: ' + noutra.join(', ') + ' (' + hoje + ').', 'Mover cada ficheiro para a categoria certa no bloco Documentos do eGO.');
  // A folha calcula o estado global a partir de vazios/Por verificar.
  // Uma falha de leitura não substitui um estado conhecido por desconhecido.
  const desconhecido = function (coluna) { preservar(coluna, 'Este bloco não foi verificado nesta leitura.'); };
  if (d.fotos == null) desconhecido('Imagens');
  if (d.fotosComAlt == null || (d.parcial && d.fotosComAltCompletos !== true)) desconhecido('Alt-text');
  if (d.caracteristicas == null || (d.parcial && d.nomesCaracteristicasCompletos !== true)) desconhecido('Características');
  if (d.videos == null) desconhecido('Vídeo');
  if (!Array.isArray(d.plantas)) desconhecido('Planta');
  if (d.folhetos == null) desconhecido('Folheto');
  DOCS.forEach(function (x) { if (!docs || ['sim', 'nao', 'sem_dossier', 'categoria', 'na'].indexOf(docs[x[0]]) < 0) desconhecido(x[1]); });
  if (d.url && c.col('Página pública')) prop('Página pública', d.url, 'ligação ao anúncio no site');
  if (c.col('Data da verificação')) prop('Data da verificação', hoje, '');
  const docsCompletos = DOCS.every(function (x) { return docs && ['sim', 'nao', 'sem_dossier', 'categoria', 'na'].indexOf(docs[x[0]]) >= 0; });
  const textosCompletos = Object.keys(IDIOMAS).every(function (k) { return T[k] && !T[k].erro && typeof T[k].descricao === 'string' && typeof T[k].titulo === 'string'; });
  const mediaCompletos = ['fotos', 'fotosComAlt', 'caracteristicas', 'videos', 'folhetos'].every(function (k) { return typeof d[k] === 'number' && isFinite(d[k]) && d[k] >= 0; }) && Array.isArray(d.plantas) && d.plantas.every(function (ext) { return /^(jpg|jpeg|png|webp|gif|pdf)$/.test(ext); });
  const completa = !d.parcial && docsCompletos && textosCompletos && mediaCompletos;
  if (c.col('Estado da verificação')) prop('Estado da verificação', completa ? 'Verificado' : 'Em curso', completa ? 'Todos os blocos foram revistos.' : 'Há blocos por verificar; esta leitura não conclui o levantamento.');
  if (!completa) notas.push('Levantamento em curso: confirma os quatro documentos, os cinco idiomas e os dados de imagens, planta, vídeo e folheto.');
  if (d.parcial) notas.push('Leitura parcial: apenas os blocos confirmados nesta leitura são atualizados; os restantes mantêm a informação anterior.');

  // Assuntos que esta leitura consegue verificar (para confirmar correções)
  const verificaveis = {};
  const pode = function (a) { verificaveis[a] = true; };
  if (d.fotos != null) pode('Imóvel sem fotos');
  if ((!d.parcial || d.fotosComAltCompletos === true) && d.fotosComAlt != null) pode('Fotos sem texto alternativo');
  Object.keys(IDIOMAS).forEach(function (k) {
    const t = T[k]; if (!t || t.erro) return;
    pode('Descrição em ' + IDIOMAS[k] + ' em falta');
    if (k !== 'PT' && k !== 'EN') pode('Título em ' + IDIOMAS[k] + ' em falta');
  });
  if (d.videos != null) pode('Existe vídeo do imóvel?');
  if (Array.isArray(d.plantas) && d.plantas.every(function (e) { return /^(jpg|jpeg|png|webp|gif|pdf)$/.test(e); })) { pode('Imóvel sem planta'); pode('Planta só em PDF'); }
  const todosVistos = docs && DOCS.every(function (x) { return ['sim', 'nao', 'sem_dossier', 'categoria', 'na'].indexOf(docs[x[0]]) >= 0; });
  if (todosVistos && emFalta.length === 0) pode('Documentos obrigatórios sem ficheiro no eGO');
  if (todosVistos && noutra.length === 0) pode('Documentos na categoria errada no eGO');
  const detetados = {}; pend.forEach(function (p) { detetados[p.assunto] = true; });

  // Pendências já existentes: não duplicar e confirmar as que foram corrigidas
  const ps = SpreadsheetApp.getActive().getSheetByName(PEND.nome);
  const existentes = {}, resolvidas = [];
  ps.getRange(PEND.titulos + 1, 1, Math.max(1, ps.getLastRow() - PEND.titulos), 17).getDisplayValues().forEach(function (r, i) {
    if (!r[1] || r[1].toUpperCase() !== ref) return;
    const assuntoAtual=textoCurtoClara_(r[3]);
    const key = r[1].toUpperCase() + '|' + assuntoAtual;
    const registro = { id: r[0], linha: PEND.titulos + 1 + i, estado: r[8], aguarda: r[16], responsavel: r[6], evidencia: r[4], acao: r[5], assunto:r[3] };
    if (!existentes[key] || existentes[key].estado === 'Concluído') existentes[key] = registro;
    // O seguimento manual de Planta cobre os dois avisos gerados pelo site.
    if(r[2]==='Plantas'&&r[3]==='Planta'){
      existentes[ref+'|Imóvel sem planta']=registro;existentes[ref+'|Planta só em PDF']=registro;
    }
    const aberta = r[8] !== 'Concluído' && r[8] !== 'Não aplicável';
    if (aberta && verificaveis[assuntoAtual] && !detetados[assuntoAtual]) resolvidas.push({ id: r[0], assunto: r[3], linha: PEND.titulos + 1 + i });
  });
  pend.forEach(function (p) {
    const ex = p.tema==='Plantas'&&existentes[ref+'|Planta']||existentes[ref + '|' + p.assunto];
    p.jaExiste = ex ? ex.id : ''; p.linhaExistente = ex ? ex.linha : 0;
    p.reabrir = !!ex && ex.estado === 'Concluído';
    p.atualizar = !!ex && ex.estado !== 'Concluído' && ex.estado !== 'Não aplicável' && (p.tema === 'Documentos' ? todosVistos : !!verificaveis[p.assunto]) && (ex.evidencia !== p.evidencia || ex.acao !== p.acao || (p.sara && (ex.aguarda !== 'Sara' || ex.responsavel !== 'Sara')));
    p.retomarAndreia = !!ex && p.tema==='Documentos' && todosVistos && !p.sara && ex.estado==='A aguardar esclarecimento' && ex.responsavel==='Sara';
    if(p.retomarAndreia)p.atualizar=true;
    if(p.tema==='Plantas'&&ex&&ex.assunto==='Planta'){p.reabrir=false;p.atualizar=false;p.retomarAndreia=false;}
    if(p.tema==='Vídeo'&&ex&&['A carregar vídeo','Sem vídeo disponível','Criar vídeo','Não aplicável'].includes(ex.estado)){p.reabrir=false;p.atualizar=false;p.sara=false;}
    p.responsavelReabertura=p.sara?'Sara':ex&&ex.responsavel==='Sara'?'Andreia':ex?ex.responsavel:'Andreia';
    p.delegarSara = !!ex && ex.estado !== 'Concluído' && ex.estado !== 'Não aplicável' && p.sara;
    if (p.tema === 'Documentos' && p.delegarSara && !todosVistos && semDossier.length) {
      const aviso = 'Confirmado sem ficheiro no eGO nem no dossier; aguarda Sara: ' + semDossier.join(', ') + '.';
      p.evidencia = ex.evidencia.indexOf(aviso) >= 0 ? ex.evidencia : ex.evidencia + ' ' + aviso;
      p.acao = ex.acao.indexOf(aviso) >= 0 ? ex.acao : ex.acao + ' ' + aviso;
      p.atualizar = ex.evidencia !== p.evidencia || ex.acao !== p.acao || ex.aguarda !== 'Sara' || ex.responsavel !== 'Sara';
    }
  });
  const mudam = campos.filter(function (x) { return String(x.atual) !== String(x.novo); }).length;
  return { ref: ref, linha: linha, campos: campos, pendencias: pend, resolvidas: resolvidas, notas: notas, naoVerificados: naoVerificados, cruzamento: cruzamento, mudam: mudam, url: d.url || '', hoje: hoje, completa: completa, textos: Object.keys(IDIOMAS).filter(function (k) { return T[k] && !T[k].erro && typeof T[k].descricao === 'string' && typeof T[k].titulo === 'string'; }).map(function (k) { return { idioma: k, titulo: T[k].titulo, descricao: T[k].descricao }; }) };
}

/* ---------- gravação e histórico (só depois de confirmar) ---------- */
// O bloqueio protege as gravações da Clara; edições manuais são reconferidas
// antes de escrever. A recuperação repõe só as células já escritas nesta operação.
function estrutura_(ss, nome, obrigatorias) {
  const sh = ss.getSheetByName(nome);
  if (!sh) throw new Error('Falta o separador ' + nome + '. Não gravei alterações.');
  const n = Math.min(12, sh.getLastRow());
  const linhas = sh.getRange(1, 1, n, sh.getLastColumn()).getDisplayValues();
  for (let i = 0; i < linhas.length; i++) {
    const mapa = {}; linhas[i].forEach(function (v, j) { if (v) mapa[norm_(v)] = j + 1; });
    if (obrigatorias.every(function (h) { return !!mapa[norm_(h)]; })) return { sh: sh, linha: i + 1, col: function (h) { return mapa[norm_(h)] || 0; } };
  }
  throw new Error('Os títulos de ' + nome + ' mudaram. Não gravei alterações.');
}
function celVazia_(v) { return v === '' || v == null; }
function reservarCapacidadeDestino_(sh,titulos,quantidade,nomeDestino){
  const pendencias=(nomeDestino||sh.getName())===PEND.nome;
  const limite=Math.max(titulos+1,sh.getLastRow()),largura=sh.getLastColumn();if(!quantidade)return{limite:limite,adicionadas:0};
  const inicio=Math.max(titulos+1,limite-199),n=limite-inicio+1,rg=sh.getRange(inicio,1,n,largura),vs=rg.getValues(),fs=rg.getFormulas();
  let livres=0;vs.forEach((r,i)=>{if(r.every((v,j)=>celVazia_(v)||(pendencias&&j===15&&fs[i][j]))&&fs[i].every((v,j)=>!v||(pendencias&&j===15)))livres++;});
  if(livres>=quantidade)return{limite:limite,adicionadas:0};
  const add=Math.max(200,quantidade-livres);
  const filtro=typeof sh.getFilter==='function'?sh.getFilter():null,criterios=[];
  let fase='filtros';
  try{
    if(filtro){const fr=filtro.getRange();for(let col=fr.getColumn();col<fr.getColumn()+fr.getNumColumns();col++){const c=filtro.getColumnFilterCriteria(col);if(c){criterios.push([col,c]);filtro.removeColumnFilterCriteria(col);}}SpreadsheetApp.flush();}
    fase='inserção';
    // Inserção antes da última linha de dados mantém a expansão dentro da tabela e das vistas.
    // Executa antes do planeamento; as referências dos registos são relidas depois.
    sh.insertRowsBefore(limite,add);
    const modelo=sh.getRange(limite+add,1,1,largura),validacoes=modelo.getDataValidations()[0];
    fase='formatos';modelo.copyFormatToRange(sh,1,largura,limite,limite+add-1);
    fase='validações';validacoes.forEach((v,j)=>{if(v)sh.getRange(limite,j+1,add,1).setDataValidation(v);});
    fase='conferência';if(pendencias&&largura>=16){const f=modelo.getFormulasR1C1()[0][15],dest=sh.getRange(limite,16,add,1);if(f&&!dest.getFormulasR1C1().every(r=>r[0]===f))dest.setFormulasR1C1(Array.from({length:add},()=>[f]));}
    SpreadsheetApp.flush();return{limite:limite+add,adicionadas:add};
  }catch(e){throw Error('Não foi possível preparar espaço em '+sh.getName()+' ('+fase+'). Não gravei os dados da leitura. '+e.message);}
  finally{if(filtro){criterios.forEach(x=>filtro.setColumnFilterCriteria(x[0],x[1]));SpreadsheetApp.flush();}}
}
function valorEscritaClara_(valor,formato) {
  if(valor instanceof Date && /[dy]/i.test(String(formato).replace(/"[^"]*"/g,''))){
    // Datas por número de série evitam a perda silenciosa de objetos Date em tabelas nativas.
    const local=Utilities.formatDate(valor,SpreadsheetApp.getActive().getSpreadsheetTimeZone(),"yyyy-MM-dd'T'HH:mm:ss.SSS");
    const serial=Date.parse(local+'Z')/86400000+25569;
    if(!Number.isFinite(serial))throw Error('Não foi possível preparar a data para gravação.');
    return serial;
  }
  return typeof valor==='string'&&valor!==''?"'"+valor:valor;
}
function escreverLiteralClara_(cel,valor){
  // Escape nativa do Sheets; não altera formatos das colunas tipadas.
  cel.setValue(valorEscritaClara_(valor,cel.getNumberFormat()));
}
// Agrupa apenas células planeadas contíguas: nunca inclui fórmulas ou intervalos intermédios.
function lotesGravacaoClara_(plano) {
  const linhas = {};
  plano.forEach(function(p){const k=p.sh.getName()+'|'+p.linha;(linhas[k]||(linhas[k]=[])).push(p);});
  const lotes=[];
  Object.keys(linhas).forEach(function(k){
    const ps=linhas[k].sort(function(a,b){return a.col-b.col;});let atual=null;
    ps.forEach(function(p){if(!atual||p.col!==atual.col+atual.itens.length){atual={sh:p.sh,linha:p.linha,col:p.col,itens:[]};lotes.push(atual);}atual.itens.push(p);});
  });
  lotes.sort(function(a,b){return a.sh.getName().localeCompare(b.sh.getName())||a.col-b.col||a.itens.length-b.itens.length||a.linha-b.linha;});
  const blocos=[];
  lotes.forEach(function(l){const anterior=blocos[blocos.length-1];
    if(anterior&&anterior.sh===l.sh&&anterior.col===l.col&&anterior.linhas[0].length===l.itens.length&&l.linha===anterior.linha+anterior.linhas.length)anterior.linhas.push(l.itens);
    else blocos.push({sh:l.sh,linha:l.linha,col:l.col,linhas:[l.itens]});
  });
  return blocos.map(function(l){l.rg=l.sh.getRange(l.linha,l.col,l.linhas.length,l.linhas[0].length);return l;});
}
function conferirLotesClara_(lotes,antes){
  lotes.forEach(function(l){const vs=l.rg.getValues(),fs=l.rg.getFormulas(),fm=l.rg.getNumberFormats();
    l.linhas.forEach(function(ps,r){ps.forEach(function(p,c){if(fs[r][c]||!mesmoValor_(vs[r][c],antes?p.antes:p.depois)||fm[r][c]!==p.antesFormato)throw new Error('A conferência não corresponde ao valor previsto em '+l.sh.getName()+'!'+p.cel.getA1Notation()+'.');});});
  });
}
function escreverLoteClara_(l,antes){
  l.rg.setValues(l.linhas.map(function(ps){return ps.map(function(p){const v=antes?p.antes:p.depois;return valorEscritaClara_(v,p.antesFormato);});}));
}
function mesmoValor_(a, b) {
  if(a instanceof Date && b instanceof Date)return a.getTime()===b.getTime();
  // O Sheets normaliza as quebras de linha; não ignorar outras diferenças.
  if(typeof a==='string' && typeof b==='string')return a.replace(/\r\n?/g,'\n')===b.replace(/\r\n?/g,'\n');
  return a===b;
}
function textoHistorico_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, SpreadsheetApp.getActive().getSpreadsheetTimeZone(), 'dd/MM/yyyy');
  return v == null ? '' : String(v);
}
function gravar(texto, docs) {
  if(String(texto||'').trim().indexOf('CLARA6:')===0)return gravarConjunto_(texto);
  if(String(texto||'').trim().indexOf('CLARA5:')===0)return gravarLigacaoPortal(texto);
  if(String(texto||'').trim().indexOf('CLARA4:')===0)return respostaAutomacaoPortais_(gravarGreenAcres(texto),texto);
  if(String(texto||'').trim().indexOf('CLARA3:')===0)return respostaAutomacaoPortais_(gravarRightmove(texto),texto);
  if(String(texto||'').trim().indexOf('CLARA2:')===0)return respostaAutomacaoPortais_(gravarIdealista(texto),texto);
  const lock = LockService.getDocumentLock();
  if (!lock.tryLock(30000)) throw new Error('Há outra gravação da Clara em curso. Tenta novamente.');
  let aplicados = [], plano = [];
  const inicio=Date.now(),tempos={};let etapaInicio=inicio;
  function medir(fase){tempos[fase]=Date.now()-etapaInicio;etapaInicio=Date.now();console.log('Clara desempenho '+JSON.stringify({fase:fase,ms:tempos[fase]}));}
  try {
    let a = analisar(texto, docs); const ss = SpreadsheetApp.getActive(), hoje = dataHoje_();
    const lev = ss.getSheetByName(LEV.nome), ps = ss.getSheetByName(PEND.nome);
    const tx = estrutura_(ss, 'Textos por idioma', ['Referência EGO', 'Idioma', 'Título original', 'Descrição original', 'Origem / evidência', 'Data de recolha', 'Estado da recolha']);
    const hs = estrutura_(ss, 'Registo de alterações', ['Data da alteração', 'Referência EGO', 'Autor', 'Onde foi alterado', 'Campo / assunto', 'Antes', 'Depois / alteração realizada', 'Motivo / fonte', 'Resultado da verificação']);
    const capacidadePend=reservarCapacidadeDestino_(ps,PEND.titulos,a.pendencias.filter(p=>!p.jaExiste).length),capacidadeTextos=reservarCapacidadeDestino_(tx.sh,tx.linha,a.textos.length);
    if(capacidadePend.adicionadas||capacidadeTextos.adicionadas)a=analisar(texto,docs);
    medir('analise');
    const vistos = {}, historico = [], idOperacao = Utilities.getUuid(),cacheLinhas={},metadados={};
    function meta(sh){const k=sh.getName();return metadados[k]||(metadados[k]={max:sh.getMaxRows(),largura:sh.getLastColumn()});}
    function carregarLinhas(sh,inicio,n){
      const rg=sh.getRange(inicio,1,n,meta(sh).largura),vs=rg.getValues(),fs=rg.getFormulas(),fm=rg.getNumberFormats();
      vs.forEach(function(v,i){cacheLinhas[sh.getName()+'|'+(inicio+i)]={valores:v,formulas:fs[i],formatos:fm[i]};});
    }
    function linhaCache(sh,linha){const k=sh.getName()+'|'+linha;if(!cacheLinhas[k])carregarLinhas(sh,linha,1);return cacheLinhas[k];}
    function agendar(sh, linha, col, novo, campo, pendencia, semHistorico) {
      if (!col || linha > meta(sh).max) throw new Error('Sem espaço ou coluna em ' + sh.getName() + '. Não gravei alterações.');
      if (typeof novo === 'string' && novo.length > 50000) throw new Error('O texto excede o limite de uma célula. Não gravei alterações.');
      const cel = sh.getRange(linha, col);
      const snapshot=linhaCache(sh,linha);
      if (snapshot.formulas[col-1]) throw new Error('A célula ' + sh.getName() + '!' + cel.getA1Notation() + ' tem uma fórmula. Não gravei alterações.');
      const antes = snapshot.valores[col-1];
      if (mesmoValor_(antes, novo)) return;
      const key = sh.getName() + '|' + linha + '|' + col;
      if (vistos[key]) throw new Error('Alterações repetidas na mesma célula. Não gravei alterações.');
      vistos[key] = true;
      plano.push({ cel: cel, sh: sh, linha: linha, col: col, antes: antes, depois: novo, antesFormato: snapshot.formatos[col-1] });
      if (!semHistorico) historico.push({ onde: sh.getName(), campo: campo, antes: textoHistorico_(antes), depois: textoHistorico_(novo), pendencia: pendencia || '' });
    }
    function vagas(sh, inicio, quantidade) {
      if (!quantidade) return [];
      const limite=sh===ps?capacidadePend.limite:sh===tx.sh?capacidadeTextos.limite:meta(sh).max,livres=[],primeira=sh===hs.sh?Math.max(inicio,sh.getLastRow()+1):inicio;
      for(let cursor=primeira;cursor<=limite&&livres.length<quantidade;cursor+=200){
        const n=Math.min(200,limite-cursor+1),rg=sh.getRange(cursor,1,n,meta(sh).largura),values=rg.getValues(),formulas=rg.getFormulas();
        for(let i=0;i<n&&livres.length<quantidade;i++){
          const ocupada=values[i].some(function(v,j){return !celVazia_(v)&&!(sh.getName()===PEND.nome&&j===15&&formulas[i][j]);});
          const formula=formulas[i].some(function(v,j){return !!v&&!(sh.getName()===PEND.nome&&j===15);});
          if(!ocupada&&!formula)livres.push(cursor+i);
        }
      }
      if(livres.length<quantidade && sh===hs.sh){
        const faltam=quantidade-livres.length,adicionar=Math.max(200,faltam);
        try{
          sh.insertRowsAfter(limite,adicionar);
          // Copia apenas formatos, incluindo datas; nunca replica valores ou fórmulas do histórico.
          sh.getRange(limite,1,1,meta(sh).largura).copyFormatToRange(sh,1,meta(sh).largura,limite+1,limite+adicionar);
          meta(sh).max=sh.getMaxRows();
          for(let i=1;i<=faltam;i++)livres.push(limite+i);
        }catch(e){throw new Error('Não foi possível ampliar o Registo de alterações. Não gravei alterações. '+e.message);}
      }
      if (livres.length !== quantidade) throw new Error('Sem linhas livres em ' + sh.getName() + '. Não gravei alterações.');
      return livres;
    }
    a.campos.forEach(function (x) {
      // Estado da verificação é calculado em algumas folhas. Os blocos por verificar
      // acima alimentam essa fórmula; a Clara nunca a substitui por texto.
      if (x.coluna === 'Estado da verificação' && linhaCache(lev,a.linha).formulas[x.col-1]) return;
      agendar(lev, a.linha, x.col, x.coluna === 'Data da verificação' ? hoje : x.novo, x.coluna);
    });
    // Só atualiza idiomas efetivamente lidos; nunca apaga um idioma inacessível.
    const tv = tx.sh.getRange(tx.linha + 1, 1, Math.max(1, tx.sh.getLastRow() - tx.linha), tx.sh.getLastColumn()).getDisplayValues();
    const novosIdiomas = a.textos.filter(function (t) { return !tv.some(function (r) { return r[tx.col('Referência EGO') - 1] === a.ref && r[tx.col('Idioma') - 1] === t.idioma; }); });
    const livresTx = vagas(tx.sh, tx.linha + 1, novosIdiomas.length); let proximaTx = 0;
    a.textos.forEach(function (t) {
      const achadas = [];
      tv.forEach(function (r, i) { if (r[tx.col('Referência EGO') - 1] === a.ref && r[tx.col('Idioma') - 1] === t.idioma) achadas.push(tx.linha + 1 + i); });
      if (achadas.length > 1) throw new Error('Há linhas repetidas para ' + t.idioma + '. Não gravei alterações.');
      const linha = achadas.length ? achadas[0] : livresTx[proximaTx++];
      const dados = { 'Referência EGO': a.ref, 'Idioma': t.idioma, 'Título original': t.titulo, 'Descrição original': t.descricao, 'Origem / evidência': a.url ? 'Página pública: ' + a.url : 'Leitura da Clara', 'Data de recolha': hoje, 'Estado da recolha': 'Revisto' };
      Object.keys(dados).forEach(function (h) { agendar(tx.sh, linha, tx.col(h), dados[h], t.idioma + ' · ' + h); });
    });
    const novas = a.pendencias.filter(function (p) { return !p.jaExiste; }), livresP = vagas(ps, PEND.titulos + 1, novas.length);
    const ids = ps.getRange(PEND.titulos + 1, 1, Math.max(1, ps.getLastRow() - PEND.titulos), 1).getDisplayValues();
    let maxId = 0, ip = 0;
    ids.forEach(function (r) { const m = /^P(\d+)$/.exec(r[0]); if (m) maxId = Math.max(maxId, +m[1]); });
    const criadas = [], reabertas = [], confirmadas = [];
    a.pendencias.forEach(function (p) {
      if (p.jaExiste && !p.reabrir) {
        if (p.atualizar) [[5, p.evidencia], [6, p.acao], [11, hoje]].concat(p.delegarSara ? [[7, 'Sara'], [9, 'A aguardar esclarecimento'], [17, 'Sara']] : p.retomarAndreia?[[7,'Andreia'],[9,'Por tratar'],[17,'']]:[]).forEach(function (v) { agendar(ps, p.linhaExistente, v[0], v[1], p.assunto + ' · atualização (coluna ' + v[0] + ')', p.jaExiste); });
        return;
      }
      const linha = p.reabrir ? p.linhaExistente : livresP[ip++], id = p.reabrir ? p.jaExiste : 'P' + String(++maxId).padStart(4, '0');
      if (p.reabrir) {
        // Mantém a criação, responsável e prioridade; o histórico conserva a resolução anterior.
        [[5, p.evidencia], [6, p.acao]].concat([[7,p.responsavelReabertura||'Andreia']]).concat([[9, p.sara ? 'A aguardar esclarecimento' : 'Por tratar'], [11, hoje], [12, ''], [13, ''], [15, 'Por verificar'], [17, p.sara ? 'Sara' : '']]).forEach(function (v) { agendar(ps, linha, v[0], v[1], p.assunto + ' · reabertura (coluna ' + v[0] + ')', id); });
        reabertas.push(id + ' ' + p.assunto);
      } else {
        const values = [id, a.ref, p.tema, p.assunto, p.evidencia, p.acao, p.sara ? 'Sara' : 'Andreia', 'Normal', p.sara ? 'A aguardar esclarecimento' : 'Por tratar', hoje, hoje, '', '', p.onde, 'Por verificar'];
        values.forEach(function (v, i) { agendar(ps, linha, i + 1, v, p.assunto + ' · coluna ' + (i + 1), id); });
        agendar(ps, linha, 17, p.sara ? 'Sara' : '', p.assunto + ' · aguarda análise', id);
        criadas.push(id + ' ' + p.assunto);
      }
    });
    a.resolvidas.forEach(function (r) {
      [[9, 'Concluído'], [11, hoje], [12, 'Corrigido: confirmado na leitura do site de ' + a.hoje + '.'], [13, hoje], [15, 'Confirmado']].forEach(function (v) { agendar(ps, r.linha, v[0], v[1], r.assunto + ' · confirmação (coluna ' + v[0] + ')', r.id); });
      confirmadas.push(r.id + ' ' + r.assunto);
    });
    const lugares = vagas(hs.sh, hs.linha + 1, historico.length);
    if(lugares.length)carregarLinhas(hs.sh,lugares[0],lugares[lugares.length-1]-lugares[0]+1);
    historico.forEach(function (h, i) {
      const dados = { 'Data da alteração': hoje, 'Referência EGO': a.ref, 'ID da pendência': h.pendencia, 'Autor': 'Andreia', 'Onde foi alterado': h.onde, 'Campo / assunto': h.onde + ' · ' + h.campo, 'Antes': h.antes, 'Depois / alteração realizada': h.depois, 'Motivo / fonte': (a.url || 'Leitura da Clara') + ' · operação ' + idOperacao, 'Resultado da verificação': 'Por verificar' };
      Object.keys(dados).forEach(function (nome) { if (hs.col(nome)) agendar(hs.sh, lugares[i], hs.col(nome), dados[nome], '', '', true); });
    });
    // Leituras e escritas por intervalos, preservando comparação estrita e recuperação.
    medir('preparacao');
    const lotes=lotesGravacaoClara_(plano);
    conferirLotesClara_(lotes,true);
    medir('conferenciaAntes');
    try {
      lotes.forEach(function(l){aplicados.push(l);escreverLoteClara_(l,false);});
      SpreadsheetApp.flush();
      medir('escrita');
      conferirLotesClara_(lotes,false);
      medir('conferenciaDepois');
    } catch(err) {
      let falhou=false;
      aplicados.reverse().forEach(function(l){try{escreverLoteClara_(l,true);}catch(e){falhou=true;}});
      try{SpreadsheetApp.flush();conferirLotesClara_(aplicados,true);}catch(e){falhou=true;}
      throw new Error((falhou?'A gravação falhou e a recuperação ficou incompleta. Confere o histórico de versões do Sheets antes de repetir. ':'A gravação falhou e as células foram repostas. ')+err.message);
    }
    let avisoSeguimento='';
    if(typeof edAplicar_==='function'&&PropertiesService.getDocumentProperties().getProperty('CLARA_SEGUIMENTO_DOCUMENTAL')==='1'){
      try{const patch={},mapa={sim:'Preenchido',sem_dossier:'Falta no eGO + dossier',categoria:'Categoria errada',na:'Não aplicável'};DOCS.forEach(x=>{if(docs&&mapa[docs[x[0]]])patch[x[0]]=mapa[docs[x[0]]];});edAplicar_(edSnapshot_(a.ref),patch,'marcador');}catch(e){avisoSeguimento='A leitura ficou guardada. Falta atualizar o seguimento: '+e.message;}
    }
    return { avisoSeguimento:avisoSeguimento, desempenho: {ms:Date.now()-inicio,fases:tempos,celulas:plano.length,intervalos:lotes.length}, ref: a.ref, escritos: a.campos.filter(function (x) { return String(x.atual) !== String(x.novo); }).length, textos: a.textos.length, historico: historico.length, criadas: criadas, reabertas: reabertas, confirmadas: confirmadas };
  } finally { lock.releaseLock(); }
}

/* ---------- apresentação de datas (sem alterar fórmulas) ---------- */
function planoDatas_(ss) {
  const plano = [];
  ss.getSheets().forEach(function (sh) {
    if (!sh.getLastColumn() || !sh.getLastRow()) return;
    const linhas = sh.getRange(1, 1, Math.min(12, sh.getLastRow()), sh.getLastColumn()).getDisplayValues();
    const usadas = {};
    linhas.forEach(function (r, i) { r.forEach(function (nome, j) {
      // Apenas títulos de colunas Data..., não períodos nem datas dentro de notas.
      if (!(/^(?:data(?:\s|$)|última atualização$)/i.test(String(nome).trim())) || String(nome).length > 90 || usadas[j]) return;
      usadas[j] = true; plano.push({ sh: sh, titulo: String(nome), linha: i + 1, coluna: j + 1 });
    }); });
  });
  return plano;
}
function dataTexto_(valor, tz) {
  const txt = String(valor || '').trim(); let iso = '';
  let m = /^(\d{4}-\d{2}-\d{2})(?:[ T]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?)?$/.exec(txt);
  if (m) iso = m[1];
  else { m = /^(\d{2})\/(\d{2})\/(\d{4})(?:\s+\d{2}:\d{2}(?::\d{2})?)?$/.exec(txt); if (m) iso = m[3] + '-' + m[2] + '-' + m[1]; }
  if (!iso) return null;
  try { const d = Utilities.parseDate(iso, tz, 'yyyy-MM-dd'); return Utilities.formatDate(d, tz, 'yyyy-MM-dd') === iso ? d : null; } catch (e) { return null; }
}
function auditarDatasDoRegisto() {
  const ss = SpreadsheetApp.getActive(), tz = ss.getSpreadsheetTimeZone();
  const resultado = planoDatas_(ss).map(function (p) {
    const n = p.sh.getLastRow() - p.linha;
    if (!n) return { folha: p.sh.getName(), coluna: p.coluna, titulo: p.titulo, preenchidas: 0 };
    const rg = p.sh.getRange(p.linha + 1, p.coluna, n, 1), valores = rg.getValues(), formulas = rg.getFormulas();
    const r = { folha: p.sh.getName(), coluna: p.coluna, titulo: p.titulo, preenchidas: 0, datas: 0, textoConvertivel: 0, formulas: 0, outros: 0 };
    valores.forEach(function (v, i) { if (v[0] === '') return; r.preenchidas++; if (formulas[i][0]) r.formulas++; else if (v[0] instanceof Date || typeof v[0] === 'number') r.datas++; else if (dataTexto_(v[0], tz)) r.textoConvertivel++; else r.outros++; });
    return r;
  });
  console.log(JSON.stringify(resultado)); return resultado;
}
function aplicarDatasSemHoras() {
  const lock = LockService.getDocumentLock();
  if (!lock.tryLock(30000)) throw new Error('Há outra operação da Clara em curso. Tenta novamente.');
  try {
    const ss = SpreadsheetApp.getActive(), tz = ss.getSpreadsheetTimeZone(), resultado = [];
    planoDatas_(ss).forEach(function (p) {
      const r = { folha: p.sh.getName(), coluna: p.coluna, titulo: p.titulo, convertidas: 0, porRever: 0 };
      try {
        const n = p.sh.getLastRow() - p.linha;
        if (n > 0) {
          const rg = p.sh.getRange(p.linha + 1, p.coluna, n, 1), values = rg.getValues(), formulas = rg.getFormulas();
          values.forEach(function (v, i) {
            if (formulas[i][0] || v[0] === '' || v[0] instanceof Date || typeof v[0] === 'number') return;
            const date = dataTexto_(v[0], tz);
            if (!date) { r.porRever++; return; }
            const cel = p.sh.getRange(p.linha + 1 + i, p.coluna);
            if (cel.getFormula() || cel.getValue() !== v[0]) throw new Error('O valor mudou entretanto; repetir a verificação.');
            cel.setValue(date); r.convertidas++;
          });
        }
        // Abrange as linhas livres para os próximos registos nesta coluna.
        p.sh.getRange(p.linha + 1, p.coluna, p.sh.getMaxRows() - p.linha, 1).setNumberFormat('yyyy-mm-dd');
        SpreadsheetApp.flush(); r.aplicado = true;
      } catch (e) { r.aplicado = false; r.erro = e.message; }
      resultado.push(r);
    });
    console.log(JSON.stringify(resultado)); return resultado;
  } finally { lock.releaseLock(); }
}
