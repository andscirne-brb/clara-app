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
function gestaoPendencia_(r,coluna,anterior){
  let responsavel=String(r[6]||''),estado=String(r[8]||'');
  const fechada=estado==='Concluído'||estado==='Não aplicável';
  if(!fechada){
    if(coluna===7&&responsavel==='Sara')estado='A aguardar esclarecimento';
    else if(coluna===7&&responsavel==='Andreia'&&estado==='A aguardar esclarecimento')estado='Por tratar';
    else if(coluna===9&&anterior==='A aguardar esclarecimento'&&estado!=='A aguardar esclarecimento'&&responsavel==='Sara')responsavel='Andreia';
    if(estado==='A aguardar esclarecimento')responsavel='Sara';
  }
  return{responsavel:responsavel,estado:estado,aguarda:!fechada&&responsavel==='Sara'?'Sara':''};
}
function responsavelPendencia_(r){return gestaoPendencia_(r,0).responsavel;}
function sincronizarGestaoPendencias_(ss,inicio,n,coluna,anterior){
  const sh=ss.getSheetByName(PEND.nome),hs=estrutura_(ss,'Registo de alterações',['Data da alteração','Referência EGO','Autor','Onde foi alterado','Campo / assunto','Antes','Depois / alteração realizada','Motivo / fonte','Resultado da verificação']);
  const linhas=sh.getRange(inicio,1,n,17).getValues(),plano=[],historico=[],hoje=dataHoje_();
  function agendar(sheet,row,col,novo){const cel=sheet.getRange(row,col),antes=cel.getValue();if(mesmoValor_(antes,novo))return;if(cel.getFormula())throw Error('Há uma fórmula na célula de gestão.');plano.push({sh:sheet,linha:row,col:col,cel:cel,antes:antes,depois:novo,antesFormato:cel.getNumberFormat()});}
  function nota(r,campo,antes,depois){historico.push({ref:r[1],id:r[0],campo:campo,antes:String(antes||''),depois:String(depois||'')});}
  linhas.forEach(function(r,i){if(!r[0]||!r[1])return;const row=inicio+i,g=gestaoPendencia_(r,coluna,anterior),changes=[[7,g.responsavel,'Responsável'],[9,g.estado,'Estado'],[17,g.aguarda,'Aguarda análise de']];let mudou=false;
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
function onEdit(e){
  if(!e||!e.range)return;const r=e.range,sh=r.getSheet();if(sh.getName()!==PEND.nome||r.getLastRow()<6)return;
  const first=r.getColumn(),last=r.getLastColumn();if(!(first<=7&&last>=7)&&!(first<=9&&last>=9))return;
  const lock=LockService.getDocumentLock();if(!lock.tryLock(5000)){e.source.toast('Há uma gravação em curso. Confirma depois o responsável e o estado.','Clara',8);return;}
  try{const inicio=Math.max(6,r.getRow()),col=r.getNumRows()===1&&r.getNumColumns()===1?first:0;sincronizarGestaoPendencias_(e.source,inicio,r.getLastRow()-inicio+1,col,e.oldValue);}catch(err){console.error('Gestão de pendências: '+err.message);e.source.toast('Não foi possível sincronizar a pendência. Confirma o responsável e o estado.','Clara',10);}finally{lock.releaseLock();}
}
function onOpen() {
  SpreadsheetApp.getUi().createMenu('Clara')
    .addItem('Progresso', 'abrirLista')
    .addItem('eGO: estado', 'abrirPainel')
    .addItem('Idealista: estatísticas', 'colarLeituraIdealista')
    .addItem('Idealista: ranking dos anúncios', 'conferirPaginasIdealista')
    .addItem('Rightmove: estatísticas', 'abrirRightmove')
    .addItem('Resumo semanal', 'abrirResumo')
    .addItem('Instalar o marcador', 'mostrarMarcador')
    .addToUi();
  try {const ss=SpreadsheetApp.getActive(),d=ss.getSheetByName('Dashboard');if(d&&d.getRange('A2').getValue()==='Resultados dos portais')atualizarDashboardSeNecessario();} catch(e){console.warn('Dashboard: '+e.message);}
}

function abrirPainel() {
  SpreadsheetApp.getUi().showSidebar(HtmlService.createHtmlOutput(PAINEL_HTML.replace('__CLARA_DOCUMENTO__',SpreadsheetApp.getActive().getId())).setTitle('Clara'));
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
  SpreadsheetApp.getUi().showSidebar(HtmlService.createHtmlOutput(RESUMO_HTML).setTitle('Clara · resumo semanal'));
}
function dataDe_(txt) { const s = String(txt || ''); let m = /^(\d{4})-(\d{2})-(\d{2})(?:$|[ T])/.exec(s); if (m) return new Date(+m[1], +m[2] - 1, +m[3]); m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(s); return m ? new Date(+m[3], +m[2] - 1, +m[1]) : null; }
function resumoSemanal(dias) {
  dias = dias || 7;
  const ss = SpreadsheetApp.getActive(), tz = ss.getSpreadsheetTimeZone();
  const hoje = dataDe_(Utilities.formatDate(new Date(), tz, 'dd/MM/yyyy'));
  const de = new Date(hoje.getTime() - (dias - 1) * 86400000);
  const dentro = function (t) { const d = dataDe_(t); return d && d >= de && d <= hoje; };
  const fmt = function (d) { return Utilities.formatDate(d, tz, 'dd/MM/yyyy'); };
  const por = {};
  const im = function (ref) { return por[ref] = por[ref] || { ref: ref, trabalho: [], pendente: [] }; };
  // Verificações feitas na Clara
  const lev = ss.getSheetByName(LEV.nome); const c = colunas_(lev, LEV.titulos);
  const iRef = c.col('Referência EGO') - 1, iData = c.col('Data da verificação') - 1;
  lev.getRange(LEV.titulos + 1, 1, lev.getLastRow() - LEV.titulos, c.titulos.length).getDisplayValues().forEach(function (r) {
    if (r[iRef] && iData >= 0 && dentro(r[iData])) im(r[iRef]).trabalho.push((r[c.col('Estado da verificação') - 1] === 'Verificado' ? 'Anúncio verificado (' : 'Leitura parcial, por concluir (') + r[iData] + ').');
  });
  // Pendências
  let corrigidas = 0, novas = 0, aSara = 0;
  ss.getSheetByName(PEND.nome).getRange(PEND.titulos + 1, 1, Math.max(1, ss.getSheetByName(PEND.nome).getLastRow() - PEND.titulos), 17).getDisplayValues().forEach(function (r) {
    if (!r[1]) return;
    const fechada = r[8] === 'Concluído' || r[8] === 'Não aplicável';
    if (r[8] === 'Concluído' && r[14] === 'Confirmado' && dentro(r[12])) { im(r[1]).trabalho.push((r[8] === 'Concluído' ? 'Corrigido: ' : 'Não aplicável: ') + r[3] + '.'); corrigidas++; }
    else if (!fechada && responsavelPendencia_(r) === 'Sara') { im(r[1]).pendente.push(r[3] + (r[5] ? ' ' + r[5] : '')); aSara++; }
    else if (!fechada && responsavelPendencia_(r) === 'Andreia' && dentro(r[9])) { im(r[1]).trabalho.push('Identificado, a tratar: ' + r[3] + '.'); novas++; }
  });
  // Registo de alterações
  const rg = ss.getSheetByName('Registo de alterações');
  const alterados={};
  if (rg && rg.getLastRow() > 5) rg.getRange(6, 1, rg.getLastRow() - 5, 12).getDisplayValues().forEach(function (r) {
    if(!r[1]||!dentro(r[0]))return;
    const grupo=alterados[r[1]]||(alterados[r[1]]={campos:{},idiomas:{},pendencias:false});
    const partes=String(r[5]||'').split(' · '),onde=partes[0];
    if(onde==='Textos por idioma'&&IDIOMAS[partes[1]])grupo.idiomas[partes[1]]=true;
    else if(onde===PEND.nome||r[4]===PEND.nome)grupo.pendencias=true;
    else if(onde===LEV.nome&&partes[1])grupo.campos[partes.slice(1).join(' · ')]=true;
    else if(r[5])grupo.campos[String(r[5])]=true;
  });
  Object.keys(alterados).forEach(function(ref){const g=alterados[ref],dest=im(ref).trabalho,campos=Object.keys(g.campos),idiomas=Object.keys(g.idiomas);
    if(campos.length)dest.push('Registadas alterações no levantamento: '+campos.join(', ')+'.');
    if(idiomas.length)dest.push('Registados textos por idioma: '+idiomas.join(', ')+'.');
    if(g.pendencias)dest.push('Atualizado o acompanhamento das pendências.');
  });
  const linhas = Object.keys(por).map(function (k) { return por[k]; }).sort(function (a, b) { return b.pendente.length - a.pendente.length || a.ref.localeCompare(b.ref); });
  return { de: fmt(de), ate: fmt(hoje), linhas: linhas, corrigidas: corrigidas, novas: novas, aSara: aSara };
}
function htmlResumo_(r) {
  const fimResumo = String(r.ate || '').split('/').reverse().join('-');
  const pedidoLeadsEstaSemana = fimResumo >= '2026-10-19' && fimResumo <= '2026-10-25';
  const e = function (s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;'); };
  const td = 'border:1px solid #d7dde0;padding:8px;vertical-align:top;text-align:left';
  const cel = function (a, vazio) { return a.length ? a.map(function (x) { return '<div>' + e(x) + '</div>'; }).join('') : '<span style="color:#6b7b80">' + vazio + '</span>'; };
  return '<div style="font-family:Arial,sans-serif;font-size:14px;color:#24383f">' +
    '<p>Olá Sara,</p>' + (r.links ? '<p>Para consulta: <a href="'+e(r.links.documento)+'">dashboard e detalhes do documento</a> · <a href="'+e(r.links.sara)+'">pendências para a Sara'+(r.links.filtrada?' (vista filtrada)':'')+'</a>.</p>' : '') + '<p>Ponto de situação dos anúncios de ' + r.de + ' a ' + r.ate + ': ' + r.corrigidas + ' correções confirmadas, ' + r.novas + ' novos pontos a tratar por mim e ' + r.aSara + ' questões que precisam da tua análise (última coluna).</p>' +
    '<h3>Trabalho realizado e assuntos em acompanhamento</h3><table style="border-collapse:collapse;width:100%"><thead><tr>' + ['Imóvel', 'Trabalho realizado / verificação', 'Para a tua análise'].map(function (h) { return '<th style="' + td + ';background:#edf1f2">' + h + '</th>'; }).join('') + '</tr></thead><tbody>' +
    r.linhas.map(function (l) { return '<tr><th scope="row" style="' + td + '">' + e(l.ref) + '</th><td style="' + td + '">' + cel(l.trabalho, 'Sem trabalho neste período.') + '</td><td style="' + td + '">' + cel(l.pendente, 'Nada pendente.') + '</td></tr>'; }).join('') +
    '</tbody></table><h3>Seguimento previsto para a próxima semana</h3>' + ((r.proximosPassos||[]).length ? '<ul>'+r.proximosPassos.map(x=>'<li>'+e(x)+'</li>').join('')+'</ul>' : '<p>Planeamento por preencher antes de enviar.</p>') +
    (pedidoLeadsEstaSemana ? '<p><strong>Relatórios de leads do eGO</strong><br>Para preparar um relatório de progressão baseado em dados reais, preciso de acesso a relatórios com o número de leads por dia e a respetiva origem no eGO. Neste momento não consigo consultar esta informação no eGO. Podes ajudar-me a obter acesso a estes relatórios na plataforma? Preciso apenas das contagens diárias por origem, sem informação individual de cada lead. Depois de ter acesso, consigo consultar os relatórios autonomamente de quinze em quinze dias.</p>' : '') + '<p>Obrigada,<br>Andreia</p></div>';
}
function previewResumo(dias,plano) {
  const r=resumoSemanal(dias),ss=SpreadsheetApp.getActive(),base=ss.getUrl(),dashboard=ss.getSheetByName('Dashboard'),pend=ss.getSheetByName(PEND.nome),vista=PropertiesService.getScriptProperties().getProperty('CLARA_VISTA_SARA_FVID')||'';
  r.links={documento:base+(dashboard?'#gid='+dashboard.getSheetId():''),sara:base+(pend?'#gid='+pend.getSheetId():'')+(/^\d+$/.test(vista)?'&fvid='+vista:''),filtrada:/^\d+$/.test(vista)};
  r.proximosPassos=String(plano||'').split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
  if(r.proximosPassos.join('\n').length>10000)throw Error('O plano é demasiado extenso. Resume os próximos passos.');
  r.html=htmlResumo_(r);r.assunto='Anúncios: ponto de situação de '+r.de+' a '+r.ate;return r;
}

function irPara(separador, linha) {
  const sh = SpreadsheetApp.getActive().getSheetByName(separador);
  sh.activate(); sh.setActiveRange(sh.getRange(linha, 1, 1, Math.min(sh.getLastColumn(), 6)));
}

function mostrarMarcador() {
  const codigo = 'javascript:' + encodeURIComponent(MARCADOR_JS);
  const html = '<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.5">' +
    '<p><b>1.</b> Arrasta este botão para a barra de marcadores do navegador:</p>' +
    '<p style="text-align:center"><a href="' + codigo + '" style="display:inline-block;padding:8px 18px;background:#1a73e8;color:#fff;border-radius:6px;text-decoration:none;font-weight:bold">Clara</a></p>' +
    '<p>Se não der para arrastar: cria um marcador novo, chama-lhe <b>Clara</b> e cola isto no endereço:</p>' +
    '<label for="codigoMarcador">Código para o endereço do marcador</label><textarea id="codigoMarcador" style="width:100%;height:72px;font-size:11px" onclick="this.select()">' + codigo.replace(/&/g, '&amp;').replace(/</g, '&lt;') + '</textarea>' +
    '<button style="background:#087f8c;color:white;border:0;border-radius:6px;padding:9px 14px" onclick="var t=document.getElementById(&quot;codigoMarcador&quot;),e=document.getElementById(&quot;estadoCopia&quot;);t.focus();t.select();if(navigator.clipboard&amp;&amp;navigator.clipboard.writeText){navigator.clipboard.writeText(t.value).then(function(){e.textContent=&quot;Código copiado. Substitui o endereço do marcador Clara que já tens.&quot;;},function(){t.focus();t.select();e.textContent=&quot;Código selecionado. Copia com Ctrl+C.&quot;;});}else{e.textContent=&quot;Código selecionado. Copia com Ctrl+C.&quot;;}">Copiar código</button><p id="estadoCopia" role="status" style="font-size:12px;color:#526b78">Atualiza o marcador existente para usar a recolha guiada.</p>' +
    '<p><b>2.</b> No site da Janela ou no Idealista com sessão iniciada, carrega no marcador <b>Clara</b>. Para atualizar um marcador antigo, substitui o seu endereço por este.</p>' +
    '<p><b>3.</b> Para o Idealista: <b>Clara &gt; Idealista: estatísticas</b>, cola (Ctrl+V), revê e guarda. Para imóveis do site da Janela: <b>Clara &gt; eGO: estado</b>.</p></div>';
  SpreadsheetApp.getUi().showModalDialog(HtmlService.createHtmlOutput(html).setWidth(520).setHeight(540), 'Instalar o marcador Clara');
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
  if(texto.indexOf('CLARA3:')===0)return analisarRightmove(texto);
  if(texto.indexOf('CLARA2:')===0)return analisarIdealista(texto);
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
    pend.push({ tema: tema, assunto: assunto, evidencia: evidencia, acao: acao, onde: ondeCorrigir || 'eGO', sara: !!sara });
  };
  const hoje = Utilities.formatDate(new Date(), 'Europe/Lisbon', 'dd/MM/yyyy');
  const fonte = ' (site público, ' + hoje + ')';

  // Fotografias
  if (d.fotos != null) {
    prop('Imagens', d.fotos > 0 ? 'Preenchido' : 'Em falta', d.fotos + ' fotografias');
    if (c.col('N.º de imagens')) prop('N.º de imagens', d.fotos, '');
    if (d.fotos === 0) nova('Imagens', 'Imóvel sem fotografias', 'O site não mostra fotografias' + fonte + '.', 'Carregar fotografias no eGO.');
  }
  if (!d.parcial && d.fotosComAlt != null && d.fotos > 0) {
    const ok = d.fotosComAlt === d.fotos;
    prop('Alt-text', ok ? 'Preenchido' : 'Em falta', d.fotosComAlt + ' de ' + d.fotos + ' com texto alternativo');
    if (!ok) nova('Imagens', 'Fotografias sem texto alternativo', 'No site, ' + (d.fotos - d.fotosComAlt) + ' de ' + d.fotos + ' fotografias sem texto alternativo; ' + d.fotosComLegenda + ' com legenda' + fonte + '.', 'Preencher o texto alternativo e a legenda das fotografias no eGO.');
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
  if (!d.parcial && d.caracteristicas != null) prop('Características', d.caracteristicas > 0 ? 'Preenchido' : 'Em falta', d.caracteristicas + ' características assinaladas');
  const cruzamento=cruzarCaracteristicasClara_(d);
  if(c.col('Campos de características em falta')){
    if(cruzamento.avaliadas)prop('Campos de características em falta',cruzamento.sugestoes.length?'Sugestões por confirmar: '+cruzamento.sugestoes.map(function(x){return x.nome;}).join(', '):'Sem divergências nos itens avaliados','Comparação da descrição PT com os itens assinalados; requer revisão.');
    else preservar('Campos de características em falta','Não foi possível cruzar descrição e nomes das características.');
  }
  if (d.videos != null) {
    prop('Vídeo', d.videos > 0 ? 'Preenchido' : 'Em falta', d.videos + ' vídeos');
    if (d.videos === 0) nova('Vídeo', 'Existe vídeo do imóvel?', 'O site não mostra vídeo' + fonte + '.', 'Esclarecer se existe vídeo e onde está, para a Andreia o carregar no eGO.', 'eGO', true);
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
    else if (v === 'na') prop(x[1], 'Não aplicável', 'não se aplica a este imóvel');
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
  if (emFalta.length) nova('Documentos', 'Documentos obrigatórios sem ficheiro no eGO', 'Na ficha do eGO sem ficheiro: ' + emFalta.join(', ') + ' (' + hoje + ').' + (semDossier.length ? ' Confirmado também em falta no dossier: ' + semDossier.join(', ') + '.' : ''), (verificarDossier.length ? 'Verificar no dossier do escritório e carregar no eGO: ' + verificarDossier.join(', ') + '. ' : '') + (semDossier.length ? 'Aguardar análise da Sara: ' + semDossier.join(', ') + '.' : 'Se não estiverem no dossier, pedir esclarecimento à Sara.'), 'eGO', semDossier.length > 0);
  if (noutra.length) nova('Documentos', 'Documentos na categoria errada no eGO', 'Na ficha do eGO, carregados noutra categoria: ' + noutra.join(', ') + ' (' + hoje + ').', 'Mover cada ficheiro para a categoria certa no bloco Documentos do eGO.');
  // A folha calcula o estado global a partir de vazios/Por verificar.
  // Uma falha de leitura não substitui um estado conhecido por desconhecido.
  const desconhecido = function (coluna) { preservar(coluna, 'Este bloco não foi verificado nesta leitura.'); };
  if (d.fotos == null) desconhecido('Imagens');
  if (d.fotosComAlt == null || d.parcial) desconhecido('Alt-text');
  if (d.caracteristicas == null || d.parcial) desconhecido('Características');
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
  if (d.parcial) notas.push('Leitura parcial: o site não devolveu todos os dados; texto alternativo e características não foram verificados.');

  // Assuntos que esta leitura consegue verificar (para confirmar correções)
  const verificaveis = {};
  const pode = function (a) { verificaveis[a] = true; };
  if (d.fotos != null) pode('Imóvel sem fotografias');
  if (!d.parcial && d.fotosComAlt != null) pode('Fotografias sem texto alternativo');
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
    const key = r[1].toUpperCase() + '|' + r[3];
    const registro = { id: r[0], linha: PEND.titulos + 1 + i, estado: r[8], aguarda: r[16], responsavel: r[6], evidencia: r[4], acao: r[5] };
    if (!existentes[key] || existentes[key].estado === 'Concluído') existentes[key] = registro;
    const aberta = r[8] !== 'Concluído' && r[8] !== 'Não aplicável';
    if (aberta && verificaveis[r[3]] && !detetados[r[3]]) resolvidas.push({ id: r[0], assunto: r[3], linha: PEND.titulos + 1 + i });
  });
  pend.forEach(function (p) {
    const ex = existentes[ref + '|' + p.assunto];
    p.jaExiste = ex ? ex.id : ''; p.linhaExistente = ex ? ex.linha : 0;
    p.reabrir = !!ex && ex.estado === 'Concluído';
    p.atualizar = !!ex && ex.estado !== 'Concluído' && ex.estado !== 'Não aplicável' && (p.tema === 'Documentos' ? todosVistos : !!verificaveis[p.assunto]) && (ex.evidencia !== p.evidencia || ex.acao !== p.acao || (p.sara && (ex.aguarda !== 'Sara' || ex.responsavel !== 'Sara')));
    p.retomarAndreia = !!ex && p.tema==='Documentos' && todosVistos && !p.sara && ex.estado==='A aguardar esclarecimento' && ex.responsavel==='Sara';
    if(p.retomarAndreia)p.atualizar=true;
    p.responsavelReabertura=p.sara?'Sara':ex&&ex.responsavel==='Sara'?'Andreia':ex?ex.responsavel:'Andreia';
    p.delegarSara = !!ex && ex.estado !== 'Concluído' && ex.estado !== 'Não aplicável' && p.sara;
    if (p.delegarSara && !todosVistos) {
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
  if(String(texto||'').trim().indexOf('CLARA3:')===0)return gravarRightmove(texto);
  if(String(texto||'').trim().indexOf('CLARA2:')===0)return gravarIdealista(texto);
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
    return { desempenho: {ms:Date.now()-inicio,fases:tempos,celulas:plano.length,intervalos:lotes.length}, ref: a.ref, escritos: a.campos.filter(function (x) { return String(x.atual) !== String(x.novo); }).length, textos: a.textos.length, historico: historico.length, criadas: criadas, reabertas: reabertas, confirmadas: confirmadas };
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

const RM_LEADS_HEADERS=['Data da recolha','Início do período','Fim do período','Dia','Chamadas','Emails','Total','ID da recolha','Ligação'];
const RM_PERF_HEADERS=['Data da recolha','Dados atualizados até','Janela (dias)','ID Rightmove','Referência do portal','Localidade','Preço','Fotografias','Plantas','Dias desde atualização','Visitas diárias médias','Comparação período anterior','Comparação agência','Média da agência','ID da recolha','Ligação'];
function abrirRightmove(){const html=PAINEL_HTML.replace('__CLARA_DOCUMENTO__',SpreadsheetApp.getActive().getId()).replace('id="titulo">eGO: estado','id="titulo">Rightmove: estatísticas').replace('<fieldset id="blocoDocs">','<fieldset id="blocoDocs" hidden>');SpreadsheetApp.getUi().showSidebar(HtmlService.createHtmlOutput(html).setTitle('Clara'));}
function validarLeituraRightmove_(texto){
 if(typeof texto!=='string'||texto.length>2000000||!texto.trim().startsWith('CLARA3:'))throw Error('Leitura Rightmove inválida.');const x=JSON.parse(texto.trim().slice(7)),iso=s=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&Number.isFinite(Date.parse(s+'T00:00:00Z'))&&new Date(s+'T00:00:00Z').toISOString().slice(0,10)===s,num=(n,inteiro=false)=>typeof n==='number'&&Number.isFinite(n)&&n>=0&&(!inteiro||Number.isInteger(n)),txt=(s,n=200)=>typeof s==='string'&&s.length<=n;
 if(x.v!==3||x.origem!=='rightmove'||!iso(String(x.lido||'').slice(0,10)))throw Error('Origem ou data inválida.');const lido=x.lido.slice(0,10);
 if(x.tipo==='leads'){
 if(x.url!=='https://rmplusportal.rightmove.co.uk/customer-reports/lead-reports/summary'||!x.periodo||!iso(x.periodo.inicio)||!iso(x.periodo.fim)||x.periodo.inicio>x.periodo.fim||!Array.isArray(x.diarios)||!x.diarios.length||x.diarios.length>1097)throw Error('Período ou série de leads inválida.');
 const n=(Date.parse(x.periodo.fim)-Date.parse(x.periodo.inicio))/86400000+1;if(n!==x.diarios.length)throw Error('Faltam dias na série de leads.');let chamadas=0,emails=0;
 const diarios=x.diarios.map((d,i)=>{const data=new Date(Date.parse(x.periodo.inicio)+i*86400000).toISOString().slice(0,10);if(d.data!==data||!num(d.chamadas,true)||!num(d.emails,true))throw Error('Dia em falta, repetido ou contagem inválida.');chamadas+=d.chamadas;emails+=d.emails;return{data,chamadas:d.chamadas,emails:d.emails};});if(!x.totais||x.totais.chamadas!==chamadas||x.totais.emails!==emails||x.totais.total!==chamadas+emails)throw Error('As somas diárias não correspondem aos totais.');return{tipo:'leads',lido,url:x.url,periodo:{inicio:x.periodo.inicio,fim:x.periodo.fim},totais:{total:chamadas+emails,chamadas,emails},diarios};
 }
 if(x.tipo!=='performance'||x.url!=='https://admin.rightmove.co.uk/manage/branch/overseas/reports/property-performance-report'||![30,60,90].includes(x.janela)||!iso(x.atualizado)||!num(x.total,true)||!x.total||!Array.isArray(x.registos)||x.total!==x.registos.length||x.total>10000||!num(x.mediaAgencia))throw Error('Relatório de desempenho incompleto ou inválido.');const ids=new Set(),registos=x.registos.map(r=>{if(!/^\d+$/.test(r.id)||ids.has(r.id)||!txt(r.ref)||!/^\d+_[\w-]+$/.test(r.ref)||!txt(r.local)||!num(r.preco)||!num(r.fotografias,true)||!num(r.plantas,true)||!num(r.media)||r.diasAtualizacao!==null&&!num(r.diasAtualizacao,true)||!txt(r.anterior)||!txt(r.vsAgencia))throw Error('Anúncio inválido ou repetido.');ids.add(r.id);return{id:r.id,ref:r.ref,local:r.local,preco:r.preco,fotografias:r.fotografias,plantas:r.plantas,diasAtualizacao:r.diasAtualizacao,media:r.media,anterior:r.anterior,vsAgencia:r.vsAgencia};}).sort((a,b)=>a.id.localeCompare(b.id));return{tipo:'performance',lido,url:x.url,janela:x.janela,atualizado:x.atualizado,total:x.total,mediaAgencia:x.mediaAgencia,registos};
}
function prepararRightmove_(texto,ss){
 const d=validarLeituraRightmove_(texto),nome=d.tipo==='leads'?'Rightmove - leads diárias':'Rightmove - desempenho',headers=d.tipo==='leads'?RM_LEADS_HEADERS:RM_PERF_HEADERS,hashcol=d.tipo==='leads'?8:15;
 const assinatura=Object.assign({},d);delete assinatura.lido;const hash=Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,JSON.stringify(assinatura),Utilities.Charset.UTF_8).map(x=>('0'+(x&255).toString(16)).slice(-2)).join('');const sh=ss.getSheetByName(nome);if(sh&&sh.getRange(1,1,1,headers.length).getDisplayValues()[0].join('|')!==headers.join('|'))throw Error('Estrutura Rightmove alterada. Não gravei.');
 const existentes=sh&&sh.getLastRow()>1?sh.getRange(2,1,sh.getLastRow()-1,headers.length).getValues():[],mesmo=existentes.filter(r=>r[hashcol-1]===hash);const linhas=d.tipo==='leads'?d.diarios.map(r=>[d.lido,d.periodo.inicio,d.periodo.fim,r.data,r.chamadas,r.emails,r.chamadas+r.emails,hash,d.url]):d.registos.map(r=>[d.lido,d.atualizado,d.janela,r.id,r.ref,r.local,r.preco,r.fotografias,r.plantas,r.diasAtualizacao===null?'':r.diasAtualizacao,r.media,r.anterior,r.vsAgencia,d.mediaAgencia,hash,d.url]);if(mesmo.length&&(mesmo.length!==linhas.length||JSON.stringify(mesmo.map(r=>r.slice(1)))!==JSON.stringify(linhas.map(r=>r.slice(1)))))throw Error('Existe uma recolha incompleta. Confere o histórico antes de repetir.');return{d,nome,headers,hash,linhas,duplicada:mesmo.length===linhas.length};
}
function analisarRightmove(texto){const p=prepararRightmove_(texto,SpreadsheetApp.getActive()),d=p.d;return{origem:'rightmove',tipo:d.tipo,quantidade:p.linhas.length,duplicada:p.duplicada,periodo:d.periodo||{inicio:d.atualizado,fim:d.atualizado},janela:d.janela||null,totais:d.totais||null,media:d.tipo==='performance'?d.registos.reduce((s,r)=>s+r.media,0)/d.total:null,destino:p.nome};}
function gravarRightmove(texto){const lock=LockService.getDocumentLock();if(!lock.tryLock(30000))throw Error('Outra gravação em curso.');let resposta;try{resposta=gravarRightmoveDados_(texto,SpreadsheetApp.getActive());}finally{lock.releaseLock();}if(!resposta.duplicada)try{atualizarDashboardSeNecessario();}catch(e){resposta.cobertura+=' Dados guardados; atualização do dashboard pendente: '+e.message;}return resposta;}
function gravarRightmoveDados_(texto,ss){
 const p=prepararRightmove_(texto,ss);if(p.duplicada)return{origem:'rightmove',duplicada:true,escritos:0,quantidade:p.linhas.length};let sh=ss.getSheetByName(p.nome);if(!sh){sh=ss.insertSheet(p.nome);sh.getRange(1,1,1,p.headers.length).setValues([p.headers]).setBackground('#183746').setFontColor('#ffffff').setFontWeight('bold');sh.setFrozenRows(1);sh.setColumnWidths(1,p.headers.length,145);}
 const inicio=sh.getLastRow()+1,n=p.linhas.length,w=p.headers.length;if(sh.getMaxRows()<inicio+n-1)sh.insertRowsAfter(sh.getMaxRows(),inicio+n-1-sh.getMaxRows());const seguro=p.linhas.map(r=>r.map(v=>typeof v==='string'?"'"+v:v));
 try{sh.getRange(inicio,1,n,w).setValues(seguro);SpreadsheetApp.flush();const lido=sh.getRange(inicio,1,n,w).getValues();if(JSON.stringify(lido)!==JSON.stringify(p.linhas)||sh.getRange(inicio,1,n,w).getFormulas().some(r=>r.some(Boolean)))throw Error('Conferência da gravação Rightmove falhou.');}catch(e){sh.getRange(inicio,1,n,w).clearContent();SpreadsheetApp.flush();throw e;}
 return{origem:'rightmove',escritos:n,quantidade:n,duplicada:false,cobertura:p.d.tipo==='leads'?'Série diária conferida com os totais.':'Carteira completa para a janela de '+p.d.janela+' dias.'};
}
function serieLeadsRightmoveDiarias_(linhas){
 const lotes={};linhas.forEach((r,i)=>{if(!r[7])return;const b=lotes[r[7]]||(lotes[r[7]]={inicio:String(r[1]),fim:String(r[2]),ultima:i,diarios:[]});b.ultima=i;b.diarios.push({data:String(r[3]),chamadas:r[4],emails:r[5],total:r[6]});});const completos=Object.values(lotes).filter(b=>b.diarios.length===(Date.parse(b.fim)-Date.parse(b.inicio))/86400000+1&&new Set(b.diarios.map(r=>r.data)).size===b.diarios.length);completos.sort((a,b)=>b.fim.localeCompare(a.fim)||b.ultima-a.ultima);return completos[0]||null;
}
function anunciosPerformanceRightmove_(linhas,anteriores){
 const lotes={};linhas.filter(r=>r[2]===30).forEach((r,i)=>{const b=lotes[r[14]]||(lotes[r[14]]={data:String(r[1]),ultima:i,rows:[]});b.ultima=i;b.rows.push(r);});const lot=Object.values(lotes).sort((a,b)=>b.data.localeCompare(a.data)||b.ultima-a.ultima)[0];if(!lot)return anteriores;const mapa={};anteriores.forEach(r=>mapa[String(r[2])]=r);return lot.rows.map(r=>{const a=(mapa[String(r[3])]||Array(22).fill('')).slice();a[0]=r[1];a[2]=r[3];a[3]=r[5];a[4]=r[6];a[5]=r[7];a[6]=r[8];a[7]='Disponível';a[10]='https://www.rightmove.co.uk/properties/'+r[3];a[12]=r[4];a[17]=r[10];a[20]=r[11];return a;});
}

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
    const resumoBase=a.tipo+' · '+a.quantidade+' registos · '+a.indicadores+' indicadores\n'+periodo+'\n'+a.cobertura+'\nFiltros: '+(a.filtros||[]).join(' · ')+'\n\nGuardar no histórico Idealista - recolhas?';
    const resumo=a.tipo==='geral'?resumoEstatisticasIdealista_(a):resumoBase;
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
  if(d.paginacao){['pagina','porPagina','totalAtivos'].forEach(function(k){const n=d.paginacao[k];if(n!==null&&(!Number.isInteger(n)||n<1||n>100000))throw new Error('Paginação inválida.');});}
  validarContactosDiariosIdealista_(d);
  return d;
}
function prepararIdealista_(texto, ss) {
  const d=lerIdealista_(texto), sh=ss.getSheetByName('Idealista - recolhas');
  if(sh && sh.getRange(1,1,1,13).getDisplayValues()[0].join('|')!==IDEALISTA_CABECALHOS.join('|'))throw new Error('A estrutura das recolhas Idealista mudou. Não gravei.');
  const assinatura=JSON.stringify({data:String(d.lido||'').slice(0,10),tipo:d.tipo,url:d.url,periodo:d.periodo,filtros:d.filtros,registos:d.registos,cobertura:d.cobertura,paginacao:d.paginacao,diarios:d.diarios});
  const hash=Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,assinatura).map(function(b){return('0'+(b&255).toString(16)).slice(-2);}).join('');
  const mapa={},existentes=ss.getSheetByName('Idealista - recolhas');
  if(existentes&&existentes.getLastRow()>1)existentes.getRange(2,6,existentes.getLastRow()-1,2).getDisplayValues().forEach(function(r){if(r[1]&&r[0]){if(mapa[r[1]]&&mapa[r[1]]!==r[0])mapa[r[1]]='';else mapa[r[1]]=r[0];}});
  let duplicada=false;if(sh&&sh.getLastRow()>1)duplicada=sh.getRange(2,11,sh.getLastRow()-1,1).getDisplayValues().some(function(r){return r[0]===hash;});
  const linhas=[],observacao=d.tipo==='zona'?'Comparativo da zona; não associar automaticamente à carteira. '+(d.periodo.etiqueta||'')+(!d.periodo.inicio?'; datas exatas não indicadas na página.':''):'';
  d.registos.forEach(function(r){const ref=r.ref||(d.tipo==='ranking'?mapa[r.id]||'':'');const campos=Object.assign({},r.metricas);['publicacao','rendimento','aviso','posicao'].forEach(function(k){if(r[k]!==undefined&&r[k]!==null&&r[k]!=='')campos[k]=r[k];});Object.keys(campos).forEach(function(k){if(campos[k]===null)return;linhas.push([dataTexto_(String(d.lido).slice(0,10),ss.getSpreadsheetTimeZone()),d.tipo,d.periodo.inicio||'',d.periodo.fim||'',JSON.stringify(d.filtros||[]),ref,r.id||'',k,campos[k],d.cobertura||'Página atual',hash,d.url,observacao]);});});
  if(d.diarios)d.diarios.forEach(function(r){['contactos','mensagens','chamadas'].forEach(function(k){linhas.push([dataTexto_(String(d.lido).slice(0,10),ss.getSpreadsheetTimeZone()),'contactos_diarios',d.periodo.inicio,d.periodo.fim,JSON.stringify(d.filtros), '',r.data,k,r[k], 'Série diária completa; somas conferidas com os totais',hash,d.url,'Pontos vetoriais do gráfico de contactos']);});});
  if(d.tipo==='lista'&&d.paginacao)linhas.forEach(function(r){r[12]='PAGINACAO:'+JSON.stringify(d.paginacao);});
  if(!linhas.length)throw new Error('Não há indicadores para registar.');
  return {d:d,linhas:linhas,hash:hash,duplicada:duplicada};
}
function analisarIdealista(texto) {
  const p=prepararIdealista_(texto,SpreadsheetApp.getActive());
  return {origem:'idealista',tipo:p.d.tipo,periodo:p.d.periodo,cobertura:p.d.cobertura,filtros:p.d.filtros,quantidade:p.d.registos.length,indicadores:p.linhas.length,duplicada:p.duplicada,amostra:p.d.registos.slice(0,5),dias:p.d.diarios?p.d.diarios.length:0,avisoSerie:p.d.avisoSerie||'',estatisticas:p.d.tipo==='geral'?estatisticasIdealista_(p.d.registos[0].metricas):null};
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
    let aviso='';if(p.d.tipo==='geral')try{atualizarDashboardIdealista_(ss);atualizarGraficoContactosIdealista_(ss);}catch(e){aviso=' A recolha ficou guardada, mas o Dashboard não foi atualizado: '+e.message;}
    return{origem:'idealista',duplicada:false,escritos:n,quantidade:p.d.registos.length,cobertura:p.d.cobertura+(aviso||'')};
  } finally {lock.releaseLock();}
}

// Resumo calculado sem alterar ou apagar o histórico.
function resumoPaginasIdealista_(linhas) {
  const listas=linhas.filter(function(r){return r[1]==='lista';});
  if(!listas.length)return 'Ainda não há páginas da lista guardadas.';
  const dia=listas.map(function(r){return String(r[0]);}).sort().pop(), lotes={};
  listas.filter(function(r){return String(r[0])===dia;}).forEach(function(r){
    let b=lotes[r[10]];
    if(!b){const u=String(r[11]),p=/[?&]CurrentPage=(\d+)/.exec(u),n=/[?&]ItemsPerPage=(\d+)/.exec(u);let meta={};try{if(String(r[12]).startsWith('PAGINACAO:'))meta=JSON.parse(String(r[12]).slice(10));}catch(e){}
      b=lotes[r[10]]={pagina:meta.pagina||(p?Number(p[1]):null),porPagina:meta.porPagina||(n?Number(n[1]):null),total:meta.totalAtivos||null,filtros:String(r[4]),ordem:(/[?&]OrderedBy=([^&]*)/.exec(u)||[])[1]+' '+(/[?&]OrderedType=([^&]*)/.exec(u)||[])[1],ids:new Set()};}
    if(r[6])b.ids.add(String(r[6]));
  });
  const lot=Object.values(lotes),paginas={},ids=new Set(),filtros=new Set(),ordens=new Set(),totais=new Set(),tamanhos=new Set();
  let semPagina=0;
  lot.forEach(function(b){filtros.add(b.filtros);ordens.add(b.ordem);if(b.total)totais.add(b.total);if(b.porPagina)tamanhos.add(b.porPagina);b.ids.forEach(function(id){ids.add(id);});if(b.pagina)(paginas[b.pagina]||(paginas[b.pagina]=[])).push(b);else semPagina++;});
  const nums=Object.keys(paginas).map(Number).sort(function(a,b){return a-b;}),total=totais.size===1?Array.from(totais)[0]:null,tamanho=tamanhos.size===1?Array.from(tamanhos)[0]:null;
  const esperadas=total&&tamanho?Math.ceil(total/tamanho):null,max=esperadas||Math.max.apply(null,nums.concat([0])),faltam=[];
  for(let i=1;i<=max;i++)if(!paginas[i])faltam.push(i);
  const repetidas=nums.filter(function(n){return paginas[n].length>1;}),alteradas=repetidas.filter(function(n){return new Set(paginas[n].map(function(b){return Array.from(b.ids).sort().join(',');})).size>1;});
  const ultimos=nums.map(function(n){return paginas[n][paginas[n].length-1];}),vistos=new Set();let sobrepostos=0;
  ultimos.forEach(function(b){b.ids.forEach(function(id){if(vistos.has(id))sobrepostos++;vistos.add(id);});});
  const avisos=[];
  if(filtros.size>1)avisos.push('Filtros diferentes entre recolhas; conferir se a seleção mudou.');
  if(ordens.size>1)avisos.push('Ordenações diferentes entre recolhas.');
  if(totais.size>1)avisos.push('O total de ativos mudou durante a recolha.');
  if(semPagina)avisos.push('Há recolhas sem número de página.');
  if(alteradas.length)avisos.push('Conteúdo diferente na mesma página: '+alteradas.join(', ')+'.');
  if(sobrepostos)avisos.push('Há '+sobrepostos+' imóveis repetidos entre páginas; a lista pode ter mudado.');
  if(!total)avisos.push('O marcador anterior não guardou o total de ativos; não permite confirmar a última página esperada.');
  const completa=!!esperadas&&!faltam.length&&nums.length===esperadas&&vistos.size===total&&!avisos.length&&lot.every(function(b){return b.total===total&&b.ids.size===(b.pagina===esperadas?total-tamanho*(esperadas-1):tamanho);});
  return 'Data: '+dia+'\n'+(completa?'Recolha completa confirmada':'Recolha por confirmar')+'\nPáginas guardadas: '+nums.join(', ')+'\nPáginas em falta: '+(faltam.length?faltam.join(', '):esperadas?'nenhuma':'nenhuma até à maior página guardada')+'\nImóveis únicos: '+ids.size+(total?' / '+total+' ativos na carteira':'')+'\nPáginas recolhidas mais de uma vez: '+(repetidas.join(', ')||'nenhuma')+'\n\n'+avisos.join('\n')+'\n\nAs repetições não aumentam o total de imóveis únicos. O controlo usa apenas as recolhas desta data; mantém os mesmos filtros e ordenação.';
}
function conferirPaginasIdealista(){
  const ss=SpreadsheetApp.getActive(),sh=ss.getSheetByName('Idealista - recolhas');
  const linhas=sh&&sh.getLastRow()>1?sh.getRange(2,1,sh.getLastRow()-1,13).getDisplayValues():[];
  SpreadsheetApp.getUi().alert('Clara · Páginas Idealista',resumoPaginasIdealista_(linhas),SpreadsheetApp.getUi().ButtonSet.OK);
}

function estatisticasIdealista_(m){
  const campos=[['impactos','Impactos'],['visitasTotais','Visitas totais'],['visitasListas','Visitas nas listas'],['visitasDetalhes','Visitas nos detalhes'],['agenciaOnline','Visitas à agência online'],['acoes','Ações nos anúncios'],['alertas','Envios em alertas'],['favoritos','Favoritos'],['partilhas','Envios a amigos'],['contactos','Contactos recebidos'],['clientes','Contactos de clientes'],['mensagens','Emails e mensagens'],['chamadas','Chamadas'],['angariacao','Contactos de angariação'],['anunciosAtivosHoje','Anúncios ativos no momento da leitura']];
  return campos.map(function(c){return{nome:c[1],valor:m[c[0]]===undefined||m[c[0]]===null?null:m[c[0]]};});
}
function resumoEstatisticasIdealista_(a){
  const formato=function(v){return v===null?'Não recolhido':String(v).replace(/\B(?=(\d{3})+(?!\d))/g,' ');};
  return 'Estatísticas da carteira\nPeríodo: '+a.periodo.inicio+' a '+a.periodo.fim+'\nFiltros: '+(a.filtros||[]).join(' · ')+'\n\n'+a.estatisticas.map(function(x){return x.nome+': '+formato(x.valor);}).join('\n')+'\n\n'+(a.dias?'Gráfico diário: '+a.dias+' dias completos.':'Gráfico diário não recolhido. '+(a.avisoSerie||'Atualiza o marcador e volta a recolher.'))+'\nTotais da carteira no período. Os anúncios ativos são o valor atual. Os últimos 2 dias podem sofrer ajustes.\nGuardar no histórico Idealista - recolhas?';
}

// Bloco independente: não soma períodos sobrepostos nem altera os filtros existentes.
function dadosDashboardIdealista_(linhas,tz){
  const data=function(v){return v instanceof Date?Utilities.formatDate(v,tz||'Europe/Lisbon','yyyy-MM-dd'):String(v);};
  const lotes={};
  linhas.forEach(function(r,i){if(r[1]!=='geral'||!r[10])return;const id=String(r[10]);let b=lotes[id];if(!b)b=lotes[id]={inicio:data(r[2]),fim:data(r[3]),filtros:String(r[4]),data:r[0],ultima:i,metricas:{}};b.ultima=i;if(typeof r[8]==='number'&&Number.isFinite(r[8]))b.metricas[String(r[7])]=r[8];});
  const periodos={};Object.values(lotes).forEach(function(b){const key=JSON.stringify([b.inicio,b.fim,b.filtros]);if(!periodos[key]||periodos[key].ultima<b.ultima)periodos[key]=b;});
  return Object.values(periodos).sort(function(a,b){return b.ultima-a.ultima;}).slice(0,4);
}
function atualizarDashboardIdealista(){const ss=SpreadsheetApp.getActive(),r=atualizarDashboardIdealista_(ss),g=atualizarGraficoContactosIdealista_(ss);console.log(JSON.stringify({dashboard:r,grafico:g}));return r;}
function atualizarDashboardIdealista_(ss){
  if(ss.getSheetByName('Dashboard')&&ss.getSheetByName('Dashboard').getRange('A2').getValue()==='Resultados dos portais')return atualizarDashboardVisual_(ss);
  const sh=ss.getSheetByName('Dashboard'),origem=ss.getSheetByName('Idealista - recolhas');
  if(!sh||!origem)return;
  const marca='Idealista: estatísticas',ult=sh.getLastRow(),titulos=sh.getRange(1,1,Math.max(1,ult),1).getDisplayValues(),achadas=[];
  titulos.forEach(function(r,i){if(r[0]===marca)achadas.push(i+1);});if(achadas.length>1)throw new Error('Há blocos Idealista repetidos no Dashboard.');
  const inicio=achadas.length?achadas[0]:Math.max(96,ult+3);if(sh.getMaxRows()<inicio+25)sh.insertRowsAfter(sh.getMaxRows(),inicio+25-sh.getMaxRows());
  const rg=sh.getRange(inicio,1,26,5);
  const valores=rg.getValues(),formulas=rg.getFormulas();
  if(valores[0][0]!==marca&&(valores.some(function(r){return r.some(function(v){return v!=='';});})||formulas.some(function(r){return r.some(Boolean);})))throw new Error('O espaço do bloco Idealista está ocupado. Não alterei o Dashboard.');
  const linhas=origem.getLastRow()>1?origem.getRange(2,1,origem.getLastRow()-1,13).getValues():[],periodos=dadosDashboardIdealista_(linhas,ss.getSpreadsheetTimeZone());
  const out=Array.from({length:26},function(){return Array(5).fill('');});
  out[0][0]=marca;
  out[1][0]='Até 4 períodos mais recentes. Cada coluna é independente; não somar períodos sobrepostos.';
  out[2][0]='Período';out[3][0]='Recolhido em';out[4][0]='Filtros';
  const nomes=estatisticasIdealista_({});nomes.forEach(function(x,i){out[i+6][0]=x.nome;});
  periodos.forEach(function(p,j){const c=j+1;out[2][c]=p.inicio+' a '+p.fim;out[3][c]=p.data;let f=[];try{f=JSON.parse(p.filtros);}catch(e){f=[p.filtros];}out[4][c]=f.join(' · ');estatisticasIdealista_(p.metricas).forEach(function(x,i){out[i+6][c]=x.valor===null?'Não recolhido':x.valor;});});
  if(!periodos.length)out[2][1]='Ainda sem recolhas gerais';
  out[22][0]='Contactos recebidos incluem clientes e angariação. Emails/mensagens e chamadas detalham os contactos de clientes.';
  out[23][0]='Anúncios ativos: valor no momento da leitura. Não é a média do período nem o inventário completo do eGO.';
  out[24][0]='Os últimos 2 dias podem sofrer ajustes. O gráfico diário aparece abaixo quando existe uma recolha completa validada.';
  out[25][0]='Histórico: Idealista - recolhas. Uma nova leitura do mesmo período atualiza esta vista e preserva a anterior no histórico.';
  // Só o bloco reservado é atualizado. Valores históricos permanecem intactos.
  rg.setValues(out).setFontWeight('normal').setFontColor('#25373a').setBackground('#ffffff').setFontFamily('Arial').setFontSize(10).setVerticalAlignment('middle').setWrap(true);
  sh.getRange(inicio+0,1,1,5).setBackground('#155c53').setFontColor('#ffffff').setFontWeight('bold');
  sh.getRange(inicio+2,1,3,5).setBackground('#e9f0ee').setFontWeight('bold');
  sh.getRange(inicio+6,2,15,4).setNumberFormat('#,##0');sh.getRange(inicio+3,2,1,4).setNumberFormat('yyyy-mm-dd');
  sh.getRange(inicio+1,1,1,5).mergeAcross();sh.getRange(inicio+22,1,4,5).mergeAcross();
  sh.setRowHeight(inicio+0,28);sh.setRowHeight(inicio+1,34);sh.setRowHeights(inicio+2,3,42);sh.setRowHeights(inicio+6,15,30);sh.setRowHeights(inicio+22,4,34);sh.setRowHeight(inicio+20,54);
  SpreadsheetApp.flush();if(sh.getRange(inicio+0,1).getValue()!==marca)throw new Error('Não foi possível conferir o bloco Idealista.');
  const atalho=sh.getRange(6,1);if(!atalho.getValue()||atalho.getValue()==='Idealista: estatísticas ↓'||atalho.getFormula().indexOf('Idealista: estatísticas')>=0)atalho.setRichTextValue(SpreadsheetApp.newRichTextValue().setText('Idealista: estatísticas ↓').setLinkUrl(ss.getUrl()+'#gid='+sh.getSheetId()+'&range=A'+inicio).build());
  return{periodos:periodos.length,linha:inicio};
}

function validarContactosDiariosIdealista_(d){
 if(d.diarios===undefined)return;
 if(d.tipo!=='geral'||!Array.isArray(d.diarios)||!d.diarios.length||d.diarios.length>3660)throw Error('Série diária inválida.');
 const primeiro=Date.parse(d.periodo.inicio+'T00:00:00Z'),ultimo=Date.parse(d.periodo.fim+'T00:00:00Z'),n=Math.round((ultimo-primeiro)/86400000)+1;
 if(d.diarios.length!==n)throw Error('A série diária não cobre o período completo.');
 const somas={contactos:0,mensagens:0,chamadas:0},m=d.registos[0].metricas;
 d.diarios.forEach(function(r,i){const data=new Date(primeiro+i*86400000).toISOString().slice(0,10);if(r.data!==data)throw Error('Dias repetidos, em falta ou fora de ordem.');Object.keys(somas).forEach(function(k){if(!Number.isSafeInteger(r[k])||r[k]<0)throw Error('Valor diário inválido.');somas[k]+=r[k];});if(r.mensagens+r.chamadas!==r.contactos)throw Error('Mensagens e chamadas não coincidem com os contactos do dia.');});
 Object.keys(somas).forEach(function(k){if(somas[k]!==m[k])throw Error('A soma diária não coincide com o total de '+k+'.');});
}
function dadosGraficoContactosIdealista_(linhas,tz){
 const fmt=function(v){return v instanceof Date?Utilities.formatDate(v,tz,'yyyy-MM-dd'):String(v);},lotes={};
 linhas.forEach(function(r,i){if(r[1]!=='contactos_diarios'||!r[10])return;const id=String(r[10]),b=lotes[id]||(lotes[id]={ultima:i,inicio:fmt(r[2]),fim:fmt(r[3]),filtros:String(r[4]),dias:{}});b.ultima=i;const data=fmt(r[6]);b.dias[data]=b.dias[data]||{data:data};if(['contactos','mensagens','chamadas'].indexOf(r[7])>=0)b.dias[data][r[7]]=r[8];});
 const ordenados=Object.values(lotes).sort(function(a,b){return b.ultima-a.ultima;});
 for(let i=0;i<ordenados.length;i++){const b=ordenados[i];b.diarios=Object.values(b.dias).sort(function(a,b){return a.data.localeCompare(b.data);});const metricas={};b.diarios.forEach(function(r){['contactos','mensagens','chamadas'].forEach(function(k){metricas[k]=(metricas[k]||0)+r[k];});});try{validarContactosDiariosIdealista_({tipo:'geral',periodo:{inicio:b.inicio,fim:b.fim},registos:[{metricas:metricas}],diarios:b.diarios});return b;}catch(e){}}
 return null;
}
function atualizarGraficoContactosIdealista_(ss){
 if(ss.getSheetByName('Dashboard')&&ss.getSheetByName('Dashboard').getRange('A2').getValue()==='Resultados dos portais')return;
 const fonte=ss.getSheetByName('Idealista - recolhas'),dash=ss.getSheetByName('Dashboard');if(!fonte||!dash||fonte.getLastRow()<2)return;
 const d=dadosGraficoContactosIdealista_(fonte.getRange(2,1,fonte.getLastRow()-1,13).getValues(),ss.getSpreadsheetTimeZone());if(!d)return;
 const titulo='Idealista: contactos diários',charts=dash.getCharts().filter(function(c){return String(c.getOptions().get('title')||'').indexOf(titulo)===0;});if(charts.length>1)throw Error('Há gráficos de contactos Idealista repetidos.');
 const headers=['Data','Contactos','Emails e mensagens','Chamadas'];let view=ss.getSheetByName('Clara - contactos Idealista');if(!view){view=ss.insertSheet('Clara - contactos Idealista');view.getRange(1,1,1,4).setValues([headers]);view.hideSheet();}
 if(view.getRange(1,1,1,4).getDisplayValues()[0].join('|')!==headers.join('|'))throw Error('A estrutura da vista diária mudou.');
 const linhas=[headers].concat(d.diarios.map(function(r){return[Utilities.parseDate(r.data,ss.getSpreadsheetTimeZone(),'yyyy-MM-dd'),r.contactos,r.mensagens,r.chamadas];}));
 if(view.getMaxRows()<linhas.length)view.insertRowsAfter(view.getMaxRows(),linhas.length-view.getMaxRows());
 view.getRange(1,1,Math.max(view.getLastRow(),linhas.length),4).clearContent();view.getRange(1,1,linhas.length,4).setValues(linhas);view.getRange(2,1,d.diarios.length,1).setNumberFormat('dd/MM');
 const nome=titulo+' · '+d.inicio+' a '+d.fim;let builder=charts.length?charts[0].modify().clearRanges():dash.newChart();
 builder=builder.setChartType(Charts.ChartType.COMBO).addRange(view.getRange(1,1,linhas.length,4)).setNumHeaders(1).setHiddenDimensionStrategy(Charts.ChartHiddenDimensionStrategy.SHOW_BOTH).setPosition(124,1,0,0).setOption('title',nome).setOption('width',980).setOption('height',430).setOption('legend',{position:'bottom'}).setOption('seriesType','bars').setOption('series',{0:{type:'line',color:'#ff598d',lineWidth:2},1:{type:'bars',color:'#98ae00'},2:{type:'bars',color:'#a773ff'}}).setOption('hAxis',{title:'Dia',format:'dd/MM',showTextEvery:Math.max(1,Math.ceil(d.diarios.length/15)),slantedText:true,slantedTextAngle:45}).setOption('vAxis',{title:'Contactos',minValue:0,format:'0'}).setOption('focusTarget','category');
 if(charts.length)dash.updateChart(builder.build());else dash.insertChart(builder.build());SpreadsheetApp.flush();return{dias:d.diarios.length,inicio:d.inicio,fim:d.fim};
}

/** Dashboard de consulta: resultados primeiro; origens e histórico preservados. */
function periodo30Dashboard_(linhas,tz){
 const lotes={};const iso=v=>v instanceof Date?Utilities.formatDate(v,tz,'yyyy-MM-dd'):String(v);
 linhas.forEach((r,i)=>{if(r[1]!=='geral'||!r[10])return;const id=String(r[10]),b=lotes[id]||(lotes[id]={inicio:iso(r[2]),fim:iso(r[3]),filtros:String(r[4]),recolha:iso(r[0]),ultima:i,metricas:{}});b.ultima=i;if(typeof r[8]==='number')b.metricas[r[7]]=r[8];});
 return Object.values(lotes).filter(b=>Math.round((Date.parse(b.fim)-Date.parse(b.inicio))/86400000)+1===30).sort((a,b)=>b.fim.localeCompare(a.fim)||b.ultima-a.ultima)[0]||null;
}
function leadsMensaisRightmove_(linhas,tz){
 const iso=v=>v instanceof Date?Utilities.formatDate(v,tz,'yyyy-MM-dd'):String(v||''),meses={};
 linhas.forEach((r,i)=>{if(String(r[3]).toLowerCase()!=='rightmove')return;const a=iso(r[0]),b=iso(r[1]),k=a.slice(0,7),n=[r[4],r[10],r[11]];
   if(!/^\d{4}-\d{2}-01$/.test(a)||b.slice(0,7)!==k||b<a||n.some(x=>typeof x!=='number'||!Number.isInteger(x)||x<0)||n[0]!==n[1]+n[2])return;
   const m={inicio:a,fim:b,total:n[0],chamadas:n[1],emails:n[2],recolha:iso(r[8]),ordem:i},old=meses[k];if(!old||b>old.fim||b===old.fim&&(m.recolha>old.recolha||m.recolha===old.recolha&&i>old.ordem))meses[k]=m;
 });
 return Object.keys(meses).sort().map(k=>{const m=meses[k],day=Number(m.fim.slice(-2)),last=new Date(Date.UTC(Number(k.slice(0,4)),Number(k.slice(5,7)),0)).getUTCDate();m.parcial=day<last;m.mes=k;return m;});
}
/** A assinatura inclui valores, não apenas contagens: alterações manuais também invalidam a vista. */
function assinaturaDashboard_(ss){
 const fontes=[['Idealista - recolhas',2,13],['Leads por período',6,12],['Rightmove - anúncios',6,22],['Levantamento',9,100],['Histórico de indicadores',6,11],['Rightmove - histórico',1,22],['Rightmove - leads diárias',2,9],['Rightmove - desempenho',2,16],['Pendências da equipa',5,17]];
 const dados=fontes.map(([nome,inicio,largura])=>{const sh=ss.getSheetByName(nome);return[nome,sh?sh.getSheetId():null,sh&&sh.getLastRow()>=inicio?sh.getRange(inicio,1,sh.getLastRow()-inicio+1,Math.min(largura,sh.getLastColumn())).getValues():[]];});
 const d=ss.getSheetByName('Dashboard'),v=ss.getSheetByName('Clara - dashboard');
 const estado=[d?d.getRange('A2').getValue():null,v?v.getSheetId():null,d?d.getCharts().map(c=>String(c.getOptions().get('title')||'')).sort():[]];
 return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,JSON.stringify(['dashboard-v4',ss.getSpreadsheetTimeZone(),dados,estado]),Utilities.Charset.UTF_8).map(b=>('0'+((b+256)%256).toString(16)).slice(-2)).join('');
}
function atualizarDashboardSeNecessario(){
 const lock=LockService.getDocumentLock();if(!lock.tryLock(1000))return{adiado:true};
 try{
  const ss=SpreadsheetApp.getActive(),props=PropertiesService.getDocumentProperties(),key='clara.dashboard.assinatura.v3',assinatura=assinaturaDashboard_(ss);
  if(props.getProperty(key)===assinatura)return{reutilizado:true};
  // Não marcar como atualizada se os dados mudaram durante a construção.
  const r=atualizarDashboardVisual_(ss);if(r){const depois=assinaturaDashboard_(ss);if(depois===assinatura)props.setProperty(key,depois);else props.deleteProperty(key);}return r;
 }finally{lock.releaseLock();}
}
function atualizarDashboardVisual(){const lock=LockService.getDocumentLock();if(!lock.tryLock(1000))return;try{const r=atualizarDashboardVisual_(SpreadsheetApp.getActive());console.log(JSON.stringify(r));return r;}finally{lock.releaseLock();}}
function prepararDashboardVisual(){
 const ss=SpreadsheetApp.getActive(),s=ss.getSheetByName('Dashboard');if(!s)throw Error('Dashboard não encontrado.');
 if(s.getRange('A2').getValue()!=='Resultados dos portais'){
 const stamp=Utilities.formatDate(new Date(),ss.getSpreadsheetTimeZone(),'yyyyMMdd-HHmmss'),b=s.copyTo(ss);b.setName('Dashboard antes '+stamp);b.hideSheet();
 s.getCharts().forEach(c=>s.removeChart(c));s.getRange(1,1,s.getMaxRows(),s.getMaxColumns()).breakApart();s.clear();s.clearConditionalFormatRules();
 }
 return atualizarDashboardVisual_(ss);
}
function atualizarDashboardVisual_(ss){
 const s=ss.getSheetByName('Dashboard');if(!s)return;
 prepararEspacoProgressao_(ss,s);
 const tz=ss.getSpreadsheetTimeZone(),rows=(name,start,width)=>{const sh=ss.getSheetByName(name);return sh&&sh.getLastRow()>=start?sh.getRange(start,1,sh.getLastRow()-start+1,Math.min(width,sh.getLastColumn())).getValues():[];};
 const raw=rows('Idealista - recolhas',2,13),p=periodo30Dashboard_(raw,tz),allDaily=dadosGraficoContactosIdealista_(raw,tz);
 const rmDaily=serieLeadsRightmoveDiarias_(rows('Rightmove - leads diárias',2,9));
 const leads=rows('Leads por período',6,12),rmLeads=leadsMensaisRightmove_(leads,tz),rmUltimo=rmLeads.length?rmLeads[rmLeads.length-1]:null;
 const green=leads.filter(r=>String(r[3]).toLowerCase()==='green-acres'&&typeof r[4]==='number');
 const iso=v=>v instanceof Date?Utilities.formatDate(v,tz,'yyyy-MM-dd'):String(v||'');green.sort((a,b)=>iso(a[1]).localeCompare(iso(b[1])));
 const lastGreen=green.length?green[green.length-1]:null,rm=anunciosPerformanceRightmove_(rows('Rightmove - desempenho',2,16),rows('Rightmove - anúncios',6,22).filter(r=>r[2])),activeRM=rm.filter(r=>String(r[7]).match(/Disponível|Available/i)),views=rm.filter(r=>typeof r[17]==='number').map(r=>r[17]);
 const bg='#f3f6fa',ink='#183746',muted='#607786',teal='#087f8c',blue='#239bc1',purple='#8170bc';
 s.getRange('A1:L102').setBackground(bg).setFontFamily('Arial').setFontSize(10).setFontColor(ink).setVerticalAlignment('middle').setNumberFormat('General');s.setHiddenGridlines(true);s.setFrozenRows(0);s.setFrozenColumns(0);s.setColumnWidths(1,12,92);s.setRowHeights(1,102,22);s.setRowHeight(1,12);
 function block(row,col,n,height,text,size,color,bold,back){const r=s.getRange(row,col,height,n);r.breakApart();r.merge();r.setValue(text===null?'—':text).setBackground(back||bg).setFontSize(size||10).setFontColor(color||ink).setFontWeight(bold?'bold':'normal').setWrap(true).setHorizontalAlignment('left').setFontLine('none');return r;}
 function section(row,title){block(row,1,12,1,title,13,ink,true);s.setRowHeight(row,32);}
 function card(col,name,value,label,period,detail,footer,color){block(6,col,4,1,name,12,color,true,'#ffffff');block(7,col,4,2,value,32,ink,true,'#ffffff');block(9,col,4,1,label,11,muted,false,'#ffffff');block(10,col,4,2,period,10,muted,false,'#ffffff');block(12,col,4,2,detail,11,ink,true,'#ffffff');block(14,col,4,2,footer,9,muted,false,'#ffffff');}
 block(2,1,12,2,'Resultados dos portais',23,ink,true);block(4,1,12,1,'Dados por portal · consultar as datas de cada fonte antes de comparar',11,muted);
 const fmt=v=>typeof v==='number'?v.toLocaleString('pt-PT'):'Não recolhido';
 card(1,'IDEALISTA',p?fmt(p.metricas.contactos):'Sem dados','contactos recebidos',p?p.inicio+' a '+p.fim+'\n'+(()=>{try{return JSON.parse(p.filtros).join(' · ');}catch(e){return p.filtros;}})():'Falta recolha de 30 dias',p?fmt(p.metricas.visitasDetalhes)+' visitas aos anúncios\n'+fmt(p.metricas.anunciosAtivosHoje)+' anúncios ativos na recolha':'Registar estatísticas no menu Clara',p?'Recolha: '+p.recolha+' · '+fmt(p.metricas.mensagens)+' mensagens / '+fmt(p.metricas.chamadas)+' chamadas':'',teal);
 card(5,'GREEN-ACRES',lastGreen?fmt(lastGreen[4]):'Sem dados','contactos únicos · último dado disponível',lastGreen?iso(lastGreen[0])+' a '+iso(lastGreen[1]):'Sem recolha',lastGreen?'Sem janela de 30 dias recolhida':'Falta relatório de contactos','O gráfico mensal mantém o histórico. Período distinto do Idealista.',blue);
 if(rmDaily)card(9,'RIGHTMOVE',fmt(rmDaily.diarios.reduce((n,x)=>n+x.total,0)),'leads · período recolhido',rmDaily.inicio+' a '+rmDaily.fim,fmt(activeRM.length)+' anúncios · '+(views.length?(views.reduce((a,b)=>a+b,0)/views.length).toFixed(2).replace('.',','):'—')+' visitas/dia/anúncio (30 dias)',rmDaily.diarios.reduce((n,x)=>n+x.chamadas,0)+' chamadas · '+rmDaily.diarios.reduce((n,x)=>n+x.emails,0)+' emails',purple);
 else card(9,'RIGHTMOVE',rmLeads.length?fmt(rmLeads.reduce((n,x)=>n+x.total,0)):'Sem dados','leads · meses registados',rmUltimo?rmLeads[0].inicio+' a '+rmUltimo.fim+(rmUltimo.parcial?' · mês final parcial':''):'Sem relatório de leads',fmt(activeRM.length)+' anúncios · '+(views.length?(views.reduce((a,b)=>a+b,0)/views.length).toFixed(2).replace('.',','):'—')+' visitas/dia/anúncio (30 dias)',rmUltimo?rmLeads.reduce((n,x)=>n+x.chamadas,0)+' chamadas · '+rmLeads.reduce((n,x)=>n+x.emails,0)+' emails. Sem janela de 30 dias de leads.':'Contactos por recolher.',purple);
 [['A6','IDEALISTA','Idealista - recolhas'],['E6','GREEN-ACRES','Leads por período'],['I6','RIGHTMOVE','Rightmove - anúncios']].forEach(a=>{const t=ss.getSheetByName(a[2]);if(t)s.getRange(a[0]).setRichTextValue(SpreadsheetApp.newRichTextValue().setText(a[1]).setLinkUrl(ss.getUrl()+'#gid='+t.getSheetId()).build());});
 s.getRange('A17:L102').breakApart().clearContent();
 section(17,'Evolução das Leads');
 let v=ss.getSheetByName('Clara - dashboard');if(!v){v=ss.insertSheet('Clara - dashboard');v.hideSheet();}v.clearContents();
 const daily=allDaily&&p?allDaily.diarios.filter(r=>r.data>=p.inicio&&r.data<=p.fim):[];
 const dailyOk=p&&daily.length===30&&daily.reduce((a,b)=>a+b.contactos,0)===p.metricas.contactos;
 v.getRange('A1:D1').setValues([['Dia','Contactos','Emails e mensagens','Chamadas']]);if(dailyOk)v.getRange(2,1,daily.length,4).setValues(daily.map(r=>[Utilities.parseDate(r.data,tz,'yyyy-MM-dd'),r.contactos,r.mensagens,r.chamadas]));v.getRange('A2:A32').setNumberFormat('dd/MM');
 v.getRange('F1:G1').setValues([['Mês','Contactos únicos']]);if(green.length)v.getRange(2,6,green.length,2).setValues(green.map(r=>[iso(r[0]).slice(0,7)+(/parcial/i.test(String(r[9]))?' *':''),r[4]]));
 SpreadsheetApp.flush();
 function chart(title,range,row,col,type,opts){const own=s.getCharts().filter(c=>String(c.getOptions().get('title')||'')===title);if(own.length>1)throw Error('Gráfico repetido: '+title);let b=s.newChart();b=b.setChartType(type).addRange(range).setNumHeaders(1).setHiddenDimensionStrategy(Charts.ChartHiddenDimensionStrategy.SHOW_BOTH).setPosition(row,col,0,0).setOption('title',title).setOption('width',col===1&&row===36?1100:364).setOption('height',280).setOption('fontName','Arial').setOption('backgroundColor','#ffffff').setOption('titleTextStyle',{fontSize:12,color:ink,bold:true}).setOption('legend',{position:'bottom',textStyle:{fontSize:9}});Object.keys(opts||{}).forEach(k=>b.setOption(k,opts[k]));s.insertChart(b.build());if(own.length)s.removeChart(own[0]);}
 block(19,1,4,12,dailyOk?'':'Falta uma série diária completa para estes 30 dias.',11,muted,false,'#ffffff');block(19,5,4,12,green.length?'':'Falta histórico de contactos.',11,muted,false,'#ffffff');block(19,9,4,12,rmDaily||rmLeads.length?'':'Falta histórico Rightmove.',11,muted,false,'#ffffff');
 if(dailyOk)chart('Idealista · contactos nos 30 dias',v.getRange(1,1,31,4),19,1,Charts.ChartType.COMBO,{seriesType:'bars',series:{0:{type:'line',color:teal,lineWidth:2},1:{color:'#87cbd9'},2:{color:purple}},hAxis:{format:'dd/MM',showTextEvery:5},vAxis:{minValue:0,format:'0'}});
 if(green.length)chart('Green-Acres · contactos únicos por mês',v.getRange(1,6,green.length+1,2),19,5,Charts.ChartType.COLUMN,{colors:[blue],legend:{position:'none'},hAxis:{slantedText:true,slantedTextAngle:45},vAxis:{minValue:0,format:'0'}});
 if(rmDaily){v.getRange('P1:R1').setValues([['Dia','Chamadas','Emails']]);v.getRange(2,16,rmDaily.diarios.length,3).setValues(rmDaily.diarios.map(x=>[x.data,x.chamadas,x.emails]));SpreadsheetApp.flush();}else v.getRange('P1:R1').setValues([['Mês','Chamadas','Emails']]);if(!rmDaily&&rmLeads.length)v.getRange(2,16,rmLeads.length,3).setValues(rmLeads.map(x=>[x.mes+(x.parcial?' *':''),x.chamadas,x.emails]));SpreadsheetApp.flush();
 if(!rmDaily)s.getCharts().filter(c=>String(c.getOptions().get('title')||'')==='Rightmove · leads por dia').forEach(c=>s.removeChart(c));
 if(rmDaily){s.getCharts().filter(c=>String(c.getOptions().get('title')||'')==='Rightmove · leads por mês').forEach(c=>s.removeChart(c));chart('Rightmove · leads por dia',v.getRange(1,16,rmDaily.diarios.length+1,3),19,9,Charts.ChartType.COLUMN,{isStacked:true,colors:[teal,'#4678ec'],vAxis:{minValue:0,format:'0'},hAxis:{slantedText:true,slantedTextAngle:30,showTextEvery:Math.max(1,Math.ceil(rmDaily.diarios.length/8))}});}else if(rmLeads.length)chart('Rightmove · leads por mês',v.getRange(1,16,rmLeads.length+1,3),19,9,Charts.ChartType.COLUMN,{isStacked:true,colors:[teal,'#4678ec'],vAxis:{minValue:0,format:'0'},hAxis:{slantedText:true,slantedTextAngle:30}});
 block(32,1,12,1,'Períodos e critérios próprios por portal: Idealista diário; Green-Acres mensal; Rightmove '+(rmDaily?'diário.':'mensal. * Mês parcial.'),9,muted);
 section(34,'eGO · evolução das leads');
 const lc=colunas_(ss.getSheetByName(LEV.nome),LEV.titulos),prior=rows(LEV.nome,10,lc.titulos.length).filter(r=>r[lc.col('Prioridade')-1]==='Prioritária').map(r=>String(r[lc.col('Referência EGO')-1]));
 const ego=serieCompletudeEGO_(rows('Histórico de indicadores',6,11),prior,tz),rmHist=guardarMedicaoRightmove_(ss,rm,tz),right=serieRightmove_(rmHist,rm.map(r=>r[2]),tz);
 v.getRange('J1:K1').setValues([['Data do relatório','Média diária de visitas / anúncio']]);if(right.length)v.getRange(2,10,right.length,2).setValues(right.map(r=>[r.data,r.media]));v.getRange('M1:N1').setValues([['Data da medição','Completude média']]);if(ego.length)v.getRange(2,13,ego.length,2).setValues(ego.map(r=>[r.data,r.media]));v.getRange('N2:N1000').setNumberFormat('0.0%');SpreadsheetApp.flush();
 s.getCharts().filter(c=>['Rightmove · visitas diárias por anúncio (30 dias)','eGO · completude média dos prioritários'].indexOf(String(c.getOptions().get('title')||''))>=0).forEach(c=>s.removeChart(c));
 block(36,1,12,12,'A aguardar dados de leads do eGO.\nO gráfico será apresentado quando existir um relatório com datas e contagens de contactos.',13,muted,false,'#ffffff');
 block(49,1,12,2,'eGO é o sistema principal. O progresso do preenchimento dos imóveis continua nos indicadores de trabalho abaixo.',10,muted);
 section(53,'Progresso do trabalho');
 const f=formulasProgressoDashboard_(ss);
 const indicators=[['Prioritários verificados',f.verificados,teal],['Correções concluídas',f.concluidas,teal],['Pendências abertas',f.abertas,'#bb7543'],['A aguardar Sara',f.sara,purple]];
 indicators.forEach((a,i)=>{const col=i*3+1;block(55,col,3,1,a[0],10,muted,false,'#ffffff');block(56,col,3,2,'',28,a[2],true,'#ffffff').setFormula(a[1]).setNumberFormat('0');block(58,col,3,1,i===0?'de '+prior.length+' imóveis prioritários':'',9,muted,false,'#ffffff');});
 section(61,'Prioridades e pendências da equipa');
 block(63,1,6,2,'Pendências operacionais',12,ink,true,'#ffffff');block(65,1,6,2,'',26,teal,true,'#ffffff').setFormula(f.andreia).setNumberFormat('0');block(67,1,6,2,'Assuntos atribuídos à Andreia. Consultar a lista para saber o que falta fazer.',10,muted,false,'#ffffff');
 block(63,7,6,2,'Imóveis com pendências',12,ink,true,'#ffffff');block(65,7,6,2,'',26,purple,true,'#ffffff').setFormula(f.imoveis).setNumberFormat('0');block(67,7,6,2,'A conclusão de uma recolha não significa que todas as correções estejam concluídas.',10,muted,false,'#ffffff');
 section(71,'Consultar o detalhe');
 [['Levantamento','eGO · estado dos imóveis',1],['Pendências da equipa','Equipa · tarefas e bloqueios',5],['Perfis dos portais','Portais · perfis e pendências',9]].forEach(a=>{const target=ss.getSheetByName(a[0]);if(target)block(73,a[2],4,2,'',11,teal,true,'#e6f0f2').setRichTextValue(SpreadsheetApp.newRichTextValue().setText(a[1]).setLinkUrl(ss.getUrl()+'#gid='+target.getSheetId()).build());});
 block(77,1,12,2,'Datas dos dados: Idealista '+(p?p.fim:'sem recolha')+' · Green-Acres '+(lastGreen?iso(lastGreen[1]):'sem recolha')+' · Rightmove '+(rm.length?iso(rm[0][0]):'sem recolha')+'. Sem dados não significa zero.',10,muted);
 block(80,1,12,1,'Vista atualizada em '+Utilities.formatDate(new Date(),tz,'yyyy-MM-dd HH:mm')+' · atualizar a vista não recolhe novos dados dos portais.',9,muted);
 s.setTabColor(teal);if(!v.isSheetHidden())v.hideSheet();SpreadsheetApp.flush();return{periodo:p?{inicio:p.inicio,fim:p.fim}:null,diarios:dailyOk?30:0,rightmove:rm.length,mediaRightmove:views.length?views.reduce((a,b)=>a+b,0)/views.length:null,graficos:s.getCharts().length,pontosRightmove:right.length,pontosEGO:ego.length,mesesLeadsRightmove:rmLeads.length,totalLeadsRightmove:rmLeads.reduce((n,x)=>n+x.total,0)};
}


function verificarDashboardVisual(){const ss=SpreadsheetApp.getActive(),s=ss.getSheetByName('Dashboard'),v=ss.getSheetByName('Clara - dashboard');console.log(JSON.stringify({cartoes:s.getRange('A55:L58').getDisplayValues(),fontes:v.getRange('A1:G4').getDisplayValues(),progressao:v.getRange('J1:N3').getDisplayValues(),historicoRightmove:Math.max(0,ss.getSheetByName('Rightmove - histórico').getLastRow()-1),graficos:s.getCharts().map(c=>({titulo:c.getOptions().get('title'),ranges:c.getRanges().map(r=>r.getSheet().getName()+'!'+r.getA1Notation())})),erros:s.getRange('A1:L80').getDisplayValues().flat().filter(x=>/^#(ERROR!|REF!|VALUE!|DIV\/0!|NAME\?|N\/A|NUM!)/.test(x))}));}


/** Só compara o mesmo grupo completo; 30/60/90 dias não são datas sucessivas. */
function dataISOProgresso_(v,tz){return v instanceof Date?Utilities.formatDate(v,tz,'yyyy-MM-dd'):String(v||'');}
function serieCompletudeEGO_(linhas,refs,tz){
 const ids=Array.from(new Set(refs.map(String))).sort(),dias={};if(!ids.length)return[];
 linhas.forEach(r=>{if(String(r[2]).toLowerCase()!=='ego'||ids.indexOf(String(r[1]))<0)return;const d=dataISOProgresso_(r[0],tz);let x=r[4];if(typeof x==='string'){if(!x.trim())return;const pct=x.indexOf('%')>=0;x=Number(x.replace('%','').replace(',','.'));if(pct){if(x<0||x>100)return;x/=100;}}else if(typeof x!=='number')return;if(x>1)x/=100;if(!/^\d{4}-\d{2}-\d{2}$/.test(d)||!Number.isFinite(x)||x<0||x>1)return;(dias[d]||(dias[d]={}))[String(r[1])]=x;});
 return Object.keys(dias).sort().filter(d=>ids.every(id=>Object.prototype.hasOwnProperty.call(dias[d],id))).map(d=>({data:d,media:ids.reduce((s,id)=>s+dias[d][id],0)/ids.length,imoveis:ids.length}));
}
function serieRightmove_(linhas,refs,tz){
 const ids=Array.from(new Set(refs.map(String))).sort(),lotes={};if(!ids.length)return[];
 linhas.forEach((r,i)=>{if(!r[1])return;const k=String(r[1]),g=lotes[k]||(lotes[k]={data:dataISOProgresso_(r[0],tz),ultima:i,ids:{}});g.ultima=i;g.ids[String(r[2])]=r[3];});
 const datas={};Object.values(lotes).forEach(g=>{if(JSON.stringify(Object.keys(g.ids).sort())!==JSON.stringify(ids)||!ids.every(id=>typeof g.ids[id]==='number'&&Number.isFinite(g.ids[id])&&g.ids[id]>=0))return;if(!datas[g.data]||datas[g.data].ultima<g.ultima)datas[g.data]=g;});
 return Object.keys(datas).sort().map(d=>({data:d,media:ids.reduce((s,id)=>s+datas[d].ids[id],0)/ids.length,anuncios:ids.length}));
}
function guardarMedicaoRightmove_(ss,rm,tz){
 if(!rm.length)return[];const ids=rm.map(r=>String(r[2]));if(ids.some(x=>!/^\d+$/.test(x))||new Set(ids).size!==ids.length)throw Error('IDs Rightmove repetidos; histórico não alterado.');
 const datas=Array.from(new Set(rm.map(r=>dataISOProgresso_(r[0],tz))));if(datas.length!==1||!/^\d{4}-\d{2}-\d{2}$/.test(datas[0]))throw Error('A recolha Rightmove tem datas incompatíveis.');
 const dados=rm.map(r=>[String(r[2]),typeof r[17]==='number'?r[17]:'',r[5],r[6],String(r[7])]).sort((a,b)=>a[0].localeCompare(b[0]));if(dados.some(r=>typeof r[1]!=='number'||!Number.isFinite(r[1])||r[1]<0))return[];
 const hash=Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,JSON.stringify([datas[0],dados]),Utilities.Charset.UTF_8).map(x=>('0'+((x+256)%256).toString(16)).slice(-2)).join('');
 let sh=ss.getSheetByName('Rightmove - histórico');const headers=['Data do relatório','ID da recolha','ID Rightmove','Média diária (30 dias)','Fotografias','Plantas','Estado','Data do registo'];
 if(!sh){sh=ss.insertSheet('Rightmove - histórico');sh.getRange(1,1,1,8).setValues([headers]).setBackground('#183746').setFontColor('#ffffff').setFontWeight('bold');sh.setFrozenRows(1);sh.setColumnWidths(1,8,145);}
 if(sh.getRange(1,1,1,8).getDisplayValues()[0].join('|')!==headers.join('|'))throw Error('Estrutura do histórico Rightmove alterada.');
 const anterior=sh.getLastRow()>1?sh.getRange(2,1,sh.getLastRow()-1,8).getValues():[];if(anterior.some(r=>r[1]===hash))return anterior;
 const linha=sh.getLastRow()+1,hoje=Utilities.parseDate(Utilities.formatDate(new Date(),tz,'yyyy-MM-dd'),tz,'yyyy-MM-dd'),date=Utilities.parseDate(datas[0],tz,'yyyy-MM-dd'),out=dados.map(r=>[date,hash,r[0],r[1],r[2],r[3],r[4],hoje]);
 if(sh.getMaxRows()<linha+out.length-1)sh.insertRowsAfter(sh.getMaxRows(),linha+out.length-1-sh.getMaxRows());
 try{sh.getRange(linha,1,out.length,8).setValues(out);sh.getRange(linha,1,out.length,1).setNumberFormat('yyyy-mm-dd');sh.getRange(linha,8,out.length,1).setNumberFormat('yyyy-mm-dd');SpreadsheetApp.flush();if(sh.getRange(linha,2,out.length,1).getValues().some(r=>r[0]!==hash))throw Error('Conferência do histórico Rightmove falhou.');}catch(e){sh.getRange(linha,1,out.length,8).clearContent();throw e;}return anterior.concat(out);
}
function prepararEspacoProgressao_(ss,s){
 const prop=PropertiesService.getDocumentProperties(),key='clara.dashboard.progressao.v2';if(prop.getProperty(key)==='1')return;
 const copy=s.copyTo(ss);copy.setName('Dashboard - antes progressão '+Utilities.formatDate(new Date(),ss.getSpreadsheetTimeZone(),'MMdd-HHmmss'));copy.hideSheet();s.getRange('A32:L88').breakApart().clearContent();prop.setProperty(key,'1');
}
function formulasProgressoDashboard_(ss){
 const c=colunas_(ss.getSheetByName(LEV.nome),LEV.titulos),col=n=>{let x=c.col(n),s='';while(x){s=String.fromCharCode(65+(x-1)%26)+s;x=Math.floor((x-1)/26);}return "'Levantamento'!"+s+'10:'+s;};
 const pri=col('Prioridade'),est=col('Estado da verificação'),ids="'Pendências da equipa'!A6:A",status="'Pendências da equipa'!I6:I",owner="'Pendências da equipa'!G6:G",sara="'Pendências da equipa'!Q6:Q",refs="'Pendências da equipa'!B6:B",tema="'Pendências da equipa'!C6:C",open=ids+';"<>";'+status+';"<>Concluído";'+status+';"<>Não aplicável"';
 return{verificados:'=COUNTIFS('+pri+';"Prioritária";'+est+';"Verificado")',total:'=COUNTIF('+pri+';"Prioritária")',concluidas:'=COUNTIFS('+ids+';"<>";'+status+';"Concluído")',abertas:'=COUNTIFS('+open+')',sara:'=COUNTIFS('+open+';'+owner+';"Sara")+COUNTIFS('+open+';'+status+';"A aguardar esclarecimento";'+owner+';"<>Sara")',andreia:'=COUNTIFS('+open+';'+owner+';"Andreia";'+status+';"<>A aguardar esclarecimento")',imoveis:'=IFERROR(ROWS(UNIQUE(FILTER('+refs+';'+ids+'<>"";'+refs+'<>"";'+status+'<>"Concluído";'+status+'<>"Não aplicável";'+tema+'<>"Perfil do portal")));0)'};
}

/* ---------- gerado por scripts/construir-clara.py: não editar à mão ---------- */
const PAINEL_HTML = "<!doctype html>\n<html lang=\"pt\"><head><base target=\"_top\"><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\">\n<style>\n:root{--ink:#183746;--muted:#526b78;--teal:#087f8c;--line:#d9e3e9;--bg:#f3f6fa}*{box-sizing:border-box}body{font:13px/1.45 Arial,sans-serif;color:var(--ink);background:var(--bg);margin:0;padding:14px 12px 105px}h1{font-size:19px;margin:0 0 5px}h2,h3{font-size:14px;margin:0 0 9px}p{margin:7px 0}.muted{color:var(--muted);font-size:12px}.steps{display:flex;gap:5px;margin:13px 0}.step{flex:1;padding:5px 2px;border-bottom:3px solid var(--line);font-size:11px}.step.active{border-color:var(--teal);font-weight:bold}.box,fieldset{background:white;border:1px solid var(--line);border-radius:9px;padding:12px;margin:0 0 12px;min-width:0}label{display:block;font-weight:bold;margin-bottom:6px}textarea{width:100%;min-height:95px;resize:vertical;border:1px solid #91a8b4;border-radius:6px;padding:9px;font:12px/1.4 Arial,sans-serif}textarea:focus,select:focus,button:focus-visible,summary:focus-visible{outline:3px solid #79c5d3;outline-offset:2px}.context{margin-top:8px;padding:8px;border-radius:5px;background:#eaf4f5;font-size:12px;overflow-wrap:anywhere}.doc{padding:8px 0;border-bottom:1px solid #e9eef1}.doc:last-child{border:0}.doc label{font-size:12px;font-weight:normal;margin:0 0 4px}select{width:100%;min-height:34px;border:1px solid #91a8b4;border-radius:5px;background:white;color:var(--ink);padding:5px;font-size:12px}legend{font-weight:bold;font-size:14px;padding:0 3px}summary{cursor:pointer;font-weight:bold;padding:7px 0;font-size:12px}details{margin-bottom:10px}details .muted{padding:4px 0}.status{padding:9px;border-radius:6px;margin:0 0 10px;background:#eaf4f5}.erro{background:#fff0ed;color:#9b2b20;border-left:3px solid #c74a37;padding:10px;margin-bottom:10px;overflow-wrap:anywhere}.success{background:#e8f4ee;border-left:3px solid #248357;padding:12px;border-radius:6px}.summary{display:flex;gap:6px;margin:10px 0}.summary>div{background:white;border:1px solid var(--line);border-radius:6px;flex:1;text-align:center;padding:8px 3px;font-size:11px}.summary b{display:block;font-size:20px}.warning{border-left:3px solid #bd812a;background:#fff5df;padding:9px;margin:9px 0;font-size:12px}.ok{color:#176b47}.falta{color:#a23224;font-weight:bold}.muda{background:#fff8e8}table{width:100%;border-collapse:collapse;font-size:12px}th{text-align:left;color:var(--muted);font-size:11px}th,td{padding:7px 4px;border-bottom:1px solid #e3e9ed;vertical-align:top;overflow-wrap:anywhere}td:first-child{width:44%}.p{border-left:3px solid var(--teal);padding:8px;background:white;margin:7px 0}.p.sara{border-color:#bd812a}button{border:0;border-radius:6px;background:var(--teal);color:white;font:600 13px Arial,sans-serif;padding:10px 12px;cursor:pointer;min-height:38px}button.sec{background:white;color:var(--teal);border:1px solid var(--line)}button:disabled{opacity:.5;cursor:wait}.actions{position:fixed;bottom:0;left:0;right:0;background:white;border-top:1px solid var(--line);padding:10px 12px;z-index:5;display:flex;gap:7px;box-shadow:0 -3px 12px #1837460d}.actions button{flex:1}.actions #guardar{flex:1.6}.link{font-weight:normal;background:none;color:var(--teal);padding:4px 0;min-height:28px;text-decoration:underline} [hidden]{display:none!important}\n</style></head><body>\n<h1 id=\"titulo\">eGO: estado</h1><div class=\"muted\">Recolher, rever e guardar no Sheets. A gravação regista a leitura; não altera os anúncios.</div>\n<nav class=\"steps\" aria-label=\"Etapas\"><span class=\"step active\" id=\"passo1\">1 · Colar</span><span class=\"step\" id=\"passo2\">2 · Rever</span><span class=\"step\" id=\"passo3\">3 · Guardar</span></nav>\n<section class=\"box\"><label for=\"txt\">Leitura copiada pelo marcador Clara</label><div class=\"muted\" style=\"margin-bottom:8px\">Na página do imóvel, do Idealista ou do Rightmove Plus, clica no marcador. Depois cola aqui com Ctrl+V.</div><textarea id=\"txt\" placeholder=\"Cola aqui a leitura da Clara\" spellcheck=\"false\" aria-describedby=\"origem\"></textarea><div id=\"origem\" class=\"context\" aria-live=\"polite\">A aguardar uma leitura.</div><button class=\"link\" id=\"limpar\" onclick=\"novaLeitura()\">Limpar leitura</button></section>\n<fieldset id=\"blocoDocs\"><legend>Documentos na ficha do eGO</legend><details><summary>Como confirmar os documentos</summary><div class=\"muted\">Consulta «Documentos» na ficha do eGO. Se o ficheiro estiver em «Outros documentos», escolhe «Está noutra categoria». Se também não estiver no dossier, escolhe «Não está no eGO nem no dossier»: fica a aguardar análise da Sara. Não confirmes um documento que não viste.</div></details><div id=\"docs\"></div></fieldset>\n<div id=\"rascunho\" class=\"status\" role=\"status\" hidden></div><div id=\"versao\" class=\"warning\" hidden></div>\n<div id=\"estado\" class=\"status\" role=\"status\" aria-live=\"polite\" hidden></div><div id=\"erro\" class=\"erro\" role=\"alert\" hidden></div><div id=\"res\"></div>\n<footer class=\"actions\"><button id=\"analisar\" onclick=\"analisar()\" disabled>Analisar leitura</button><button id=\"guardar\" onclick=\"gravar()\" hidden>Confirmar e guardar</button></footer>\n<script>\nconst DOCS=[['caderneta','Caderneta Predial'],['certificado','Certificado Energético'],['contrato','Contrato de Mediação'],['licenca','Licença de Habitação']];\nconst el=id=>document.getElementById(id);let ocupado=false,preview=null,revisao=0,ultimaOrigem=null,ultimoRegisto=null;\nconst VERSAO_MARCADOR='20261024.3',CHAVE_RASCUNHO='clara.rascunho.v1.__CLARA_DOCUMENTO__';\nfunction guardarRascunho(emGravacao=false){try{const texto=el('txt').value;if(!texto.trim()){localStorage.removeItem(CHAVE_RASCUNHO);el('rascunho').hidden=true;return;}localStorage.setItem(CHAVE_RASCUNHO,JSON.stringify({v:1,texto,docs:docs(),data:Date.now(),emGravacao}));el('rascunho').textContent='Rascunho guardado neste navegador. Será recuperado ao reabrir o painel.';el('rascunho').hidden=false;}catch(e){el('rascunho').textContent='Este navegador não permitiu guardar o rascunho. Mantém uma cópia da leitura antes de fechar.';el('rascunho').hidden=false;}}\nfunction recuperarRascunho(){try{const raw=localStorage.getItem(CHAVE_RASCUNHO);if(!raw)return;const d=JSON.parse(raw);if(d.v!==1||typeof d.texto!=='string'||!Number.isFinite(d.data)||Date.now()-d.data>7*86400000){localStorage.removeItem(CHAVE_RASCUNHO);return;}el('txt').value=d.texto;entrada();const origem=reconhecer(d.texto);if(origem&&!origem.erro&&origem.tipo==='ego')DOCS.forEach(x=>{const valor=d.docs&&d.docs[x[0]];el('d_'+x[0]).value=['sim','categoria','nao','sem_dossier','na',''].includes(valor)?valor:'';});guardarRascunho();el('rascunho').textContent='Rascunho recuperado'+(origem&&!origem.erro?' · '+origem.nome:'')+'. '+(d.emGravacao?'O painel foi fechado durante uma gravação. Confirma primeiro no Levantamento se ficou guardada.':'Volta a analisar antes de guardar.');controles();}catch(e){el('rascunho').textContent='Não foi possível recuperar o rascunho neste navegador.';el('rascunho').hidden=false;}}\nfunction verificarVersao(){let v='';try{v=JSON.parse(el('txt').value.trim().slice(7)).marcadorVersao||'';}catch(e){}el('versao').hidden=!el('txt').value.trim()||v===VERSAO_MARCADOR;el('versao').textContent=v?'Leitura de outra versão do marcador ('+v+'). Se necessário, reinstala em Clara > Instalar o marcador.':'Esta leitura veio de um marcador anterior. Atualiza em Clara > Instalar o marcador para identificar a versão.';}\nfunction esc(s){return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\"/g,'&quot;').replace(/'/g,'&#39;');}\nel('docs').innerHTML=DOCS.map(d=>'<div class=\"doc\"><label for=\"d_'+d[0]+'\">'+d[1]+'</label><select id=\"d_'+d[0]+'\"><option value=\"\">Não verificado</option><option value=\"sim\">Tem ficheiro</option><option value=\"categoria\">Está noutra categoria</option><option value=\"nao\">Em falta no eGO · verificar dossier</option><option value=\"sem_dossier\">Não está no eGO nem no dossier</option><option value=\"na\">Não se aplica</option></select></div>').join('');\nfunction docs(){const d={};DOCS.forEach(x=>d[x[0]]=el('d_'+x[0]).value);return d;}\nfunction limparDocs(){DOCS.forEach(x=>el('d_'+x[0]).value='');}\nfunction reconhecer(texto){const t=texto.trim(),ideal=t.startsWith('CLARA2:'),site=t.startsWith('CLARA1:'),right=t.startsWith('CLARA3:');if(!t)return null;if(!ideal&&!site&&!right)return{erro:'Cola a leitura completa copiada pelo marcador Clara.'};try{const d=JSON.parse(t.slice(7));if(!d||typeof d!=='object'||Array.isArray(d))throw Error();if(site&&!d.ref)return{erro:'A leitura não tem referência do imóvel. Volta a recolher na página do imóvel.'};return{tipo:right?'rightmove':ideal?'idealista':'ego',ref:site?String(d.ref):'',nome:right?'Rightmove · '+(d.tipo==='leads'?'leads':'desempenho dos anúncios'):ideal?'Idealista · '+({geral:'estatísticas da carteira',lista:'lista de anúncios',ranking:'ranking dos anúncios',zona:'top da zona'}[d.tipo]||'recolha'):String(d.ref),parcial:!!d.parcial};}catch(e){return{erro:'O texto parece incompleto. Copia novamente a leitura com o marcador Clara.'};}}\nfunction mensagem(t){el('estado').textContent=t||'';el('estado').hidden=!t;}\nfunction etapa(n){[1,2,3].forEach(i=>el('passo'+i).className='step'+(i===n?' active':''));}\nfunction controles(){const r=reconhecer(el('txt').value);el('txt').disabled=ocupado;DOCS.forEach(x=>el('d_'+x[0]).disabled=ocupado);el('limpar').disabled=ocupado||!el('txt').value.trim();el('analisar').disabled=ocupado||!r||!!r.erro;el('analisar').textContent=preview?'Voltar a analisar':'Analisar leitura';el('analisar').className=preview?'sec':'';el('guardar').hidden=!preview;el('guardar').disabled=ocupado||!preview;el('guardar').textContent=ocupado&&preview?'A guardar…':'Confirmar e guardar';}\nfunction invalidar(t){revisao++;preview=null;el('res').innerHTML='';el('erro').hidden=true;etapa(1);mensagem(t);controles();}\nfunction entrada(){if(ocupado)return;const r=reconhecer(el('txt').value);let mudou=false;if(ultimaOrigem&&(!r||!r.erro&&(ultimaOrigem.tipo!==r.tipo||ultimaOrigem.ref!==r.ref))){limparDocs();mudou=true;}if(r&&!r.erro)ultimaOrigem=r;else if(!el('txt').value.trim())ultimaOrigem=null;el('blocoDocs').hidden=r&&!r.erro?r.tipo!=='ego':false;el('titulo').textContent=r&&!r.erro?(r.tipo==='rightmove'?'Rightmove: estatísticas':r.tipo==='idealista'?'Idealista: estatísticas':'eGO: estado'):'eGO: estado';el('origem').textContent=!r?'A aguardar uma leitura.':r.erro||r.nome+(r.parcial?' · leitura parcial':'');verificarVersao();guardarRascunho();invalidar(mudou&&r&&r.tipo==='ego'?'Novo imóvel: confirma novamente os documentos.':'');}\nel('txt').addEventListener('input',entrada);DOCS.forEach(x=>el('d_'+x[0]).addEventListener('change',()=>{if(!ocupado){guardarRascunho();invalidar('Os documentos mudaram. Volta a analisar antes de guardar.');}}));\nfunction novaLeitura(){if(ocupado)return;el('txt').value='';limparDocs();ultimaOrigem=null;entrada();el('txt').focus();}\nfunction falhou(e){ocupado=false;preview=null;const causa=(e&&e.message)||String(e);el('erro').textContent=/PERMISSION_DENIED|authorization|not authorized/i.test(causa)?'Esta sessão Google não permitiu aceder à folha. Reabre o documento com a conta autorizada. A leitura foi mantida.':causa+' A leitura foi mantida. Revê e volta a analisar antes de guardar.';el('erro').hidden=false;mensagem('');controles();}\nfunction analisar(){if(ocupado)return;const r=reconhecer(el('txt').value);if(!r||r.erro){el('erro').textContent=r?r.erro:'Cola primeiro uma leitura.';el('erro').hidden=false;return;}const pedido={texto:el('txt').value,docs:docs(),revisao:revisao};el('erro').hidden=true;el('res').innerHTML='';preview=null;ocupado=true;mensagem('A analisar a leitura…');controles();google.script.run.withSuccessHandler(a=>{ocupado=false;if(pedido.revisao!==revisao||pedido.texto!==el('txt').value||JSON.stringify(pedido.docs)!==JSON.stringify(docs())){invalidar('A leitura mudou. Volta a analisar antes de guardar.');return;}preview={texto:pedido.texto,docs:pedido.docs,a:a};mostrar(a);}).withFailureHandler(falhou).analisar(pedido.texto,pedido.docs);}\nfunction tabela(campos){return '<table><thead><tr><th>Campo</th><th>Resultado da leitura</th></tr></thead><tbody>'+campos.map(c=>{const m=String(c.atual)!==String(c.novo),cls=/Em falta|Formato errado|Categoria errada/.test(c.novo)?'falta':c.novo==='Preenchido'?'ok':'';return'<tr class=\"'+(m?'muda':'')+'\"><td>'+esc(c.coluna)+'</td><td>'+(m?'<s class=\"muted\">'+esc(c.atual||'vazio')+'</s><br>':'')+'<span class=\"'+cls+'\">'+esc(c.novo)+'</span><div class=\"muted\">'+esc(c.motivo)+'</div></td></tr>';}).join('')+'</tbody></table>';}\nfunction mostrar(a){etapa(2);mensagem('Revê o resumo. O Sheets só é alterado quando confirmares.');let h='';if(a.origem==='rightmove'){el('blocoDocs').hidden=true;h='<section class=\"box\"><h2>Rever recolha Rightmove</h2><p>'+esc(a.tipo==='leads'?'Leads por dia':'Desempenho dos anúncios')+'</p><p>'+(a.tipo==='leads'?esc(a.periodo.inicio)+' a '+esc(a.periodo.fim):'Dados atualizados até '+esc(a.periodo.fim))+'</p><p>'+esc(a.quantidade)+(a.tipo==='leads'?' dias completos':' anúncios · janela de '+esc(a.janela)+' dias')+'</p>'+(a.totais?'<p><b>'+esc(a.totais.total)+' leads</b> · '+esc(a.totais.chamadas)+' chamadas · '+esc(a.totais.emails)+' emails</p>':'<p>'+esc(Number(a.media).toFixed(2))+' visitas diárias médias por anúncio.</p>')+'<p class=\"muted\">Destino: '+esc(a.destino)+'. Histórico preservado; recolhas repetidas não são somadas.</p></section>';if(a.duplicada){h+='<div class=\"success\">Esta recolha já está guardada.</div>';preview=null;mensagem('Podes colar a próxima leitura.');}}else if(a.origem==='idealista'){el('blocoDocs').hidden=true;h='<section class=\"box\"><h2>Rever recolha Idealista</h2><p><b>'+esc(a.quantidade)+' registos · '+esc(a.indicadores)+' indicadores</b></p><p>'+esc(a.periodo.inicio||a.periodo.etiqueta||'Estado atual')+(a.periodo.fim?' a '+esc(a.periodo.fim):'')+'</p><p>'+esc(a.cobertura)+'</p><p class=\"muted\">'+(a.filtros||[]).map(esc).join(' · ')+'</p>';\n if(a.estatisticas)h+='<details open><summary>Indicadores recolhidos</summary><table>'+a.estatisticas.map(x=>'<tr><td>'+esc(x.nome)+'</td><td>'+esc(x.valor===null?'Não recolhido':Number(x.valor).toLocaleString('pt-PT'))+'</td></tr>').join('')+'</table></details><div class=\"muted\">'+(a.dias?'Gráfico diário: '+a.dias+' dias completos.':'Sem gráfico diário. '+esc(a.avisoSerie||'Apenas os totais serão guardados.'))+'</div>';else h+='<p class=\"muted\">Apenas a página recolhida. Consulta as páginas guardadas em «Idealista: ranking dos anúncios».</p>';\n h+='</section>';if(a.duplicada){h+='<div class=\"success\">Esta recolha já está guardada. Não será duplicada.</div>';preview=null;mensagem('Podes colar a próxima leitura.');}else h+='<p class=\"muted\">Destino: Idealista - recolhas. Períodos diferentes não são somados.</p>';\n }else{const mudam=a.campos.filter(c=>String(c.atual)!==String(c.novo)),iguais=a.campos.filter(c=>String(c.atual)===String(c.novo)),novas=a.pendencias.filter(p=>!p.jaExiste),ja=a.pendencias.filter(p=>p.jaExiste&&!p.reabrir),reabertas=a.pendencias.filter(p=>p.reabrir);h='<h2>'+esc(a.ref)+'</h2><div class=\"summary\"><div><b>'+mudam.length+'</b>alterações</div><div><b>'+novas.length+'</b>pendências novas</div><div><b>'+(a.naoVerificados||a.campos.filter(c=>c.novo==='Por verificar')).length+'</b>por verificar</div></div>';\n if(!a.completa)h+='<div class=\"warning\"><b>Leitura parcial.</b> O imóvel fica «Em curso». Os campos não lidos não são reconfirmados. A informação anterior é preservada.</div>';\n if(a.naoVerificados&&a.naoVerificados.length)h+='<details open><summary>Não verificados nesta leitura ('+a.naoVerificados.length+')</summary><div class=\"muted\">'+a.naoVerificados.map(x=>esc(x.coluna)+(x.preservado?' · mantido: '+esc(x.anterior):' · por verificar')).join('<br>')+'</div></details>';\n h+='<details open><summary>Alterações a guardar ('+mudam.length+')</summary>'+tabela(mudam)+'</details>';if(iguais.length)h+='<details><summary>Campos sem alteração ('+iguais.length+')</summary>'+tabela(iguais)+'</details>';\n if(a.cruzamento){const x=a.cruzamento;h+='<details open><summary>Características · '+esc(x.estado)+'</summary><div class=\"muted\">'+(x.avaliadas?'Comparação de '+x.avaliadas+' tipos de características. Sugestões para confirmar no eGO; não prova existência física.':'Faltam nomes das características ou descrição PT nesta leitura. Atualiza o marcador se necessário.')+'</div>'+x.sugestoes.map(y=>'<div class=\"p\"><b>'+esc(y.nome)+' · mencionada mas não assinalada</b><div class=\"muted\">'+esc(y.excerto)+'</div></div>').join('')+(x.assinaladasSemTexto.length?'<div class=\"muted\">Assinaladas sem menção afirmativa detetada na descrição PT: '+x.assinaladasSemTexto.map(esc).join(', ')+'.</div>':'')+'</details>';}\n if(novas.length)h+='<h3>Pendências novas</h3>'+novas.map(p=>'<div class=\"p '+(p.sara?'sara':'')+'\"><b>'+esc(p.assunto)+'</b><div class=\"muted\">'+esc(p.acao)+'</div></div>').join('');\n if(reabertas.length)h+='<div class=\"warning\">Serão reabertas: '+reabertas.map(p=>esc(p.jaExiste+' · '+p.assunto)).join('; ')+'. A resolução anterior fica no histórico.</div>';\n if(a.resolvidas&&a.resolvidas.length)h+='<div class=\"success\">Correções confirmadas: '+a.resolvidas.map(r=>esc(r.id+' · '+r.assunto)).join('; ')+'.</div>';\n if(ja.length)h+='<details><summary>Pendências já registadas ('+ja.length+')</summary><div class=\"muted\">'+ja.map(p=>esc(p.jaExiste+' · '+p.assunto)+(p.atualizar?'<br><strong>Atualizar:</strong> '+esc(p.evidencia):'')).join('<br>')+'</div></details>';\n if(a.notas&&a.notas.length)h+='<details><summary>Notas da leitura</summary><div class=\"muted\">'+a.notas.map(esc).join('<br>')+'</div></details>';h+='<p class=\"muted\">Destino: Levantamento, textos por idioma e histórico de alterações.</p>';\n }el('res').innerHTML=h;controles();}\nfunction gravar(){if(ocupado||!preview)return;if(preview.texto!==el('txt').value||JSON.stringify(preview.docs)!==JSON.stringify(docs())){invalidar('A leitura mudou. Volta a analisar antes de guardar.');return;}const p=preview,inicioGravacao=Date.now();guardarRascunho(true);ocupado=true;etapa(3);mensagem('A guardar no Sheets… Mantém este painel aberto.');el('erro').hidden=true;controles();google.script.run.withSuccessHandler(r=>{ocupado=false;preview=null;ultimoRegisto=['idealista','rightmove'].includes(r.origem)?null:{linha:p.a.linha};el('res').innerHTML='<div class=\"success\"><h2>Guardado no Sheets</h2><p class=\"muted\">Gravação: '+Math.max(1,Math.round((Date.now()-inicioGravacao)/1000))+' s.</p>'+(['idealista','rightmove'].includes(r.origem)?'<p>'+esc(r.duplicada?'Esta recolha já estava guardada.':r.origem==='rightmove'?r.escritos+' linhas registadas.':r.quantidade+' registos · '+r.escritos+' indicadores.')+'</p><p>'+esc(r.cobertura||'')+'</p>':'<p><b>'+esc(r.ref)+'</b> · '+r.escritos+' campos atualizados.</p><p>'+r.textos+' idiomas registados · '+r.historico+' alterações no histórico.</p>')+'</div>'+(ultimoRegisto?'<button class=\"sec\" onclick=\"verRegisto()\">Ver no Levantamento</button>':'');el('txt').value='';limparDocs();ultimaOrigem=null;guardarRascunho();verificarVersao();el('origem').textContent='Leitura guardada. Podes colar a próxima.';mensagem('Concluído. Não precisas de repetir esta gravação.');controles();}).withFailureHandler(falhou).gravar(p.texto,p.docs);}\nfunction verRegisto(){if(ultimoRegisto)google.script.run.irPara('Levantamento',ultimoRegisto.linha);}\nrecuperarRascunho();controles();\n</script></body></html>\n";
const LISTA_HTML = "<!doctype html>\n<html lang=\"pt\"><head><base target=\"_top\"><meta charset=\"utf-8\">\n<style>\nbody{font-family:Arial,sans-serif;font-size:13px;color:#202124;margin:0;padding:12px}\nh3{font-size:14px;margin:16px 0 6px}\n.muted{color:#5f6368;font-size:12px}\n.barra{background:#e8eaed;border-radius:4px;height:8px;margin:4px 0 2px}\n.barra div{background:#188038;height:8px;border-radius:4px}\n.item{border-left:3px solid #1a73e8;background:#f8f9fa;padding:6px 8px;margin:6px 0}\n.item.sara{border-left-color:#f9ab00}\n.item .ref{cursor:pointer;color:#087f8c;background:none;border:0;padding:0;margin:0;min-height:28px;font-weight:bold}input{width:100%;box-sizing:border-box;padding:9px;border:1px solid #91a8b4;border-radius:6px;margin:6px 0 10px}button:focus-visible,input:focus{outline:3px solid #79c5d3;outline-offset:2px}\n.item ul{margin:4px 0 0 16px;padding:0}\na{color:#1a73e8}\nbutton{background:#fff;color:#1a73e8;border:1px solid #dadce0;border-radius:6px;padding:6px 12px;font-size:12px;cursor:pointer;margin-top:8px}\n</style></head>\n<body>\n<label for=\"pesquisa\"><b>Procurar referência ou localidade</b></label><div class=\"muted\">Pesquisa nos imóveis e pendências apresentados neste painel.</div><input id=\"pesquisa\" placeholder=\"Ex.: APT14077 ou Faro\" type=\"search\"><div id=\"filtro\" class=\"muted\" role=\"status\"></div><div id=\"out\" aria-live=\"polite\">A carregar…</div>\n<button onclick=\"carregar()\">Atualizar</button>\n<script>\nfunction esc(s){return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/\"/g,'&quot;').replace(/'/g,'&#39;');}\nfunction ir(sep,l){google.script.run.irPara(sep,l);}\nfunction liga(u){return /^https?:\\/\\//.test(u||'')?' · <a href=\"'+esc(u)+'\" target=\"_blank\">página pública</a>':'';}\nfunction barra(a,b,t){const p=b?Math.round(100*a/b):0;return '<div>'+t+': <b>'+a+' de '+b+'</b></div><div class=\"barra\"><div style=\"width:'+p+'%\"></div></div>';}\nlet dadosLista=null;\nfunction normalizar(s){return String(s||'').normalize('NFD').replace(/[\\u0300-\\u036f]/g,'').toLowerCase();}\nfunction mostrar(orig){\n  dadosLista=orig;const q=normalizar(document.getElementById('pesquisa').value),match=x=>!q||normalizar(JSON.stringify(x)).includes(q),d=Object.assign({},orig);\n  ['prioritarios','minhas','sara','perfis','alta'].forEach(k=>d[k]=(orig[k]||[]).filter(match));\n  document.getElementById('filtro').textContent=q?'Resultados filtrados. Limpa a pesquisa para ver tudo.':'';\n\n  let h='<h3>Progresso</h3>'+barra(d.contagem['Prioritária'][0],d.contagem['Prioritária'][1],'Prioritários verificados')+barra(d.verificados,d.total,'Todos os imóveis verificados');\n  h+='<h3>1. Prioritários por verificar ('+d.prioritarios.length+')</h3>';\n  h+=d.prioritarios.length?d.prioritarios.map(im=>'<div class=\"item\"><button class=\"ref\" onclick=\"ir(\\'Levantamento\\','+im.linha+')\">'+esc(im.ref)+'</button> · '+esc(im.natureza)+' · '+esc(im.concelho)+liga(im.url)+'</div>').join(''):'<div class=\"muted\">'+(q?'Sem correspondência.':'Todos verificados.')+'</div>';\n  h+='<h3>2. As tuas pendências ('+d.minhas.reduce((n,x)=>n+x.pendencias.length,0)+' em '+d.minhas.length+' imóveis)</h3>';\n  h+=d.minhas.length?d.minhas.map(im=>'<div class=\"item\"><button class=\"ref\" onclick=\"ir(\\'Pendências da equipa\\','+im.pendencias[0].linha+')\">'+esc(im.ref)+'</button> '+(im.prioridade==='Prioritária'?'· prioritário':'')+liga(im.url)+'<ul>'+im.pendencias.map(p=>'<li>'+esc(p.assunto)+'<div class=\"muted\">'+esc(p.acao)+'</div></li>').join('')+'</ul></div>').join(''):'<div class=\"muted\">Nenhuma.</div>';\n  h+='<h3>3. À espera da Sara ('+d.sara.length+')</h3>';\n  h+=d.sara.length?d.sara.map(p=>'<div class=\"item sara\"><button class=\"ref\" onclick=\"ir(\\'Pendências da equipa\\','+p.linha+')\">'+esc(p.ref)+'</button> · '+esc(p.assunto)+'</div>').join(''):'<div class=\"muted\">Nenhuma.</div>';\n  h+='<h3>4. Perfis dos portais ('+d.perfis.length+')</h3>';\n  h+=d.perfis.length?d.perfis.map(p=>'<div class=\"item\"><button class=\"ref\" onclick=\"ir(\\''+(p.origem==='Perfis dos portais'?'Perfis dos portais':'Pendências da equipa')+'\\','+p.linha+')\">'+esc(p.portal)+'</button> · '+esc(p.assunto)+(p.url?' · <a href=\"'+esc(p.url)+'\" target=\"_blank\">perfil</a>':'')+'<div class=\"muted\">'+esc(p.estado)+': '+esc(p.acao)+'</div></div>').join(''):'<div class=\"muted\">Nada em aberto.</div>';\n  if(!orig.prioritarios.length&&d.altaTotal)h+='<h3>Depois: prioridade Alta por verificar ('+d.altaTotal+')</h3>'+d.alta.map(im=>'<div class=\"item\"><button class=\"ref\" onclick=\"ir(\\'Levantamento\\','+im.linha+')\">'+esc(im.ref)+'</button> · '+esc(im.natureza)+' · '+esc(im.concelho)+liga(im.url)+'</div>').join('');\n  h+='<p class=\"muted\">Carrega numa referência para ir à linha no Sheet.</p>';\n  document.getElementById('out').innerHTML=h;\n}\nfunction carregar(){document.getElementById('out').textContent='A carregar…';google.script.run.withSuccessHandler(mostrar).withFailureHandler(e=>document.getElementById('out').textContent=/PERMISSION_DENIED|authorization/i.test(e.message||'')?'Esta sessão Google não permitiu aceder à folha. Reabre o documento com a conta autorizada.':e.message).listaTrabalho();}\ndocument.getElementById('pesquisa').addEventListener('input',()=>{if(dadosLista)mostrar(dadosLista);});\ncarregar();\n</script>\n</body></html>\n";
const RESUMO_HTML = "<!doctype html>\n<html><head><base target=\"_top\"><meta charset=\"utf-8\">\n<style>\nbody{font-family:Arial,sans-serif;font-size:13px;color:#202124;margin:0;padding:12px}\nlabel{display:block;font-size:12px;color:#5f6368;margin-top:8px}\nselect,input,textarea{width:100%;box-sizing:border-box;font-size:13px;padding:4px}\nbutton{background:#1a73e8;color:#fff;border:0;border-radius:6px;padding:8px 12px;font-size:13px;cursor:pointer;margin:8px 6px 0 0}\nbutton:disabled{opacity:.5;cursor:default}\nbutton.sec{background:#fff;color:#1a73e8;border:1px solid #dadce0}\n#prev{border:1px solid #dadce0;border-radius:6px;padding:8px;margin-top:10px;font-size:12px;max-height:420px;overflow:auto;background:#fff}\n.ok{color:#188038;margin-top:8px}.muted{color:#5f6368;font-size:12px}\n</style></head>\n<body>\n<p><strong>Para:</strong> Sara<br><strong>Cc:</strong> Idília e Júlia</p>\n<label for=\"dias\">Período</label>\n<select id=\"dias\" onchange=\"ver()\"><option value=\"7\">Últimos 7 dias</option><option value=\"14\">Últimos 14 dias</option><option value=\"30\">Últimos 30 dias</option></select>\n<label for=\"plano\">Seguimento previsto para a próxima semana</label><textarea id=\"plano\" rows=\"4\" placeholder=\"Um próximo passo por linha. Escreve apenas o que planeias fazer.\" oninput=\"invalidar()\"></textarea>\n<button class=\"sec\" onclick=\"ver()\">Atualizar resumo</button>\n<label for=\"assunto\">Assunto</label><input id=\"assunto\" readonly onclick=\"this.select()\">\n<button id=\"copiarAssunto\" class=\"sec\" disabled onclick=\"copiarAssunto()\">Copiar assunto</button><button id=\"copiarEmail\" disabled onclick=\"copiarEmail()\">Copiar email</button>\n<div id=\"msg\" class=\"ok\" role=\"status\" aria-live=\"polite\"></div>\n<div id=\"prev\">A preparar…</div>\n<p class=\"muted\">Abre o webmail da Janela (janela.pt/webmail), cria uma mensagem para a Sara com a Idília e a Júlia em Cc, cola o assunto e o email (Ctrl+V). Revê e envia tu.</p>\n<script>\nlet revisao=0,pendente=null,aprovado=null,timerAviso=null;\nconst campo=id=>document.getElementById(id);\nfunction entradaAtual(){return{dias:+campo('dias').value,plano:campo('plano').value};}\nfunction coincide(p){const a=entradaAtual();return p&&p.revisao===revisao&&p.dias===a.dias&&p.plano===a.plano;}\nfunction mensagem(t){if(timerAviso!==null){clearTimeout(timerAviso);timerAviso=null;}campo('msg').textContent=t;}\nfunction bloquear(){campo('copiarEmail').disabled=true;campo('copiarAssunto').disabled=true;campo('assunto').value='';}\nfunction invalidar(){revisao++;pendente=null;aprovado=null;bloquear();campo('prev').textContent='Alterações por atualizar.';mensagem('Atualiza o resumo para incluir o plano e o período atuais.');}\nfunction falhaAtual(p,e){if(!coincide(p))return;pendente=null;aprovado=null;bloquear();campo('prev').textContent=e.message||'Não foi possível preparar o resumo. Tenta atualizar novamente.';mensagem('O resumo não está pronto para copiar. O plano foi mantido.');}\nfunction ver(){\n const a=entradaAtual();if(pendente&&coincide(pendente))return;\n const p={...a,revisao:++revisao};pendente=p;aprovado=null;bloquear();campo('prev').textContent='A preparar…';mensagem('A preparar o resumo para o plano e período atuais…');\n google.script.run.withSuccessHandler(r=>{\n  if(!coincide(p))return;\n  if(!r||typeof r.html!=='string'||typeof r.assunto!=='string'||!Array.isArray(r.proximosPassos)){falhaAtual(p,{message:'O resumo recebido está incompleto. Atualiza novamente.'});return;}\n  pendente=null;aprovado=p;campo('prev').innerHTML=r.html;campo('assunto').value=r.assunto;campo('copiarAssunto').disabled=false;campo('copiarEmail').disabled=!r.proximosPassos.length;\n  mensagem(r.proximosPassos.length?'Resumo atualizado. Revê antes de copiar.':'Preenche o seguimento da próxima semana e carrega em Atualizar resumo.');\n }).withFailureHandler(e=>falhaAtual(p,e)).previewResumo(p.dias,p.plano);\n}\nfunction aviso(t){mensagem(t);const atual=revisao;timerAviso=setTimeout(()=>{if(atual===revisao)campo('msg').textContent='';timerAviso=null;},4000);}\nfunction pronto(email){if(!coincide(aprovado)||pendente||(email?campo('copiarEmail').disabled:campo('copiarAssunto').disabled)){invalidar();return false;}return true;}\nfunction copiarAssunto(){if(!pronto(false))return;const i=campo('assunto');i.select();const ok=document.execCommand('copy');aviso(ok?'Assunto copiado.':'Seleciona o assunto e usa Ctrl+C.');}\nfunction copiarEmail(){if(!pronto(true))return;const el=campo('prev'),r=document.createRange();r.selectNodeContents(el);const s=window.getSelection();s.removeAllRanges();s.addRange(r);const ok=document.execCommand('copy');s.removeAllRanges();aviso(ok?'Email copiado, com a tabela. Cola no webmail.':'Não consegui copiar: seleciona o texto acima e usa Ctrl+C.');}\n\nver();\n</script>\n</body></html>\n";
const MARCADOR_JS = "(async () => { function painelMarcadorClara() { const id='clara-recolha-painel',anterior=document.getElementById(id); if(anterior&&anterior.dataset.busy==='true')return null; if(anterior)anterior.remove(); const host=document.createElement('div');host.id=id;host.dataset.busy='true'; Object.assign(host.style,{position:'fixed',right:'16px',bottom:'16px',width:'min(360px, calc(100vw - 32px))',zIndex:'2147483647'}); const root=host.attachShadow({mode:'open'}),style=document.createElement('style'); style.textContent='*{box-sizing:border-box}section{font:14px/1.45 Arial,sans-serif;background:#fff;color:#183746;border:1px solid #d9e3e9;border-radius:12px;box-shadow:0 6px 30px #18374638;padding:16px}header{display:flex;align-items:center;justify-content:space-between;margin-bottom:10px}strong{font-size:17px}p{margin:7px 0}.help{font-size:12px;color:#526b78}button{font:600 13px Arial,sans-serif;border:0;border-radius:6px;padding:9px 12px;cursor:pointer;background:#087f8c;color:white}button.close{background:#eef3f6;color:#183746;padding:5px 9px}button:disabled{opacity:.5;cursor:wait}textarea{width:100%;height:100px;resize:vertical;font:12px Arial;border:1px solid #91a8b4;border-radius:5px;padding:8px;margin:8px 0}button:focus-visible,textarea:focus{outline:3px solid #79c5d3;outline-offset:2px}[hidden]{display:none!important}'; root.appendChild(style);const section=document.createElement('section');section.setAttribute('role','region');section.setAttribute('aria-label','Recolha Clara'); const header=document.createElement('header'),title=document.createElement('strong'),close=document.createElement('button');title.textContent='Clara';close.textContent='×';close.className='close';close.setAttribute('aria-label','Fechar confirmação da recolha');close.disabled=true;close.addEventListener('click',()=>host.remove());header.append(title,close); const status=document.createElement('p'),help=document.createElement('p'),manual=document.createElement('textarea'),copy=document.createElement('button');status.setAttribute('role','status');status.setAttribute('aria-live','polite');status.textContent='A iniciar a leitura…';help.className='help';manual.hidden=true;manual.readOnly=true;manual.setAttribute('aria-label','Leitura Clara para copiar');copy.hidden=true;copy.textContent='Copiar novamente'; section.append(header,status,help,manual,copy);root.appendChild(section);document.body.appendChild(host);let texto=''; async function copiar(){try{await navigator.clipboard.writeText(texto);manual.hidden=true;status.textContent='Leitura copiada.';copy.textContent='Copiar novamente';return true;}catch(e){status.textContent='Cópia automática indisponível.';help.textContent='Seleciona o texto abaixo, copia com Ctrl+C e cola no painel da Clara.';manual.value=texto;manual.hidden=false;manual.focus();manual.select();copy.textContent='Tentar copiar novamente';return false;}} copy.addEventListener('click',copiar); return{estado(t){status.textContent=t;},async concluir(t,resumo,destino,aviso){texto=t;host.dataset.busy='false';close.disabled=false;copy.hidden=false;help.textContent=resumo+(aviso?' '+aviso:'')+' No Sheets: Clara > '+destino+'. Cola, revê e confirma a gravação.';await copiar();},falhar(t){host.dataset.busy='false';close.disabled=false;status.textContent='Não foi possível recolher.';help.textContent=t;}}; } async function fetchClara(url,json){const control=new AbortController(),timer=setTimeout(()=>control.abort(),12000);try{const r=await fetch(url,{cache:'no-store',signal:control.signal});if(!r.ok)throw Error('A página não respondeu corretamente.');return json?await r.json():await r.text();}finally{clearTimeout(timer);}} const ui=painelMarcadorClara();if(!ui)return; /* Leitura apenas do DOM apresentado pelo Rightmove Plus. Nunca copia contactos pessoais. */ function dataRightmove(s){ const meses={jan:1,feb:2,mar:3,apr:4,may:5,jun:6,jul:7,aug:8,sep:9,oct:10,nov:11,dec:12};let m=String(s).trim().match(/^(\\d{2})\\/(\\d{2})\\/(\\d{2}|\\d{4})$/),y,mm,d; if(m){d=+m[1];mm=+m[2];y=+m[3]+(m[3].length===2?2000:0);}else{m=String(s).trim().match(/^([A-Za-z]+)\\s+(\\d{1,2}),?\\s+(\\d{4})$/);if(!m)return null;mm=meses[m[1].slice(0,3).toLowerCase()];d=+m[2];y=+m[3];} const dt=new Date(Date.UTC(y,mm-1,d));return dt.getUTCFullYear()===y&&dt.getUTCMonth()===mm-1&&dt.getUTCDate()===d?dt.toISOString().slice(0,10):null; } function periodoLeadsRightmove(doc){const b=Array.from(doc.querySelectorAll('button')).find(n=>/^\\d{2}\\/\\d{2}\\/\\d{2,4}\\s*-\\s*\\d{2}\\/\\d{2}\\/\\d{2,4}$/.test(n.textContent.trim()));if(!b)throw Error('O período das leads não ficou identificado.');const partes=b.textContent.trim().split(/\\s*-\\s*/);const inicio=dataRightmove(partes[0]),fim=dataRightmove(partes[1]);if(!inicio||!fim||inicio>fim)throw Error('Período inválido.');return{inicio,fim};} function numeroRightmove(n){const s=String(n==null?'':n).trim();if(!/^\\d+(?:\\.\\d+)?$/.test(s))throw Error('Indicador numérico não disponível.');return Number(s);} function lerPaginaPerformanceRightmove(doc){ const root=doc.querySelector('#property-performance-report');if(!root)throw Error('Abre Property performance report.'); const text=s=>root.querySelector(s)?.textContent.trim()||'',m=text('.property-count').match(/^(\\d+) listings?$/),j=text('.date-picker .divider.text').match(/^Last (30|60|90) Days$/),atualizado=dataRightmove(text('.last-refresh').replace(/^Up to date as of\\s*/,'')); if(!m||!j||!atualizado)throw Error('Não consegui identificar total, janela ou data do relatório.');if(root.querySelector('input[placeholder=\"Find by address or agent ref\"]')?.value.trim()||root.querySelector('.sold-stc-toggle input')?.checked)throw Error('Limpa a pesquisa e desmarca Include sold STC para recolher a carteira completa.'); const registos=Array.from(root.querySelectorAll('.property-row')).map(row=>{const t=s=>row.querySelector(s)?.textContent.trim()||'',health=Array.from(row.querySelectorAll('.health-number')).map(n=>n.textContent.trim()),link=row.querySelector('a[href*=\"/marketing-report/\"]')?.getAttribute('href')||'',id=(link.match(/\\/marketing-report\\/(\\d+)$/)||[])[1];if(!id)throw Error('Anúncio sem código Rightmove.');const prev=t('.property-performance-vs-past'),ref=t('.agent-ref');if(!/^\\d+_[\\w-]+$/.test(ref))throw Error('Referência do anúncio inválida.');return{id,ref,local:t('.address1'),preco:numeroRightmove(t('.price').replace(/[€£$,\\s]/g,'')),primeira:dataRightmove(t('.first-visible')),fotografias:numeroRightmove(health[0]),plantas:numeroRightmove(health[1]),diasAtualizacao:/^\\d+d$/.test(health[2])?Number(health[2].slice(0,-1)):null,media:numeroRightmove(t('.property-views .big-numbers')),anterior:prev,vsAgencia:t('.property-performance-vs-similar')};}); return{total:Number(m[1]),janela:Number(j[1]),atualizado,mediaAgencia:numeroRightmove(text('.branch-average').replace(/[()]/g,'').replace(/branch avg views/,'')),registos}; } function datasTabelaLeadsRightmove(doc){const tabela=doc.querySelector('table');if(!tabela)return null;const headers=Array.from(tabela.querySelectorAll('th')).map(n=>n.textContent.trim()),col=headers.indexOf('Date/time');if(col<0)return null;return Array.from(tabela.querySelectorAll('tbody tr')).map(row=>{const cell=row.querySelectorAll('td')[col];if(!cell)throw Error('Tabela de leads incompleta.');const labels=Array.from(cell.querySelectorAll('span')),label=labels.find(n=>n.textContent.trim()==='Date'),data=dataRightmove(label?.nextElementSibling?.textContent||'');if(!data)throw Error('Data de lead não reconhecida.');return data;});} async function recolherRightmove(doc,ui){ const wait=ms=>new Promise(r=>setTimeout(r,ms)),until=async (fn,erro)=>{for(let i=0;i<120;i++){const r=fn();if(r!==null&&r!==false&&r!==undefined)return r;await wait(250);}throw Error(erro||'O Rightmove demorou a responder. Volta a tentar.');},base={v:3,origem:'rightmove',marcadorVersao:'20261024.3',lido:new Date().toISOString(),url:location.origin+location.pathname}; if(location.hostname==='admin.rightmove.co.uk'){ const first=lerPaginaPerformanceRightmove(doc),map=new Map(),scroll=doc.querySelector('.navigation-layout-content'),original=scroll?scroll.scrollTop:window.scrollY; if(!scroll)throw Error('Não encontrei a área de deslocação da lista.'); try{scroll.scrollTop=0;await wait(300);for(let pass=0;pass<500;pass++){const p=lerPaginaPerformanceRightmove(doc);if(p.total!==first.total||p.janela!==first.janela||p.atualizado!==first.atualizado)throw Error('O relatório mudou durante a recolha. Repete sem alterar filtros.');p.registos.forEach(r=>{if(map.has(r.id)&&JSON.stringify(map.get(r.id))!==JSON.stringify(r))throw Error('Um anúncio mudou durante a leitura. Repete a recolha.');map.set(r.id,r);});ui.estado('Rightmove: '+map.size+' de '+first.total+' anúncios…');if(map.size===first.total)break;const before=scroll.scrollTop;scroll.scrollTop=Math.min(scroll.scrollHeight,scroll.scrollTop+Math.max(150,scroll.clientHeight*.7));await wait(200);if(scroll.scrollTop===before)break;} if(map.size!==first.total)throw Error('Leitura incompleta: '+map.size+' de '+first.total+' anúncios. Não vou copiar uma carteira incompleta.');const registos=Array.from(map.values()).sort((a,b)=>a.id.localeCompare(b.id));return Object.assign(base,{tipo:'performance',janela:first.janela,atualizado:first.atualizado,total:first.total,mediaAgencia:first.mediaAgencia,registos});}finally{scroll.scrollTop=original;} } if(location.hostname!=='rmplusportal.rightmove.co.uk')throw Error('Abre os relatórios do Rightmove Plus.'); const periodo=periodoLeadsRightmove(doc),samePeriod=()=>{if(JSON.stringify(periodoLeadsRightmove(doc))!==JSON.stringify(periodo))throw Error('O período mudou durante a recolha.');},nav=async suffix=>{const a=doc.querySelector('a[href=\"/customer-reports/lead-reports/'+suffix+'\"]');if(!a)throw Error('Separador de leads não encontrado.');a.click();await wait(350);},carregando=()=>!!doc.querySelector('[aria-busy=\"true\"], [role=\"progressbar\"], [class*=\"loadingSkeleton\"]'),stat=id=>{if(carregando())return null;const n=doc.querySelector('[data-testid=\"stat-value-'+id+'\"]');return n&&/^\\d+$/.test(n.textContent.trim())?Number(n.textContent.trim()):null;}; await nav('summary');const totais=await until(()=>{const total=stat('total-leads'),chamadas=stat('calls'),emails=stat('emails');return total===null||chamadas===null||emails===null?null:{total,chamadas,emails};});if(totais.total!==totais.chamadas+totais.emails)throw Error('Totais de leads incoerentes.');const dias={};for(let ts=Date.parse(periodo.inicio);ts<=Date.parse(periodo.fim);ts+=86400000){if(Object.keys(dias).length>1096)throw Error('Escolhe até três anos por recolha.');dias[new Date(ts).toISOString().slice(0,10)]={chamadas:0,emails:0};} try{for(const [canal,path,id]of[['chamadas','telephone','total-calls'],['emails','email','total-emails']]){ui.estado('A contar '+canal+' por dia…');await nav(path);await until(()=>stat(id)===totais[canal],'O total de '+canal+' não ficou disponível ou difere do resumo. Aguarda o fim do carregamento e volta a tentar.');samePeriod();if(!totais[canal])continue; const irPagina=async b=>{const antes=doc.querySelector('table')?.innerHTML,pagina=doc.querySelector('select[aria-label=\"pagination dropdown\"]')?.value;b.click();await until(()=>{const depois=doc.querySelector('table')?.innerHTML,atual=doc.querySelector('select[aria-label=\"pagination dropdown\"]')?.value;return depois&&depois!==antes&&atual!==pagina&&datasTabelaLeadsRightmove(doc)?.length;});await wait(250);}; const button=name=>Array.from(doc.querySelectorAll('button')).find(n=>(n.getAttribute('aria-label')||n.textContent.trim())===name);let back=0;while(button('Previous')&&!button('Previous').disabled){await irPagina(button('Previous'));if(++back>500)throw Error('Paginação não reconhecida.');} let n=0;for(let page=0;page<500;page++){const dates=await until(()=>{const a=datasTabelaLeadsRightmove(doc);return a&&a.length?a:null;});samePeriod();dates.forEach(d=>{if(!dias[d])throw Error('A tabela tem datas fora do período selecionado.');dias[d][canal]++;n++;});if(n>totais[canal])throw Error('Foram contadas leads repetidas.');const next=button('Next');if(!next||next.disabled)break;if(n===totais[canal])throw Error('A tabela indica páginas extra.');await irPagina(next);} if(n!==totais[canal])throw Error('Só consegui contar '+n+' de '+totais[canal]+' '+canal+'. Verifica os filtros e volta a tentar.');} await nav('summary');await until(()=>stat('total-leads')===totais.total&&stat('calls')===totais.chamadas&&stat('emails')===totais.emails,'O resumo mudou durante a recolha. Volta a recolher para conferir os novos totais.');samePeriod();return Object.assign(base,{tipo:'leads',url:location.origin+'/customer-reports/lead-reports/summary',periodo,totais,diarios:Object.keys(dias).sort().map(data=>Object.assign({data},dias[data]))});}finally{await nav('summary');} } if(['admin.rightmove.co.uk','rmplusportal.rightmove.co.uk'].includes(location.hostname)){ try{const d=await recolherRightmove(document,ui);await ui.concluir('CLARA3:'+JSON.stringify(d),d.tipo==='leads'?d.totais.total+' leads · '+d.diarios.length+' dias conferidos':d.total+' anúncios · janela de '+d.janela+' dias','Rightmove: estatísticas','Cola a leitura no painel Rightmove: estatísticas e revê antes de guardar.');}catch(e){ui.falhar(e.message);}return; } function recolherIdealista(doc, contexto) { const txt = e => e ? e.textContent.replace(/\\s+/g, ' ').trim() : ''; const numero = s => /^\\d[\\d .]*%?$/.test(String(s).trim()) ? Number(String(s).replace(/[ .%]/g, '')) : null; const visivel = e => !!e && !e.hidden && (!e.getClientRects || e.getClientRects().length > 0); const body = (doc.body.innerText || doc.body.textContent).replace(/\\s+/g, ' ').trim(); const data = s => { const m = /^(\\d{2})\\/(\\d{2})\\/(\\d{4})$/.exec(s || ''); return m ? m[3]+'-'+m[2]+'-'+m[1] : null; }; const out = {v:2,origem:'idealista',tipo:'',lido:contexto.lido,url:contexto.url,periodo:{inicio:null,fim:null},filtros:[],cobertura:'Parcial: apenas a página aberta',registos:[]}; out.filtros = Array.from(doc.querySelectorAll('a.actived, a.active, button.dropdown-wrapper .placeholder')).filter(visivel).map(txt).filter(s=>s && s.length<80 && !/[-錄]/.test(s)).filter((s,i,a)=>a.indexOf(s)===i); const relativo=out.filtros.find(s=>/^(Hoje|7 dias|30 dias|90 dias)$/.test(s)); if(relativo)out.periodo.etiqueta=relativo; const dates = /de (\\d{2}\\/\\d{2}\\/\\d{4}) até (\\d{2}\\/\\d{2}\\/\\d{4})/.exec(body); if (dates) Object.assign(out.periodo,{inicio:data(dates[1]),fim:data(dates[2])}); const contact = doc.querySelector('a[href*=\"fromDate=\"][href*=\"toDate=\"]'); if(contact){const u=new URL(contact.getAttribute('href'),contexto.url);Object.assign(out.periodo,{inicio:data(u.searchParams.get('fromDate')),fim:data(u.searchParams.get('toDate'))});} if (/\\/tools\\/listadostarter/.test(contexto.url)) { out.tipo='lista'; out.filtros=Array.from(doc.querySelectorAll('a.icon-arrow-dropdown')).filter(visivel).map(txt).filter(Boolean); const pesquisa=doc.querySelector('input[placeholder=\"Referência, rua, localidade, etc...\"]');if(pesquisa&&pesquisa.value.trim())out.filtros.push('Pesquisa: '+pesquisa.value.trim()); if(!out.filtros.length)out.filtros=['Filtros da lista não identificados']; const params=new URL(contexto.url).searchParams; const pagina=params.get('CurrentPage'); const total=/Imóveis ativos\\s*\\(([\\d .]+)\\)/i.exec(body); out.paginacao={pagina:Number(pagina)||1,porPagina:Number(params.get('ItemsPerPage'))||20,totalAtivos:total?numero(total[1]):null,ordem:(params.get('OrderedBy')||'')+' '+(params.get('OrderedType')||'')};if(pagina&&/^\\d+$/.test(pagina))out.cobertura+=' · página '+pagina; out.registos=Array.from(doc.querySelectorAll('ul.row[data-key]')).filter(visivel).map(r=>{ const cols=Array.from(r.children), ref=txt(r.querySelector('.exteral-ref')).replace(/^Ref\\s+/,''); return {id:r.getAttribute('data-key'),ref:ref,metricas:{qualidade:numero(txt(r.querySelector('.quality-info-col svg text')))},publicacao:cols[8]?cols[8].innerText.trim():'',rendimento:cols[10]?cols[10].innerText.trim():'',aviso:Array.from(r.querySelectorAll('[title]')).some(e=>e.getAttribute('title')==='Validação pendente')?'Validação pendente':''}; }); } else if (/\\/stats\\/rank\\/neighborhood/.test(contexto.url) || Array.from(doc.querySelectorAll('h2')).filter(visivel).some(e=>/^ranking\\s/i.test(txt(e)))) { out.tipo=/\\/stats\\/rank\\/neighborhood/.test(contexto.url)?'zona':'ranking'; out.registos=Array.from(doc.querySelectorAll('table tr')).filter(visivel).map(r=>{ const c=Array.from(r.querySelectorAll('td')); if(c.length!==9)return null; const a=r.querySelector('a[href*=\"/tools/propiedad/\"],a[href*=\"/imovel/\"]'), m=a&&/\\/(?:propiedad|imovel)\\/(\\d+)/.exec(a.getAttribute('href')); const n=c.slice(2).map(e=>numero(txt(e)));if(n.some(x=>x===null))return null; return {id:m?m[1]:'',ref:'',posicao:numero(txt(c[0])),metricas:{visitasListas:n[0],visitasDetalhes:n[1],partilhas:n[2],alertas:n[3],favoritos:n[4],chamadas:n[5],mensagens:n[6]}}; }).filter(Boolean); if(out.tipo==='zona')out.cobertura='Comparativo da zona: apenas os resultados visíveis; não é a carteira da agência'; } else if (/\\/stats\\/loadImpactStats/.test(contexto.url)) { out.tipo='geral';out.cobertura='Totais visíveis da carteira no período e filtros selecionados'; const metricas={}, labels={visitasTotais:'visitas totais',acoes:'ações em anúncios',visitasListas:'visitas nas listas',visitasDetalhes:'visitas em detalhes',agenciaOnline:'agência online',partilhas:'enviado aos amigos',alertas:'envios em alertas',favoritos:'favoritos',clientes:'de cliente',angariacao:'de angariação',mensagens:'emails e/ou mensagens',chamadas:'chamadas'}; Object.keys(labels).forEach(k=>{for(const e of doc.querySelectorAll('td')){const t=txt(e),m=new RegExp('^([0-9][0-9 .]*) '+labels[k].replace(/[.*+?^${}()|[\\]\\\\]/g,'\\\\$&')+'(?: |$)').exec(t);if(m){metricas[k]=numero(m[1]);break;}}}); const total=/([\\d .]+) impactos \\(Soma/.exec(body), contactos=/([\\d .]+) contactos recebidos/.exec(body), ativos=/([\\d .]+) anúncios ativos hoje/.exec(body); if(total)metricas.impactos=numero(total[1].trim());if(contactos)metricas.contactos=numero(contactos[1].trim());if(ativos)metricas.anunciosAtivosHoje=numero(ativos[1].trim()); if(Object.keys(metricas).length)out.registos=[{id:'carteira',ref:'',metricas:metricas}]; } if(!out.tipo || !out.registos.length)throw new Error('Abre a lista de imóveis, o gráfico ou o ranking do Idealista e espera que os dados terminem de carregar.'); if(out.tipo!=='lista' && (!out.periodo.inicio||!out.periodo.fim))out.cobertura+=out.tipo==='zona'&&relativo?' · '+relativo+'; datas exatas não indicadas nesta página':' · Período por confirmar antes de guardar'; return out; } /* Leitura apenas dos pontos vetoriais visíveis; rejeita zoom parcial. */ function descodificarContactosSVGIdealista(raw,inicio,fim,totalEsperado,optEsperado){ const a=Date.parse(inicio+'T00:00:00Z'),b=Date.parse(fim+'T00:00:00Z'),dias=Math.round((b-a)/86400000)+1; if(!Number.isFinite(a)||!Number.isFinite(b)||dias<1||dias>3660||raw.total.length!==dias||raw.opt.length!==dias)throw Error('O gráfico não mostra todos os dias do período. Repõe a vista completa e recolhe novamente.'); const ticks=raw.ticks.filter(t=>Number.isFinite(t.valor)&&Number.isFinite(t.y)).sort((x,y)=>x.valor-y.valor); if(ticks.length<2)throw Error('A escala do gráfico não ficou identificada.'); const z=ticks[0],u=ticks[ticks.length-1],escala=(u.y-z.y)/(u.valor-z.valor); if(!Number.isFinite(escala)||escala>=0||ticks.some(t=>Math.abs(t.y-(z.y+(t.valor-z.valor)*escala))>0.001))throw Error('Escala diária não reconhecida.'); const valor=p=>{const n=z.valor+(p.y-z.y)/escala,v=Math.round(n);if(!Number.isFinite(n)||v<0||Math.abs(n-v)>0.0001)throw Error('Um ponto do gráfico não corresponde a um valor inteiro seguro.');return v;}; const passo=dias>1?(raw.total[dias-1].x-raw.total[0].x)/(dias-1):0; if(dias>1&&passo<=0)throw Error('Ordem diária não reconhecida.'); const out=raw.total.map((p,i)=>{if(Math.abs(p.x-raw.opt[i].x)>0.001||Math.abs(p.x-(raw.total[0].x+passo*i))>0.001)throw Error('Os pontos do gráfico não estão alinhados por dia.');return{data:new Date(a+i*86400000).toISOString().slice(0,10),contactos:valor(p),opt:valor(raw.opt[i])};}); if(out.reduce((n,x)=>n+x.contactos,0)!==totalEsperado||out.reduce((n,x)=>n+x.opt,0)!==optEsperado)throw Error('A soma diária não coincide com os totais do Idealista. Espera o gráfico terminar de carregar e recolhe novamente.'); return out; } function pontosContactosSVGIdealista(doc){ const xy=e=>({x:Number(e.getAttribute('cx')),y:Number(e.getAttribute('cy'))}); return{ticks:Array.from(doc.querySelectorAll('#contactsGraph .y.axis .tick')).map(e=>({valor:Number(e.textContent.replace(/\\s/g,'').replace(',','.')),y:Number((/translate\\([^,]+,\\s*([\\d.-]+)/.exec(e.getAttribute('transform')||'')||[])[1])})),total:Array.from(doc.querySelectorAll('#contactsGraph .chart-line.target-total .-circles-total circle')).map(xy),opt:Array.from(doc.querySelectorAll('#contactsGraph .chart-line.target-opt .-circles-opt circle')).map(xy)}; } async function recolherDiariosIdealista(doc,d){ const radioEmail=doc.querySelector('#HISTOEMAIL'),radioCall=doc.querySelector('#HISTOCALL'),total=doc.querySelector('#CONTACTS_TOTAL'); if(!radioEmail||!radioCall||!total)throw Error('O gráfico de contactos não ficou disponível nesta página.'); const original=radioCall.checked?radioCall:radioEmail,estado=total.checked,m=d.registos[0].metricas; const pausa=ms=>new Promise(r=>setTimeout(r,ms)); async function ler(radio,esperado){ radio.click();await pausa(1000);let prev='',repeticoes=0,ultimo; for(let i=0;i<18;i++){try{const raw=pontosContactosSVGIdealista(doc),sig=JSON.stringify(raw);repeticoes=sig===prev?repeticoes+1:0;prev=sig;if(repeticoes>=2&&radio.checked)return descodificarContactosSVGIdealista(raw,d.periodo.inicio,d.periodo.fim,m.contactos,esperado);}catch(e){ultimo=e;}await pausa(150);} throw ultimo||Error('O gráfico ainda está a atualizar. Recolhe novamente.'); } try{if(!total.checked)total.click();const emails=await ler(radioEmail,m.mensagens),calls=await ler(radioCall,m.chamadas);const diarios=emails.map((x,i)=>{const c=calls[i];if(x.data!==c.data||x.contactos!==c.contactos||x.opt+c.opt!==x.contactos)throw Error('Os contactos diários não coincidem com mensagens e chamadas.');return{data:x.data,contactos:x.contactos,mensagens:x.opt,chamadas:c.opt};});d.diarios=diarios;} finally{if(!original.checked)original.click();if(total.checked!==estado)total.click();} } if (/^(?:www\\.)?idealista\\.pt$/.test(location.hostname)) { try {ui.estado('A ler a página do Idealista…');const d=recolherIdealista(document,{url:location.href,lido:new Date().toISOString()});if(d.tipo==='geral'){ui.estado('A ler totais e gráfico diário de contactos…');try{await recolherDiariosIdealista(document,d);}catch(e){d.avisoSerie=e.message;}} d.marcadorVersao='20261024.3';await ui.concluir('CLARA2:'+JSON.stringify(d),d.registos.length+' registos · '+d.cobertura+'.','Idealista: estatísticas',d.avisoSerie?'O gráfico diário não foi recolhido; os totais mantêm-se disponíveis.':'');}catch(e){ui.falhar(e.message);}return; } if (!/^(?:www\\.)?janela-imobiliaria\\.com$/.test(location.hostname)){ui.falhar('Abre a página pública do imóvel no site da Janela, ou uma página de lista/estatísticas do Idealista.');return;} try { ui.estado('A ler a ficha do imóvel…'); const ld = d => { for (const s of d.querySelectorAll('script[type=\"application/ld+json\"]')) { try { const j = JSON.parse(s.textContent); if (j['@type'] === 'RealEstateListing') return j; } catch (e) {} } return null; }; const me = ld(document); if(!me){ui.falhar('Esta página não é uma ficha de imóvel. Abre o anúncio e volta a clicar no marcador.');return;} const ext = x => ((JSON.stringify(x).match(/\\.(pdf|jpe?g|png|webp|gif)\\b/i) || [])[1] || '?').toLowerCase().replace('jpeg', 'jpg'); const out = { v: 1, marcadorVersao: '20261024.3', origem: 'site', lido: new Date().toISOString(), url: location.href.split('?')[0], ref: null, idiomaCaracteristicas: (document.documentElement.lang || '').slice(0,2).toUpperCase(), textos: {} }; let p = null; const u = performance.getEntriesByType('resource').map(e => e.name).find(n => /websiteapi\\.egorealestate\\.com\\/v1\\/Properties\\/\\d+\\?.*propertyid=/.test(n)); if (u) { try { p = await fetchClara(u,true); } catch (e) {} } if (p && p.Reference) { const I = p.Images || []; Object.assign(out, { ref: p.Reference, alterado: p.LastModified, fotos: I.length, fotosComAlt: I.filter(i => (i.AlternativeText || '').trim()).length, fotosComLegenda: I.filter(i => (i.Description || '').trim()).length, plantas: (p.BluePrints || []).map(ext), videos: (p.Videos || []).length, visitaVirtual: !!(p.HasVirtualTour || (p.VirtualTours || []).length || (p.ExternalVirtualTours || []).length), fotos360: (p.Photos360 || []).length, folhetos: (p.Brochures || []).length, nomesCaracteristicas: (p.Features || []).flatMap(g => (g.Childs || []).map(f => typeof f === 'string' ? f : typeof f.Name === 'string' ? f.Name : '')), caracteristicas: (p.Features || []).reduce((n, g) => n + ((g.Childs || []).length), 0), classeEnergetica: p.EnergyCertification || '' }); } else { const html = document.documentElement.outerHTML; const ids = t => new Set(html.match(new RegExp('/T' + t + '/ID[0-9a-f-]+', 'g')) || []).size; const r = (document.querySelector('.detailContainer') || document.body).textContent.match(/Ref\\.\\s*([A-Z]{2,5}\\d+)/); Object.assign(out, { ref: r && r[1], parcial: true, fotos: ids('photo'), fotos360: ids('panoramic'), folhetos: ids('brochure'), plantas: [...new Set(html.match(/\\/Tblueprint\\/ID[0-9a-f-]+\\.\\w+/g) || [])].map(s => s.split('.').pop().toLowerCase()), videos: document.querySelector('#videoTab.propertyMediaDisabled') ? 0 : null }); } /* Nomes do bloco do próprio imóvel; exclui equipamentos da zona envolvente. */ const blocoFeatures=document.querySelector('.propertyBasicFeatures'); if(blocoFeatures){ const itens=Array.from(blocoFeatures.querySelectorAll('.detailWrapper .detailItem')); const nomes=itens.filter(e=>{const ul=e.closest('.detailWrapper'),m=(ul.className||'').match(/\\bfeat\\d+\\b/),h=m&&blocoFeatures.querySelector('.featureHeader.'+m[0]);return !h||!/zona envolvente|surroundings/i.test(h.textContent);}).map(e=>{const n=e.querySelector('.label'),v=e.querySelector('.value');return n&&v&&(v.querySelector('[class*=\"tick\"]')||v.textContent.trim()&&!/^(0|n[aã]o|no)$/i.test(v.textContent.trim()))?n.textContent.trim():'';}); if(itens.length&&nomes.length&&nomes.every(Boolean)){out.nomesCaracteristicas=nomes;out.nomesCaracteristicasCompletos=true;out.idiomaCaracteristicas=(document.documentElement.lang||'').slice(0,2).toUpperCase();} } const alternativos=new Map();for(const l of document.querySelectorAll('link[rel=alternate][hreflang]')){const k=l.hreflang.slice(0,2).toUpperCase();if(['PT','EN','FR','DE','ES'].includes(k)&&!alternativos.has(k)&&/^https?:\\/\\/(?:www\\.)?janela-imobiliaria\\.com\\//.test(l.href))alternativos.set(k,l.href);} let feitos=0;ui.estado('A ler títulos e descrições nos idiomas disponíveis…'); await Promise.all(Array.from(alternativos).map(async([k,url])=>{try{const j=ld(new DOMParser().parseFromString(await fetchClara(url,false),'text/html'));if(!j)throw Error('Idioma não lido');out.textos[k]={titulo:j.name||'',descricao:j.description||''};}catch(e){out.textos[k]={erro:true};}finally{feitos++;ui.estado('Idiomas lidos: '+feitos+' de '+alternativos.size+'…');}})); const atual=(document.documentElement.lang||'').slice(0,2).toUpperCase();if(['PT','EN','FR','DE','ES'].includes(atual)&&(!out.textos[atual]||out.textos[atual].erro))out.textos[atual]={titulo:me.name||'',descricao:me.description||''};if(!out.textos.PT)out.textos.PT={erro:true}; if(!out.ref){ui.falhar('Não consegui identificar a referência. Confirma que abriste a ficha completa do imóvel e volta a tentar.');return;} const falharam=Object.values(out.textos).filter(x=>x.erro).length;await ui.concluir('CLARA1:'+JSON.stringify(out),out.ref+' · '+(out.fotos===null||out.fotos===undefined?'fotografias por verificar':out.fotos+' fotografias')+'.','eGO: estado',(out.parcial?'Leitura parcial: há campos por verificar. ':'')+(falharam?falharam+' idioma(s) não foram lidos; não serão tratados como vazios.':'')); }catch(e){ui.falhar(e.name==='AbortError'?'A página demorou demasiado. Volta a tentar.':e.message||'Volta a tentar na página do imóvel.');} })();";
