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
    .addItem('Analisar imóvel', 'abrirPainel')
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
    '<p><b>2.</b> Na página pública do imóvel no site da Janela, carrega no marcador <b>Clara</b>.</p>' +
    '<p><b>3.</b> Aqui no Sheet: <b>Clara &gt; Analisar imóvel</b> e cola (Ctrl+V).</p></div>';
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
function mesmoValor_(a, b) { return a instanceof Date && b instanceof Date ? a.getTime() === b.getTime() : a === b; }
function textoHistorico_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, SpreadsheetApp.getActive().getSpreadsheetTimeZone(), 'dd/MM/yyyy');
  return v == null ? '' : String(v);
}
function gravar(texto, docs) {
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
      if (typeof valor === 'string' && valor.charAt(0) === '=') cel.setRichTextValue(SpreadsheetApp.newRichTextValue().setText(valor).build());
      else cel.setValue(valor);
    }
    try {
      plano.forEach(function (p) { aplicados.push(p); escrever(p.cel, p.depois); });
      SpreadsheetApp.flush();
      plano.forEach(function (p) { if (p.cel.getFormula() || !mesmoValor_(p.cel.getValue(), p.depois)) throw new Error('A leitura após gravação não corresponde ao valor previsto.'); });
    } catch (err) {
      let falhou = false;
      aplicados.reverse().forEach(function (p) { try { escrever(p.cel, p.antes); } catch (e) { falhou = true; } });
      try { SpreadsheetApp.flush(); } catch (e) { falhou = true; }
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
