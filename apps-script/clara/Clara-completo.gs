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

function onOpen() {
  SpreadsheetApp.getUi().createMenu('Clara')
    .addItem('Progresso', 'abrirLista')
    .addItem('eGO: estado', 'abrirPainel')
    .addItem('Idealista: estatísticas', 'colarLeituraIdealista')
    .addItem('Idealista: ranking dos anúncios', 'conferirPaginasIdealista')
    .addItem('Resumo semanal', 'abrirResumo')
    .addItem('Instalar o marcador', 'mostrarMarcador')
    .addToUi();
}

function abrirPainel() {
  SpreadsheetApp.getUi().showSidebar(HtmlService.createHtmlOutput(PAINEL_HTML).setTitle('Clara'));
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
    if (r[6] === 'Andreia') { (minhas[r[1]] = minhas[r[1]] || []).push(p); }
    else if (r[16] === 'Sara') sara.push(p);
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
    else if (!fechada && r[16] === 'Sara') { im(r[1]).pendente.push(r[3] + (r[5] ? ' ' + r[5] : '')); aSara++; }
    else if (!fechada && r[6] === 'Andreia' && dentro(r[9])) { im(r[1]).trabalho.push('Identificado, a tratar: ' + r[3] + '.'); novas++; }
  });
  // Registo de alterações
  const rg = ss.getSheetByName('Registo de alterações');
  if (rg && rg.getLastRow() > 5) rg.getRange(6, 1, rg.getLastRow() - 5, 12).getDisplayValues().forEach(function (r) {
    if (r[1] && dentro(r[0])) im(r[1]).trabalho.push('Alterado (' + r[4] + '): ' + r[5] + (r[7] ? ': ' + r[7] : '') + '.');
  });
  const linhas = Object.keys(por).map(function (k) { return por[k]; }).sort(function (a, b) { return b.pendente.length - a.pendente.length || a.ref.localeCompare(b.ref); });
  return { de: fmt(de), ate: fmt(hoje), linhas: linhas, corrigidas: corrigidas, novas: novas, aSara: aSara };
}
function htmlResumo_(r) {
  const e = function (s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;'); };
  const td = 'border:1px solid #d7dde0;padding:8px;vertical-align:top;text-align:left';
  const cel = function (a, vazio) { return a.length ? a.map(function (x) { return '<div>' + e(x) + '</div>'; }).join('') : '<span style="color:#6b7b80">' + vazio + '</span>'; };
  return '<div style="font-family:Arial,sans-serif;font-size:14px;color:#24383f">' +
    '<p>Olá Sara,</p><p>Ponto de situação dos anúncios de ' + r.de + ' a ' + r.ate + ': ' + r.corrigidas + ' correções confirmadas, ' + r.novas + ' novos pontos a tratar por mim e ' + r.aSara + ' questões que precisam da tua análise (última coluna).</p>' +
    '<table style="border-collapse:collapse;width:100%"><thead><tr>' + ['Imóvel', 'Trabalho realizado / verificação', 'Para a tua análise'].map(function (h) { return '<th style="' + td + ';background:#edf1f2">' + h + '</th>'; }).join('') + '</tr></thead><tbody>' +
    r.linhas.map(function (l) { return '<tr><th scope="row" style="' + td + '">' + e(l.ref) + '</th><td style="' + td + '">' + cel(l.trabalho, 'Sem trabalho neste período.') + '</td><td style="' + td + '">' + cel(l.pendente, 'Nada pendente.') + '</td></tr>'; }).join('') +
    '</tbody></table><p>O detalhe está no separador Pendências da equipa do levantamento.</p><p>Obrigada,<br>Andreia</p></div>';
}
function previewResumo(dias) { const r = resumoSemanal(dias); r.html = htmlResumo_(r); r.assunto = 'Anúncios: ponto de situação de ' + r.de + ' a ' + r.ate; return r; }

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
    '<textarea style="width:100%;height:90px;font-size:11px" onclick="this.select()">' + codigo.replace(/&/g, '&amp;').replace(/</g, '&lt;') + '</textarea>' +
    '<p><b>2.</b> No site da Janela ou no Idealista com sessão iniciada, carrega no marcador <b>Clara</b>. Para atualizar um marcador antigo, substitui o seu endereço por este.</p>' +
    '<p><b>3.</b> Para o Idealista: <b>Clara &gt; Idealista: estatísticas</b>, cola (Ctrl+V), revê e guarda. Para imóveis do site da Janela: <b>Clara &gt; eGO: estado</b>.</p></div>';
  SpreadsheetApp.getUi().showModalDialog(HtmlService.createHtmlOutput(html).setWidth(520).setHeight(430), 'Instalar o marcador Clara');
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
function analisar(texto, docs) {
  texto = String(texto || '').trim();
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
  const campos = [], pend = [], notas = [];
  const prop = function (coluna, valor, motivo) {
    const k = c.col(coluna); if (!k) { notas.push('Coluna "' + coluna + '" não encontrada; ignorada.'); return; }
    const existente = campos.find(function (x) { return x.col === k; });
    if (existente) { existente.novo = valor; existente.motivo = motivo || ''; }
    else campos.push({ coluna: coluna, col: k, atual: atual[k - 1], novo: valor, motivo: motivo || '' });
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
  if (d.fotosComAlt != null && d.fotos > 0) {
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
    if (!t || t.erro) { prop('Descrição ' + k, 'Por verificar', falta); return; }
    prop('Descrição ' + k, falta ? 'Em falta' : 'Preenchido', falta || (t.descricao.length + ' caracteres'));
    if (falta) {
      const nome = { PT: 'português', EN: 'inglês', FR: 'francês', DE: 'alemão', ES: 'espanhol' }[k];
      nova('Textos', 'Descrição em ' + nome + ' em falta', 'No site, ' + falta + fonte + '.', 'Preencher a descrição em ' + nome + ' no eGO.');
    }
    if (t && k !== 'PT' && k !== 'EN' && T.EN && t.titulo && t.titulo === T.EN.titulo)
      nova('Textos', 'Título em ' + IDIOMAS[k] + ' em falta', 'No site, o título em ' + IDIOMAS[k] + ' é igual ao inglês' + fonte + '.', 'Preencher o título em ' + IDIOMAS[k] + ' no eGO.');
  });
  // Características, vídeo, visita virtual, planta, folheto
  if (d.caracteristicas != null) prop('Características', d.caracteristicas > 0 ? 'Preenchido' : 'Em falta', d.caracteristicas + ' características assinaladas');
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
  const emFalta = [], noutra = [];
  DOCS.forEach(function (x) {
    const v = docs && docs[x[0]];
    if (v === 'sim') prop(x[1], 'Preenchido', 'ficha do EGO');
    else if (v === 'nao') { prop(x[1], 'Em falta', 'ficha do EGO'); emFalta.push(x[2]); }
    else if (v === 'categoria') { prop(x[1], 'Categoria errada', 'o ficheiro existe mas está noutra categoria'); noutra.push(x[2]); }
    else if (v === 'na') prop(x[1], 'Não aplicável', 'não se aplica a este imóvel');
  });
  if (emFalta.length) nova('Documentos', 'Documentos obrigatórios sem ficheiro no eGO', 'Na ficha do eGO sem ficheiro: ' + emFalta.join(', ') + ' (' + hoje + ').', 'Verificar no dossier do escritório e carregar no eGO. Só os que não estiverem no dossier passam a pergunta à Sara.');
  if (noutra.length) nova('Documentos', 'Documentos na categoria errada no eGO', 'Na ficha do eGO, carregados noutra categoria: ' + noutra.join(', ') + ' (' + hoje + ').', 'Mover cada ficheiro para a categoria certa no bloco Documentos do eGO.');
  // A folha calcula o estado global a partir de vazios/Por verificar.
  // Registar o desconhecido mantém a fórmula válida, sem fabricar uma ausência.
  const desconhecido = function (coluna) { prop(coluna, 'Por verificar', 'Este bloco não foi verificado nesta leitura.'); };
  if (d.fotos == null) desconhecido('Imagens');
  if (d.fotosComAlt == null || d.parcial) desconhecido('Alt-text');
  if (d.caracteristicas == null || d.parcial) desconhecido('Características');
  if (d.videos == null) desconhecido('Vídeo');
  if (!Array.isArray(d.plantas)) desconhecido('Planta');
  if (d.folhetos == null) desconhecido('Folheto');
  DOCS.forEach(function (x) { if (!docs || ['sim', 'nao', 'categoria', 'na'].indexOf(docs[x[0]]) < 0) desconhecido(x[1]); });
  if (d.url && c.col('Página pública')) prop('Página pública', d.url, 'ligação ao anúncio no site');
  if (c.col('Data da verificação')) prop('Data da verificação', hoje, '');
  const docsCompletos = DOCS.every(function (x) { return docs && ['sim', 'nao', 'categoria', 'na'].indexOf(docs[x[0]]) >= 0; });
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
  if (d.fotosComAlt != null) pode('Fotografias sem texto alternativo');
  Object.keys(IDIOMAS).forEach(function (k) {
    const t = T[k]; if (!t || t.erro) return;
    pode('Descrição em ' + IDIOMAS[k] + ' em falta');
    if (k !== 'PT' && k !== 'EN') pode('Título em ' + IDIOMAS[k] + ' em falta');
  });
  if (d.videos != null) pode('Existe vídeo do imóvel?');
  if (Array.isArray(d.plantas) && d.plantas.every(function (e) { return /^(jpg|jpeg|png|webp|gif|pdf)$/.test(e); })) { pode('Imóvel sem planta'); pode('Planta só em PDF'); }
  const todosVistos = docs && DOCS.every(function (x) { return ['sim', 'nao', 'categoria', 'na'].indexOf(docs[x[0]]) >= 0; });
  if (todosVistos && emFalta.length === 0) pode('Documentos obrigatórios sem ficheiro no eGO');
  if (todosVistos && noutra.length === 0) pode('Documentos na categoria errada no eGO');
  const detetados = {}; pend.forEach(function (p) { detetados[p.assunto] = true; });

  // Pendências já existentes: não duplicar e confirmar as que foram corrigidas
  const ps = SpreadsheetApp.getActive().getSheetByName(PEND.nome);
  const existentes = {}, resolvidas = [];
  ps.getRange(PEND.titulos + 1, 1, Math.max(1, ps.getLastRow() - PEND.titulos), 9).getDisplayValues().forEach(function (r, i) {
    if (!r[1] || r[1].toUpperCase() !== ref) return;
    const key = r[1].toUpperCase() + '|' + r[3];
    const registro = { id: r[0], linha: PEND.titulos + 1 + i, estado: r[8] };
    if (!existentes[key] || existentes[key].estado === 'Concluído') existentes[key] = registro;
    const aberta = r[8] !== 'Concluído' && r[8] !== 'Não aplicável';
    if (aberta && verificaveis[r[3]] && !detetados[r[3]]) resolvidas.push({ id: r[0], assunto: r[3], linha: PEND.titulos + 1 + i });
  });
  pend.forEach(function (p) {
    const ex = existentes[ref + '|' + p.assunto];
    p.jaExiste = ex ? ex.id : ''; p.linhaExistente = ex ? ex.linha : 0;
    p.reabrir = !!ex && ex.estado === 'Concluído';
  });
  const mudam = campos.filter(function (x) { return String(x.atual) !== String(x.novo); }).length;
  return { ref: ref, linha: linha, campos: campos, pendencias: pend, resolvidas: resolvidas, notas: notas, mudam: mudam, url: d.url || '', hoje: hoje, completa: completa, textos: Object.keys(IDIOMAS).filter(function (k) { return T[k] && !T[k].erro && typeof T[k].descricao === 'string' && typeof T[k].titulo === 'string'; }).map(function (k) { return { idioma: k, titulo: T[k].titulo, descricao: T[k].descricao }; }) };
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
  if(String(texto||'').trim().indexOf('CLARA2:')===0)return gravarIdealista(texto);
  const lock = LockService.getDocumentLock();
  if (!lock.tryLock(30000)) throw new Error('Há outra gravação da Clara em curso. Tenta novamente.');
  let aplicados = [], plano = [];
  try {
    const a = analisar(texto, docs), ss = SpreadsheetApp.getActive(), hoje = dataHoje_();
    const lev = ss.getSheetByName(LEV.nome), ps = ss.getSheetByName(PEND.nome);
    const tx = estrutura_(ss, 'Textos por idioma', ['Referência EGO', 'Idioma', 'Título original', 'Descrição original', 'Origem / evidência', 'Data de recolha', 'Estado da recolha']);
    const hs = estrutura_(ss, 'Registo de alterações', ['Data da alteração', 'Referência EGO', 'Autor', 'Onde foi alterado', 'Campo / assunto', 'Antes', 'Depois / alteração realizada', 'Motivo / fonte', 'Resultado da verificação']);
    const vistos = {}, historico = [], idOperacao = Utilities.getUuid();
    function agendar(sh, linha, col, novo, campo, pendencia, semHistorico) {
      if (!col || linha > sh.getMaxRows()) throw new Error('Sem espaço ou coluna em ' + sh.getName() + '. Não gravei alterações.');
      if (typeof novo === 'string' && novo.length > 50000) throw new Error('O texto excede o limite de uma célula. Não gravei alterações.');
      const cel = sh.getRange(linha, col);
      if (cel.getFormula()) throw new Error('A célula ' + sh.getName() + '!' + cel.getA1Notation() + ' tem uma fórmula. Não gravei alterações.');
      const antes = cel.getValue();
      if (mesmoValor_(antes, novo)) return;
      const key = sh.getName() + '|' + linha + '|' + col;
      if (vistos[key]) throw new Error('Alterações repetidas na mesma célula. Não gravei alterações.');
      vistos[key] = true;
      plano.push({ cel: cel, antes: antes, depois: novo });
      if (!semHistorico) historico.push({ onde: sh.getName(), campo: campo, antes: textoHistorico_(antes), depois: textoHistorico_(novo), pendencia: pendencia || '' });
    }
    function vagas(sh, inicio, quantidade) {
      if (!quantidade) return [];
      const n = sh.getMaxRows() - inicio + 1;
      if (n < quantidade) throw new Error('Sem linhas livres em ' + sh.getName() + '. Não gravei alterações.');
      const rg = sh.getRange(inicio, 1, n, sh.getLastColumn()), values = rg.getValues(), formulas = rg.getFormulas(), livres = [];
      for (let i = 0; i < n && livres.length < quantidade; i++) {
        // Uma linha com fórmulas de conferência pode estar livre para uma pendência.
        const ocupada = values[i].some(function (v, j) { return !celVazia_(v) && !(sh.getName() === PEND.nome && j === 15 && formulas[i][j]); });
        const formula = formulas[i].some(function (v, j) { return !!v && !(sh.getName() === PEND.nome && j === 15); });
        if (!ocupada && !formula) livres.push(inicio + i);
      }
      if (livres.length !== quantidade) throw new Error('Sem linhas livres em ' + sh.getName() + '. Não gravei alterações.');
      return livres;
    }
    a.campos.forEach(function (x) {
      // Estado da verificação é calculado em algumas folhas. Os blocos por verificar
      // acima alimentam essa fórmula; a Clara nunca a substitui por texto.
      if (x.coluna === 'Estado da verificação' && lev.getRange(a.linha, x.col).getFormula()) return;
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
      if (p.jaExiste && !p.reabrir) return;
      const linha = p.reabrir ? p.linhaExistente : livresP[ip++], id = p.reabrir ? p.jaExiste : 'P' + String(++maxId).padStart(4, '0');
      if (p.reabrir) {
        // Mantém a criação, responsável e prioridade; o histórico conserva a resolução anterior.
        [[5, p.evidencia], [6, p.acao], [9, p.sara ? 'A aguardar esclarecimento' : 'Por tratar'], [11, hoje], [12, ''], [13, ''], [15, 'Por verificar']].forEach(function (v) { agendar(ps, linha, v[0], v[1], p.assunto + ' · reabertura (coluna ' + v[0] + ')', id); });
        reabertas.push(id + ' ' + p.assunto);
      } else {
        const values = [id, a.ref, p.tema, p.assunto, p.evidencia, p.acao, p.sara ? 'Por atribuir' : 'Andreia', 'Normal', p.sara ? 'A aguardar esclarecimento' : 'Por tratar', hoje, hoje, '', '', p.onde, 'Por verificar'];
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
    historico.forEach(function (h, i) {
      const dados = { 'Data da alteração': hoje, 'Referência EGO': a.ref, 'ID da pendência': h.pendencia, 'Autor': 'Andreia', 'Onde foi alterado': 'Levantamento', 'Campo / assunto': h.onde + ' · ' + h.campo, 'Antes': h.antes, 'Depois / alteração realizada': h.depois, 'Motivo / fonte': (a.url || 'Leitura da Clara') + ' · operação ' + idOperacao, 'Resultado da verificação': 'Por verificar' };
      Object.keys(dados).forEach(function (nome) { if (hs.col(nome)) agendar(hs.sh, lugares[i], hs.col(nome), dados[nome], '', '', true); });
    });
    // Reconferir todas as células antes da primeira escrita, incluindo vagas e histórico.
    plano.forEach(function (p) { if (p.cel.getFormula() || !mesmoValor_(p.cel.getValue(), p.antes)) throw new Error('Uma célula mudou entretanto. Analisa novamente antes de gravar.'); });
    function escrever(cel, valor) {
      // Preserva texto literal, incluindo números e datas no histórico.
      if (typeof valor === 'string' && valor !== '') cel.setRichTextValue(SpreadsheetApp.newRichTextValue().setText(valor).build());
      else cel.setValue(valor);
    }
    try {
      plano.forEach(function (p) { aplicados.push(p); escrever(p.cel, p.depois); });
      SpreadsheetApp.flush();
      plano.forEach(function (p) { if (p.cel.getFormula() || !mesmoValor_(p.cel.getValue(), p.depois)) throw new Error('A leitura após gravação não corresponde ao valor previsto em '+p.cel.getSheet().getName()+'!'+p.cel.getA1Notation()+'.'); });
    } catch (err) {
      let falhou = false;
      aplicados.reverse().forEach(function (p) { try { escrever(p.cel, p.antes); } catch (e) { falhou = true; } });
      try { SpreadsheetApp.flush(); aplicados.forEach(function(p){if(p.cel.getFormula()||!mesmoValor_(p.cel.getValue(),p.antes))falhou=true;}); } catch (e) { falhou = true; }
      throw new Error(falhou ? 'A gravação falhou e a recuperação ficou incompleta. Confere o histórico de versões do Sheets antes de repetir.' : 'A gravação falhou e as células foram repostas. ' + err.message);
    }
    return { ref: a.ref, escritos: a.campos.filter(function (x) { return String(x.atual) !== String(x.novo); }).length, textos: a.textos.length, historico: historico.length, criadas: criadas, reabertas: reabertas, confirmadas: confirmadas };
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
  return d;
}
function prepararIdealista_(texto, ss) {
  const d=lerIdealista_(texto), sh=ss.getSheetByName('Idealista - recolhas');
  if(sh && sh.getRange(1,1,1,13).getDisplayValues()[0].join('|')!==IDEALISTA_CABECALHOS.join('|'))throw new Error('A estrutura das recolhas Idealista mudou. Não gravei.');
  const assinatura=JSON.stringify({data:String(d.lido||'').slice(0,10),tipo:d.tipo,url:d.url,periodo:d.periodo,filtros:d.filtros,registos:d.registos,cobertura:d.cobertura,paginacao:d.paginacao});
  const hash=Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,assinatura).map(function(b){return('0'+(b&255).toString(16)).slice(-2);}).join('');
  const mapa={},existentes=ss.getSheetByName('Idealista - recolhas');
  if(existentes&&existentes.getLastRow()>1)existentes.getRange(2,6,existentes.getLastRow()-1,2).getDisplayValues().forEach(function(r){if(r[1]&&r[0]){if(mapa[r[1]]&&mapa[r[1]]!==r[0])mapa[r[1]]='';else mapa[r[1]]=r[0];}});
  let duplicada=false;if(sh&&sh.getLastRow()>1)duplicada=sh.getRange(2,11,sh.getLastRow()-1,1).getDisplayValues().some(function(r){return r[0]===hash;});
  const linhas=[],observacao=d.tipo==='zona'?'Comparativo da zona; não associar automaticamente à carteira. '+(d.periodo.etiqueta||'')+(!d.periodo.inicio?'; datas exatas não indicadas na página.':''):'';
  d.registos.forEach(function(r){const ref=r.ref||(d.tipo==='ranking'?mapa[r.id]||'':'');const campos=Object.assign({},r.metricas);['publicacao','rendimento','aviso','posicao'].forEach(function(k){if(r[k]!==undefined&&r[k]!==null&&r[k]!=='')campos[k]=r[k];});Object.keys(campos).forEach(function(k){if(campos[k]===null)return;linhas.push([dataTexto_(String(d.lido).slice(0,10),ss.getSpreadsheetTimeZone()),d.tipo,d.periodo.inicio||'',d.periodo.fim||'',JSON.stringify(d.filtros||[]),ref,r.id||'',k,campos[k],d.cobertura||'Página atual',hash,d.url,observacao]);});});
  if(d.tipo==='lista'&&d.paginacao)linhas.forEach(function(r){r[12]='PAGINACAO:'+JSON.stringify(d.paginacao);});
  if(!linhas.length)throw new Error('Não há indicadores para registar.');
  return {d:d,linhas:linhas,hash:hash,duplicada:duplicada};
}
function analisarIdealista(texto) {
  const p=prepararIdealista_(texto,SpreadsheetApp.getActive());
  return {origem:'idealista',tipo:p.d.tipo,periodo:p.d.periodo,cobertura:p.d.cobertura,filtros:p.d.filtros,quantidade:p.d.registos.length,indicadores:p.linhas.length,duplicada:p.duplicada,amostra:p.d.registos.slice(0,5),estatisticas:p.d.tipo==='geral'?estatisticasIdealista_(p.d.registos[0].metricas):null};
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
    let aviso='';if(p.d.tipo==='geral')try{atualizarDashboardIdealista_(ss);}catch(e){aviso=' A recolha ficou guardada, mas o Dashboard não foi atualizado: '+e.message;}
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
  return 'Estatísticas da carteira\nPeríodo: '+a.periodo.inicio+' a '+a.periodo.fim+'\nFiltros: '+(a.filtros||[]).join(' · ')+'\n\n'+a.estatisticas.map(function(x){return x.nome+': '+formato(x.valor);}).join('\n')+'\n\nTotais do período, não dados por imóvel ou por dia. Os anúncios ativos são o valor atual. Os últimos 2 dias podem sofrer ajustes.\nGuardar no histórico Idealista - recolhas?';
}

// Bloco independente: não soma períodos sobrepostos nem altera os filtros existentes.
function dadosDashboardIdealista_(linhas){
  const lotes={};
  linhas.forEach(function(r,i){if(r[1]!=='geral'||!r[10])return;const id=String(r[10]);let b=lotes[id];if(!b)b=lotes[id]={inicio:String(r[2]),fim:String(r[3]),filtros:String(r[4]),data:r[0],ultima:i,metricas:{}};b.ultima=i;if(typeof r[8]==='number'&&Number.isFinite(r[8]))b.metricas[String(r[7])]=r[8];});
  const periodos={};Object.values(lotes).forEach(function(b){const key=JSON.stringify([b.inicio,b.fim,b.filtros]);if(!periodos[key]||periodos[key].ultima<b.ultima)periodos[key]=b;});
  return Object.values(periodos).sort(function(a,b){return b.ultima-a.ultima;}).slice(0,4);
}
function atualizarDashboardIdealista(){return atualizarDashboardIdealista_(SpreadsheetApp.getActive());}
function atualizarDashboardIdealista_(ss){
  const sh=ss.getSheetByName('Dashboard'),origem=ss.getSheetByName('Idealista - recolhas');
  if(!sh||!origem)return;
  const marca='Idealista: estatísticas',ult=sh.getLastRow(),titulos=sh.getRange(1,1,Math.max(1,ult),1).getDisplayValues(),achadas=[];
  titulos.forEach(function(r,i){if(r[0]===marca)achadas.push(i+1);});if(achadas.length>1)throw new Error('Há blocos Idealista repetidos no Dashboard.');
  const inicio=achadas.length?achadas[0]:Math.max(96,ult+3);if(sh.getMaxRows()<inicio+25)sh.insertRowsAfter(sh.getMaxRows(),inicio+25-sh.getMaxRows());
  const rg=sh.getRange(inicio,1,26,5);
  const valores=rg.getValues(),formulas=rg.getFormulas();
  if(valores[0][0]!==marca&&(valores.some(function(r){return r.some(function(v){return v!=='';});})||formulas.some(function(r){return r.some(Boolean);})))throw new Error('O espaço do bloco Idealista está ocupado. Não alterei o Dashboard.');
  const linhas=origem.getLastRow()>1?origem.getRange(2,1,origem.getLastRow()-1,13).getValues():[],periodos=dadosDashboardIdealista_(linhas);
  const out=Array.from({length:26},function(){return Array(5).fill('');});
  out[0][0]=marca;
  out[1][0]='Até 4 períodos mais recentes. Cada coluna é independente; não somar períodos sobrepostos.';
  out[2][0]='Período';out[3][0]='Recolhido em';out[4][0]='Filtros';
  const nomes=estatisticasIdealista_({});nomes.forEach(function(x,i){out[i+6][0]=x.nome;});
  periodos.forEach(function(p,j){const c=j+1;out[2][c]=p.inicio+' a '+p.fim;out[3][c]=p.data;let f=[];try{f=JSON.parse(p.filtros);}catch(e){f=[p.filtros];}out[4][c]=f.join(' · ');estatisticasIdealista_(p.metricas).forEach(function(x,i){out[i+6][c]=x.valor===null?'Não recolhido':x.valor;});});
  if(!periodos.length)out[2][1]='Ainda sem recolhas gerais';
  out[22][0]='Contactos recebidos incluem clientes e angariação. Emails/mensagens e chamadas detalham os contactos de clientes.';
  out[23][0]='Anúncios ativos: valor no momento da leitura. Não é a média do período nem o inventário completo do eGO.';
  out[24][0]='Os últimos 2 dias podem sofrer ajustes. Séries diárias e evolução face a um período anterior ainda não disponíveis.';
  out[25][0]='Histórico: Idealista - recolhas. Uma nova leitura do mesmo período atualiza esta vista e preserva a anterior no histórico.';
  // Só o bloco reservado é atualizado. Valores históricos permanecem intactos.
  rg.setValues(out).setFontFamily('Arial').setFontSize(10).setVerticalAlignment('middle').setWrap(true);
  sh.getRange(inicio+0,1,1,5).setBackground('#155c53').setFontColor('#ffffff').setFontWeight('bold');
  sh.getRange(inicio+2,1,3,5).setBackground('#e9f0ee').setFontWeight('bold');
  sh.getRange(inicio+6,2,15,4).setNumberFormat('#,##0');sh.getRange(inicio+3,2,1,4).setNumberFormat('yyyy-mm-dd');
  sh.getRange(inicio+1,1,1,5).mergeAcross();sh.getRange(inicio+22,1,4,5).mergeAcross();
  sh.setRowHeight(inicio+0,28);sh.setRowHeight(inicio+1,34);sh.setRowHeights(inicio+2,3,42);sh.setRowHeights(inicio+6,15,30);sh.setRowHeights(inicio+22,4,34);
  SpreadsheetApp.flush();if(sh.getRange(inicio+0,1).getValue()!==marca)throw new Error('Não foi possível conferir o bloco Idealista.');
  const atalho=sh.getRange(6,1);if(!atalho.getValue()||atalho.getValue()==='Idealista: estatísticas ↓')atalho.setFormula('=HYPERLINK("#gid='+sh.getSheetId()+'&range=A'+inicio+'","Idealista: estatísticas ↓")');
  return{periodos:periodos.length,linha:inicio};
}

/* ---------- gerado por scripts/construir-clara.py: não editar à mão ---------- */
const PAINEL_HTML = "<!doctype html>\n<html><head><base target=\"_top\"><meta charset=\"utf-8\">\n<style>\nbody{font-family:Arial,sans-serif;font-size:13px;color:#202124;margin:0;padding:12px}\nh3{font-size:14px;margin:14px 0 6px}\ntextarea{width:100%;height:70px;box-sizing:border-box;font-size:11px}\nselect{font-size:12px;width:100%}\n.doc{display:grid;grid-template-columns:1fr 120px;gap:4px;align-items:center;margin:3px 0}\nbutton{background:#1a73e8;color:#fff;border:0;border-radius:6px;padding:8px 14px;font-size:13px;cursor:pointer;margin-top:8px}\nbutton.sec{background:#fff;color:#1a73e8;border:1px solid #dadce0}\nbutton:disabled{opacity:.5}\ntable{border-collapse:collapse;width:100%;font-size:12px}\ntd{border-bottom:1px solid #eee;padding:4px 2px;vertical-align:top}\n.muda{background:#fff8e1}\n.falta{color:#c5221f;font-weight:bold}\n.ok{color:#188038}\n.p{border-left:3px solid #1a73e8;padding:4px 8px;margin:6px 0;background:#f8f9fa}\n.sara{border-left-color:#f9ab00}\n.erro{color:#c5221f;margin-top:8px}\n.muted{color:#5f6368;font-size:12px}\n</style></head>\n<body>\n<div class=\"muted\">1. No site da Janela ou no Idealista, carrega no marcador <b>Clara</b>.<br>2. Cola aqui (Ctrl+V), revê e guarda.</div>\n<textarea id=\"txt\" placeholder=\"Cola aqui a leitura da Clara\"></textarea>\n<section id=\"blocoDocs\"><h3>Documentos na ficha do EGO</h3>\n<div class=\"muted\">Vê o bloco \"Documentos\" na ficha do imóvel no EGO. \"Está noutra categoria\": o ficheiro existe mas foi carregado no sítio errado (por exemplo, em Outros documentos).</div>\n<div id=\"docs\"></div></section>\n<button id=\"analisar\" onclick=\"analisar()\">Analisar</button>\n<div id=\"erro\" class=\"erro\"></div>\n<div id=\"res\"></div>\n<script>\nconst DOCS=[['caderneta','Caderneta Predial'],['certificado','Certificado Energético'],['contrato','Contrato de Mediação'],['licenca','Licença de Habitação']];\ndocument.getElementById('txt').addEventListener('input',()=>{document.getElementById('blocoDocs').hidden=document.getElementById('txt').value.trim().startsWith('CLARA2:');document.getElementById('res').innerHTML='';});\ndocument.getElementById('docs').innerHTML=DOCS.map(d=>'<div class=\"doc\"><span>'+d[1]+'</span><select id=\"d_'+d[0]+'\"><option value=\"\">Não vi</option><option value=\"sim\">Tem ficheiro</option><option value=\"categoria\">Está noutra categoria</option><option value=\"nao\">Em falta</option><option value=\"na\">Não se aplica</option></select></div>').join('');\nfunction docs(){const o={};DOCS.forEach(d=>o[d[0]]=document.getElementById('d_'+d[0]).value);return o;}\nfunction esc(s){return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;');}\nfunction falhou(e){document.getElementById('erro').textContent=(e&&e.message)||String(e);document.querySelectorAll('button').forEach(b=>b.disabled=false);}\nfunction analisar(){\n  document.getElementById('erro').textContent='';document.getElementById('res').innerHTML='A analisar…';\n  document.getElementById('analisar').disabled=true;\n  google.script.run.withSuccessHandler(mostrar).withFailureHandler(falhou).analisar(document.getElementById('txt').value,docs());\n}\nfunction mostrar(a){\n  document.getElementById('analisar').disabled=false;\n  if(a.origem==='idealista'){\n    document.getElementById('blocoDocs').hidden=true;\n    let h='<h3>Idealista · '+esc(a.tipo)+'</h3><p>'+esc(a.quantidade)+' registos · '+esc(a.indicadores)+' indicadores</p><p>'+esc(a.periodo.inicio||a.periodo.etiqueta||'Sem período: fotografia do estado atual')+(a.periodo.fim?' a '+esc(a.periodo.fim):'')+'</p><p><b>'+esc(a.cobertura)+'</b></p><p class=\"muted\">'+(a.filtros||[]).map(esc).join(' · ')+'</p>';\n    if(a.estatisticas){h+='<table>'+a.estatisticas.map(x=>'<tr><td>'+esc(x.nome)+'</td><td>'+esc(x.valor===null?'Não recolhido':String(x.valor).replace(/\\B(?=(\\d{3})+(?!\\d))/g,' '))+'</td></tr>').join('')+'</table><p class=\"muted\">Totais do período. Não inclui o detalhe por dia ou por imóvel. Anúncios ativos: valor no momento da leitura.</p>';}else{h+='<div class=\"muted\">'+a.amostra.map(r=>esc(r.ref||r.id)+': '+esc(JSON.stringify(r.metricas))).join('<br>')+'</div>';}\n    h+=a.duplicada?'<p>Esta recolha já está guardada. Não será duplicada.</p>':'<p class=\"muted\">Guarda no histórico «Idealista - recolhas». Uma página parcial não substitui a carteira completa. Scores de anúncios não alteram o score do perfil.</p><button onclick=\"gravar()\">Confirmar e guardar</button>';\n    document.getElementById('res').innerHTML=h;return;\n  }\n  let h='<h3>'+esc(a.ref)+' · linha '+a.linha+' do Levantamento</h3>';\n  h+='<table>'+a.campos.map(c=>{const m=String(c.atual)!==String(c.novo);const cls=/Em falta|Formato errado|Categoria errada/.test(c.novo)?'falta':(c.novo==='Preenchido'?'ok':'');return '<tr class=\"'+(m?'muda':'')+'\"><td>'+esc(c.coluna)+'</td><td>'+(m?'<s class=\"muted\">'+esc(c.atual||'vazio')+'</s> ':'')+'<span class=\"'+cls+'\">'+esc(c.novo)+'</span><div class=\"muted\">'+esc(c.motivo)+'</div></td></tr>';}).join('')+'</table>';\n  const novas=a.pendencias.filter(p=>!p.jaExiste), ja=a.pendencias.filter(p=>p.jaExiste&&!p.reabrir), reabertas=a.pendencias.filter(p=>p.reabrir);\n  h+='<h3>Pendências novas ('+novas.length+')</h3>'+(novas.length?novas.map(p=>'<div class=\"p '+(p.sara?'sara':'')+'\"><b>'+esc(p.assunto)+'</b><div class=\"muted\">'+(p.sara?'Pergunta para a Sara':'Para ti (operacional)')+' · '+esc(p.acao)+'</div></div>').join(''):'<div class=\"muted\">Nenhuma.</div>');\n  if(reabertas.length)h+='<h3>Falhas que reapareceram ('+reabertas.length+')</h3>'+reabertas.map(p=>'<div class=\"p\"><b>'+esc(p.jaExiste+' '+p.assunto)+'</b><div class=\"muted\">Reabrir a mesma pendência; a resolução anterior fica no histórico.</div></div>').join('');\n  if(a.resolvidas&&a.resolvidas.length)h+='<h3>Correções confirmadas ('+a.resolvidas.length+')</h3>'+a.resolvidas.map(r=>'<div class=\"p\" style=\"border-left-color:#188038\"><b>'+esc(r.id+' '+r.assunto)+'</b><div class=\"muted\">Já não aparece no site: passa a Concluído e Confirmado.</div></div>').join('');\n  if(ja.length)h+='<div class=\"muted\">Já registadas: '+ja.map(p=>esc(p.jaExiste+' '+p.assunto)).join('; ')+'</div>';\n  if(a.notas.length)h+='<div class=\"muted\">'+a.notas.map(esc).join('<br>')+'</div>';\n  h+='<p class=\"muted\">'+(a.completa?'Levantamento completo.':'Leitura incompleta: o imóvel fica em curso.')+' Textos e alterações ficam registados no Sheet.</p>';\n  h+='<button onclick=\"gravar()\">Confirmar e gravar no Sheet</button> <button class=\"sec\" onclick=\"document.getElementById(\\'res\\').innerHTML=\\'\\'\">Cancelar</button>';\n  document.getElementById('res').innerHTML=h;\n}\nfunction gravar(){\n  document.querySelectorAll('button').forEach(b=>b.disabled=true);\n  google.script.run.withSuccessHandler(r=>{if(r.origem==='idealista'){document.getElementById('res').innerHTML='<p class=\"ok\">'+(r.duplicada?'Esta recolha já estava guardada.':'Gravado: '+esc(r.quantidade)+' registos e '+esc(r.escritos)+' indicadores.')+'</p><p>'+esc(r.cobertura||'')+'</p>';}else{document.getElementById('res').innerHTML='<p class=\"ok\"><b>Gravado.</b> '+esc(r.ref)+': '+r.escritos+' campos atualizados; '+r.textos+' idiomas registados; '+r.historico+' alterações no histórico'+(r.reabertas&&r.reabertas.length?'; reabertas: '+r.reabertas.map(esc).join(', '):'')+(r.criadas.length?'; pendências criadas: '+r.criadas.map(esc).join(', '):'; nenhuma pendência nova')+(r.confirmadas&&r.confirmadas.length?'; correções confirmadas: '+r.confirmadas.map(esc).join(', '):'')+'.</p>';}document.getElementById('txt').value='';document.querySelectorAll('button').forEach(b=>b.disabled=false);}).withFailureHandler(falhou).gravar(document.getElementById('txt').value,docs());\n}\n</script>\n</body></html>\n";
const LISTA_HTML = "<!doctype html>\n<html><head><base target=\"_top\"><meta charset=\"utf-8\">\n<style>\nbody{font-family:Arial,sans-serif;font-size:13px;color:#202124;margin:0;padding:12px}\nh3{font-size:14px;margin:16px 0 6px}\n.muted{color:#5f6368;font-size:12px}\n.barra{background:#e8eaed;border-radius:4px;height:8px;margin:4px 0 2px}\n.barra div{background:#188038;height:8px;border-radius:4px}\n.item{border-left:3px solid #1a73e8;background:#f8f9fa;padding:6px 8px;margin:6px 0}\n.item.sara{border-left-color:#f9ab00}\n.item b{cursor:pointer;color:#1a73e8}\n.item ul{margin:4px 0 0 16px;padding:0}\na{color:#1a73e8}\nbutton{background:#fff;color:#1a73e8;border:1px solid #dadce0;border-radius:6px;padding:6px 12px;font-size:12px;cursor:pointer;margin-top:8px}\n</style></head>\n<body>\n<div id=\"out\">A carregar…</div>\n<button onclick=\"carregar()\">Atualizar</button>\n<script>\nfunction esc(s){return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;');}\nfunction ir(sep,l){google.script.run.irPara(sep,l);}\nfunction liga(u){return u?' · <a href=\"'+esc(u)+'\" target=\"_blank\">página pública</a>':'';}\nfunction barra(a,b,t){const p=b?Math.round(100*a/b):0;return '<div>'+t+': <b>'+a+' de '+b+'</b></div><div class=\"barra\"><div style=\"width:'+p+'%\"></div></div>';}\nfunction mostrar(d){\n  let h='<h3>Progresso</h3>'+barra(d.contagem['Prioritária'][0],d.contagem['Prioritária'][1],'Prioritários verificados')+barra(d.verificados,d.total,'Todos os imóveis verificados');\n  h+='<h3>1. Prioritários por verificar ('+d.prioritarios.length+')</h3>';\n  h+=d.prioritarios.length?d.prioritarios.map(im=>'<div class=\"item\"><b onclick=\"ir(\\'Levantamento\\','+im.linha+')\">'+esc(im.ref)+'</b> · '+esc(im.natureza)+' · '+esc(im.concelho)+liga(im.url)+'</div>').join(''):'<div class=\"muted\">Todos verificados.</div>';\n  h+='<h3>2. As tuas pendências ('+d.minhas.reduce((n,x)=>n+x.pendencias.length,0)+' em '+d.minhas.length+' imóveis)</h3>';\n  h+=d.minhas.length?d.minhas.map(im=>'<div class=\"item\"><b onclick=\"ir(\\'Pendências da equipa\\','+im.pendencias[0].linha+')\">'+esc(im.ref)+'</b> '+(im.prioridade==='Prioritária'?'· prioritário':'')+liga(im.url)+'<ul>'+im.pendencias.map(p=>'<li>'+esc(p.assunto)+'<div class=\"muted\">'+esc(p.acao)+'</div></li>').join('')+'</ul></div>').join(''):'<div class=\"muted\">Nenhuma.</div>';\n  h+='<h3>3. À espera da Sara ('+d.sara.length+')</h3>';\n  h+=d.sara.length?d.sara.map(p=>'<div class=\"item sara\"><b onclick=\"ir(\\'Pendências da equipa\\','+p.linha+')\">'+esc(p.ref)+'</b> · '+esc(p.assunto)+'</div>').join(''):'<div class=\"muted\">Nenhuma.</div>';\n  h+='<h3>4. Perfis dos portais ('+d.perfis.length+')</h3>';\n  h+=d.perfis.length?d.perfis.map(p=>'<div class=\"item\"><b onclick=\"ir(\\''+(p.origem==='Perfis dos portais'?'Perfis dos portais':'Pendências da equipa')+'\\','+p.linha+')\">'+esc(p.portal)+'</b> · '+esc(p.assunto)+(p.url?' · <a href=\"'+esc(p.url)+'\" target=\"_blank\">perfil</a>':'')+'<div class=\"muted\">'+esc(p.estado)+': '+esc(p.acao)+'</div></div>').join(''):'<div class=\"muted\">Nada em aberto.</div>';\n  if(!d.prioritarios.length&&d.altaTotal)h+='<h3>Depois: prioridade Alta por verificar ('+d.altaTotal+')</h3>'+d.alta.map(im=>'<div class=\"item\"><b onclick=\"ir(\\'Levantamento\\','+im.linha+')\">'+esc(im.ref)+'</b> · '+esc(im.natureza)+' · '+esc(im.concelho)+liga(im.url)+'</div>').join('');\n  h+='<p class=\"muted\">Carrega numa referência para ir à linha no Sheet.</p>';\n  document.getElementById('out').innerHTML=h;\n}\nfunction carregar(){document.getElementById('out').textContent='A carregar…';google.script.run.withSuccessHandler(mostrar).withFailureHandler(e=>document.getElementById('out').textContent=e.message).listaTrabalho();}\ncarregar();\n</script>\n</body></html>\n";
const RESUMO_HTML = "<!doctype html>\n<html><head><base target=\"_top\"><meta charset=\"utf-8\">\n<style>\nbody{font-family:Arial,sans-serif;font-size:13px;color:#202124;margin:0;padding:12px}\nlabel{display:block;font-size:12px;color:#5f6368;margin-top:8px}\nselect,input{width:100%;box-sizing:border-box;font-size:13px;padding:4px}\nbutton{background:#1a73e8;color:#fff;border:0;border-radius:6px;padding:8px 12px;font-size:13px;cursor:pointer;margin:8px 6px 0 0}\nbutton.sec{background:#fff;color:#1a73e8;border:1px solid #dadce0}\n#prev{border:1px solid #dadce0;border-radius:6px;padding:8px;margin-top:10px;font-size:12px;max-height:420px;overflow:auto;background:#fff}\n.ok{color:#188038;margin-top:8px}.muted{color:#5f6368;font-size:12px}\n</style></head>\n<body>\n<label>Período</label>\n<select id=\"dias\" onchange=\"ver()\"><option value=\"7\">Últimos 7 dias</option><option value=\"14\">Últimos 14 dias</option><option value=\"30\">Últimos 30 dias</option></select>\n<label>Assunto</label><input id=\"assunto\" readonly onclick=\"this.select()\">\n<button class=\"sec\" onclick=\"copiarAssunto()\">Copiar assunto</button><button onclick=\"copiarEmail()\">Copiar email</button>\n<div id=\"msg\" class=\"ok\"></div>\n<div id=\"prev\">A preparar…</div>\n<p class=\"muted\">Abre o webmail da Janela (janela.pt/webmail), cria uma mensagem para a Sara com a Júlia em Cc, cola o assunto e o email (Ctrl+V). Revê e envia tu.</p>\n<script>\nfunction ver(){document.getElementById('prev').textContent='A preparar…';google.script.run.withSuccessHandler(r=>{document.getElementById('prev').innerHTML=r.html;document.getElementById('assunto').value=r.assunto;}).withFailureHandler(e=>document.getElementById('prev').textContent=e.message).previewResumo(+document.getElementById('dias').value);}\nfunction aviso(t){const m=document.getElementById('msg');m.textContent=t;setTimeout(()=>m.textContent='',4000);}\nfunction copiarAssunto(){const i=document.getElementById('assunto');i.select();document.execCommand('copy');aviso('Assunto copiado.');}\nfunction copiarEmail(){const el=document.getElementById('prev');const r=document.createRange();r.selectNodeContents(el);const s=window.getSelection();s.removeAllRanges();s.addRange(r);const ok=document.execCommand('copy');s.removeAllRanges();aviso(ok?'Email copiado, com a tabela. Cola no webmail.':'Não consegui copiar: seleciona o texto acima e usa Ctrl+C.');}\nver();\n</script>\n</body></html>\n";
const MARCADOR_JS = "(async () => { function recolherIdealista(doc, contexto) { const txt = e => e ? e.textContent.replace(/\\s+/g, ' ').trim() : ''; const numero = s => /^\\d[\\d .]*%?$/.test(String(s).trim()) ? Number(String(s).replace(/[ .%]/g, '')) : null; const visivel = e => !!e && !e.hidden && (!e.getClientRects || e.getClientRects().length > 0); const body = (doc.body.innerText || doc.body.textContent).replace(/\\s+/g, ' ').trim(); const data = s => { const m = /^(\\d{2})\\/(\\d{2})\\/(\\d{4})$/.exec(s || ''); return m ? m[3]+'-'+m[2]+'-'+m[1] : null; }; const out = {v:2,origem:'idealista',tipo:'',lido:contexto.lido,url:contexto.url,periodo:{inicio:null,fim:null},filtros:[],cobertura:'Parcial: apenas a página aberta',registos:[]}; out.filtros = Array.from(doc.querySelectorAll('a.actived, a.active, button.dropdown-wrapper .placeholder')).filter(visivel).map(txt).filter(s=>s && s.length<80 && !/[-錄]/.test(s)).filter((s,i,a)=>a.indexOf(s)===i); const relativo=out.filtros.find(s=>/^(Hoje|7 dias|30 dias|90 dias)$/.test(s)); if(relativo)out.periodo.etiqueta=relativo; const dates = /de (\\d{2}\\/\\d{2}\\/\\d{4}) até (\\d{2}\\/\\d{2}\\/\\d{4})/.exec(body); if (dates) Object.assign(out.periodo,{inicio:data(dates[1]),fim:data(dates[2])}); const contact = doc.querySelector('a[href*=\"fromDate=\"][href*=\"toDate=\"]'); if(contact){const u=new URL(contact.getAttribute('href'),contexto.url);Object.assign(out.periodo,{inicio:data(u.searchParams.get('fromDate')),fim:data(u.searchParams.get('toDate'))});} if (/\\/tools\\/listadostarter/.test(contexto.url)) { out.tipo='lista'; out.filtros=Array.from(doc.querySelectorAll('a.icon-arrow-dropdown')).filter(visivel).map(txt).filter(Boolean); const pesquisa=doc.querySelector('input[placeholder=\"Referência, rua, localidade, etc...\"]');if(pesquisa&&pesquisa.value.trim())out.filtros.push('Pesquisa: '+pesquisa.value.trim()); if(!out.filtros.length)out.filtros=['Filtros da lista não identificados']; const params=new URL(contexto.url).searchParams; const pagina=params.get('CurrentPage'); const total=/Imóveis ativos\\s*\\(([\\d .]+)\\)/i.exec(body); out.paginacao={pagina:Number(pagina)||1,porPagina:Number(params.get('ItemsPerPage'))||20,totalAtivos:total?numero(total[1]):null,ordem:(params.get('OrderedBy')||'')+' '+(params.get('OrderedType')||'')};if(pagina&&/^\\d+$/.test(pagina))out.cobertura+=' · página '+pagina; out.registos=Array.from(doc.querySelectorAll('ul.row[data-key]')).filter(visivel).map(r=>{ const cols=Array.from(r.children), ref=txt(r.querySelector('.exteral-ref')).replace(/^Ref\\s+/,''); return {id:r.getAttribute('data-key'),ref:ref,metricas:{qualidade:numero(txt(r.querySelector('.quality-info-col svg text')))},publicacao:cols[8]?cols[8].innerText.trim():'',rendimento:cols[10]?cols[10].innerText.trim():'',aviso:Array.from(r.querySelectorAll('[title]')).some(e=>e.getAttribute('title')==='Validação pendente')?'Validação pendente':''}; }); } else if (/\\/stats\\/rank\\/neighborhood/.test(contexto.url) || Array.from(doc.querySelectorAll('h2')).filter(visivel).some(e=>/^ranking\\s/i.test(txt(e)))) { out.tipo=/\\/stats\\/rank\\/neighborhood/.test(contexto.url)?'zona':'ranking'; out.registos=Array.from(doc.querySelectorAll('table tr')).filter(visivel).map(r=>{ const c=Array.from(r.querySelectorAll('td')); if(c.length!==9)return null; const a=r.querySelector('a[href*=\"/tools/propiedad/\"],a[href*=\"/imovel/\"]'), m=a&&/\\/(?:propiedad|imovel)\\/(\\d+)/.exec(a.getAttribute('href')); const n=c.slice(2).map(e=>numero(txt(e)));if(n.some(x=>x===null))return null; return {id:m?m[1]:'',ref:'',posicao:numero(txt(c[0])),metricas:{visitasListas:n[0],visitasDetalhes:n[1],partilhas:n[2],alertas:n[3],favoritos:n[4],chamadas:n[5],mensagens:n[6]}}; }).filter(Boolean); if(out.tipo==='zona')out.cobertura='Comparativo da zona: apenas os resultados visíveis; não é a carteira da agência'; } else if (/\\/stats\\/loadImpactStats/.test(contexto.url)) { out.tipo='geral';out.cobertura='Totais visíveis da carteira no período e filtros selecionados'; const metricas={}, labels={visitasTotais:'visitas totais',acoes:'ações em anúncios',visitasListas:'visitas nas listas',visitasDetalhes:'visitas em detalhes',agenciaOnline:'agência online',partilhas:'enviado aos amigos',alertas:'envios em alertas',favoritos:'favoritos',clientes:'de cliente',angariacao:'de angariação',mensagens:'emails e/ou mensagens',chamadas:'chamadas'}; Object.keys(labels).forEach(k=>{for(const e of doc.querySelectorAll('td')){const t=txt(e),m=new RegExp('^([0-9][0-9 .]*) '+labels[k].replace(/[.*+?^${}()|[\\]\\\\]/g,'\\\\$&')+'(?: |$)').exec(t);if(m){metricas[k]=numero(m[1]);break;}}}); const total=/([\\d .]+) impactos \\(Soma/.exec(body), contactos=/([\\d .]+) contactos recebidos/.exec(body), ativos=/([\\d .]+) anúncios ativos hoje/.exec(body); if(total)metricas.impactos=numero(total[1].trim());if(contactos)metricas.contactos=numero(contactos[1].trim());if(ativos)metricas.anunciosAtivosHoje=numero(ativos[1].trim()); if(Object.keys(metricas).length)out.registos=[{id:'carteira',ref:'',metricas:metricas}]; } if(!out.tipo || !out.registos.length)throw new Error('Abre a lista de imóveis, o gráfico ou o ranking do Idealista e espera que os dados terminem de carregar.'); if(out.tipo!=='lista' && (!out.periodo.inicio||!out.periodo.fim))out.cobertura+=out.tipo==='zona'&&relativo?' · '+relativo+'; datas exatas não indicadas nesta página':' · Período por confirmar antes de guardar'; return out; } const fim = (txt, ref) => { navigator.clipboard.writeText(txt).then(() => alert('Clara: ' + (ref || 'imóvel') + ' lido. No Sheet: Clara > eGO: estado e cola (Ctrl+V).'), () => prompt('Clara: copia este texto (Ctrl+C) e cola no painel da Clara no Sheet:', txt)); }; if (/^(?:www\\.)?idealista\\.pt$/.test(location.hostname)) { try { const d=recolherIdealista(document,{url:location.href,lido:new Date().toISOString()}); const t='CLARA2:'+JSON.stringify(d); try {await navigator.clipboard.writeText(t);alert('Clara: '+d.registos.length+' registos recolhidos. '+d.cobertura+'. No Sheet: Clara > Idealista: estatísticas.');} catch(e){prompt('Clara: copia este texto e usa Clara > Idealista: estatísticas no Google Sheets.',t);} } catch(e){alert('Clara: '+e.message);} return; } if (!/^(?:www\\.)?janela-imobiliaria\\.com$/.test(location.hostname)) { alert('Clara: abre a página pública do imóvel no site da Janela ou a lista/estatísticas no Idealista.'); return; } const ld = d => { for (const s of d.querySelectorAll('script[type=\"application/ld+json\"]')) { try { const j = JSON.parse(s.textContent); if (j['@type'] === 'RealEstateListing') return j; } catch (e) {} } return null; }; const me = ld(document); if (!me) { alert('Clara: esta página não parece ser a ficha de um imóvel.'); return; } const ext = x => ((JSON.stringify(x).match(/\\.(pdf|jpe?g|png|webp|gif)\\b/i) || [])[1] || '?').toLowerCase().replace('jpeg', 'jpg'); const out = { v: 1, origem: 'site', lido: new Date().toISOString(), url: location.href.split('?')[0], ref: null, textos: {} }; let p = null; const u = performance.getEntriesByType('resource').map(e => e.name).find(n => /websiteapi\\.egorealestate\\.com\\/v1\\/Properties\\/\\d+\\?.*propertyid=/.test(n)); if (u) { try { p = await (await fetch(u, { cache: 'no-store' })).json(); } catch (e) {} } if (p && p.Reference) { const I = p.Images || []; Object.assign(out, { ref: p.Reference, alterado: p.LastModified, fotos: I.length, fotosComAlt: I.filter(i => (i.AlternativeText || '').trim()).length, fotosComLegenda: I.filter(i => (i.Description || '').trim()).length, plantas: (p.BluePrints || []).map(ext), videos: (p.Videos || []).length, visitaVirtual: !!(p.HasVirtualTour || (p.VirtualTours || []).length || (p.ExternalVirtualTours || []).length), fotos360: (p.Photos360 || []).length, folhetos: (p.Brochures || []).length, caracteristicas: (p.Features || []).reduce((n, g) => n + ((g.Childs || []).length), 0), classeEnergetica: p.EnergyCertification || '' }); } else { const html = document.documentElement.outerHTML; const ids = t => new Set(html.match(new RegExp('/T' + t + '/ID[0-9a-f-]+', 'g')) || []).size; const r = (document.querySelector('.detailContainer') || document.body).textContent.match(/Ref\\.\\s*([A-Z]{2,5}\\d+)/); Object.assign(out, { ref: r && r[1], parcial: true, fotos: ids('photo'), fotos360: ids('panoramic'), folhetos: ids('brochure'), plantas: [...new Set(html.match(/\\/Tblueprint\\/ID[0-9a-f-]+\\.\\w+/g) || [])].map(s => s.split('.').pop().toLowerCase()), videos: document.querySelector('#videoTab.propertyMediaDisabled') ? 0 : null }); } for (const l of document.querySelectorAll('link[rel=alternate][hreflang]')) { if (l.hreflang === 'x-default') continue; const k = l.hreflang.slice(0, 2).toUpperCase(); try { const j = ld(new DOMParser().parseFromString(await (await fetch(l.href, { cache: 'no-store' })).text(), 'text/html')) || {}; out.textos[k] = { titulo: j.name || '', descricao: j.description || '' }; } catch (e) { out.textos[k] = { erro: true }; } } if (!out.textos.PT) out.textos.PT = { titulo: me.name || '', descricao: me.description || '' }; fim('CLARA1:' + JSON.stringify(out), out.ref); })();";
