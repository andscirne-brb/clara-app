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
    .addItem('Próximos imóveis', 'abrirLista')
    .addItem('Analisar imóvel', 'abrirPainel')
    .addItem('Resumo semanal para a Sara', 'abrirResumo')
    .addItem('Instalar o marcador', 'mostrarMarcador')
    .addToUi();
}

function abrirPainel() {
  SpreadsheetApp.getUi().showSidebar(HtmlService.createHtmlOutput(PAINEL_HTML).setTitle('Clara'));
}

function abrirLista() {
  SpreadsheetApp.getUi().showSidebar(HtmlService.createHtmlOutput(LISTA_HTML).setTitle('Clara · próximos imóveis'));
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
  ps.getRange(PEND.titulos + 1, 1, 300, 17).getDisplayValues().forEach(function (r, i) {
    if (!r[1] || r[8] === 'Concluído' || r[8] === 'Não aplicável') return;
    const p = { id: r[0], ref: r[1], tema: r[2], assunto: r[3], acao: r[5], estado: r[8], linha: PEND.titulos + 1 + i };
    if (r[6] === 'Andreia') { (minhas[r[1]] = minhas[r[1]] || []).push(p); }
    else if (r[16] === 'Sara') sara.push(p);
  });
  const minhasLista = Object.keys(minhas).map(function (ref) { const im = imoveis[ref] || { ref: ref }; return { ref: ref, url: im.url || '', prioridade: im.prioridade || '', natureza: im.natureza || '', pendencias: minhas[ref] }; });
  const ordem = { 'Prioritária': 0, 'Alta': 1, 'Normal': 2 };
  const o = function (x) { return x.prioridade in ordem ? ordem[x.prioridade] : 3; };
  minhasLista.sort(function (a, b) { return o(a) - o(b) || b.pendencias.length - a.pendencias.length; });
  return { total: total, verificados: verificados, contagem: contagem, prioritarios: porVerificar['Prioritária'], alta: porVerificar['Alta'].slice(0, 15), altaTotal: porVerificar['Alta'].length, minhas: minhasLista, sara: sara };
}

/* ---------- resumo semanal: a Clara prepara, a Andreia copia para o webmail da Janela e envia ---------- */
function abrirResumo() {
  SpreadsheetApp.getUi().showSidebar(HtmlService.createHtmlOutput(RESUMO_HTML).setTitle('Clara · resumo semanal'));
}
function dataDe_(txt) { const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(String(txt || '')); return m ? new Date(+m[3], +m[2] - 1, +m[1]) : null; }
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
    if (r[iRef] && iData >= 0 && dentro(r[iData])) im(r[iRef]).trabalho.push('Anúncio verificado (' + r[iData] + ').');
  });
  // Pendências
  let corrigidas = 0, novas = 0, aSara = 0;
  ss.getSheetByName(PEND.nome).getRange(PEND.titulos + 1, 1, 300, 17).getDisplayValues().forEach(function (r) {
    if (!r[1]) return;
    const fechada = r[8] === 'Concluído' || r[8] === 'Não aplicável';
    if (fechada && dentro(r[12])) { im(r[1]).trabalho.push((r[8] === 'Concluído' ? 'Corrigido: ' : 'Não aplicável: ') + r[3] + '.'); corrigidas++; }
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
    campos.push({ coluna: coluna, col: k, atual: atual[k - 1], novo: valor, motivo: motivo || '' });
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
    if (t && t.erro) { prop('Descrição ' + k, 'Não foi possível verificar', falta); return; }
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
  if (d.url && c.col('Página pública')) prop('Página pública', d.url, 'ligação ao anúncio no site');
  if (c.col('Data da verificação')) prop('Data da verificação', hoje, '');
  if (c.col('Estado da verificação')) prop('Estado da verificação', 'Verificado', '');
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
  if (d.plantas) { pode('Imóvel sem planta'); pode('Planta só em PDF'); }
  const todosVistos = docs && DOCS.every(function (x) { return !!docs[x[0]]; });
  if (todosVistos && emFalta.length === 0) pode('Documentos obrigatórios sem ficheiro no eGO');
  if (todosVistos && noutra.length === 0) pode('Documentos na categoria errada no eGO');
  const detetados = {}; pend.forEach(function (p) { detetados[p.assunto] = true; });

  // Pendências já existentes: não duplicar e confirmar as que foram corrigidas
  const ps = SpreadsheetApp.getActive().getSheetByName(PEND.nome);
  const existentes = {}, resolvidas = [];
  ps.getRange(PEND.titulos + 1, 1, 300, 9).getDisplayValues().forEach(function (r, i) {
    if (!r[1] || r[1].toUpperCase() !== ref) return;
    existentes[r[1].toUpperCase() + '|' + r[3]] = r[0];
    const aberta = r[8] !== 'Concluído' && r[8] !== 'Não aplicável';
    if (aberta && verificaveis[r[3]] && !detetados[r[3]]) resolvidas.push({ id: r[0], assunto: r[3], linha: PEND.titulos + 1 + i });
  });
  pend.forEach(function (p) { p.jaExiste = existentes[ref + '|' + p.assunto] || ''; });
  const mudam = campos.filter(function (x) { return String(x.atual) !== String(x.novo); }).length;
  return { ref: ref, linha: linha, campos: campos, pendencias: pend, resolvidas: resolvidas, notas: notas, mudam: mudam, url: d.url || '', hoje: hoje };
}

/* ---------- gravar (só depois de a Andreia confirmar) ---------- */
function gravar(texto, docs) {
  const a = analisar(texto, docs);
  const sh = SpreadsheetApp.getActive().getSheetByName(LEV.nome);
  let escritos = 0;
  a.campos.forEach(function (x) {
    const cel = sh.getRange(a.linha, x.col);
    if (cel.getFormula()) return; // nunca escrever por cima de fórmulas
    if (String(x.atual) === String(x.novo)) return;
    cel.setValue(x.coluna === 'Data da verificação' ? dataHoje_() : x.novo); escritos++;
  });
  const ps = SpreadsheetApp.getActive().getSheetByName(PEND.nome);
  const v = ps.getRange(PEND.titulos + 1, 1, 300, 4).getDisplayValues();
  let maxId = 0, livre = -1;
  v.forEach(function (r, i) { const m = /^P(\d+)$/.exec(r[0]); if (m) maxId = Math.max(maxId, +m[1]); if (livre < 0 && !r[0] && !r[1] && !r[3]) livre = i; });
  const criadas = [];
  let linha = PEND.titulos + 1 + livre;
  a.pendencias.forEach(function (p) {
    if (p.jaExiste) return;
    if (livre < 0) throw new Error('Sem linhas livres em Pendências da equipa.');
    maxId++; const id = 'P' + ('000' + maxId).slice(-4); const hoje = dataHoje_();
    ps.getRange(linha, 1, 1, 15).setValues([[id, a.ref, p.tema, p.assunto, p.evidencia, p.acao, p.sara ? 'Por atribuir' : 'Andreia', 'Normal', p.sara ? 'A aguardar esclarecimento' : 'Por tratar', hoje, hoje, '', '', p.onde, 'Por verificar']]);
    ps.getRange(linha, 17).setValue(p.sara ? 'Sara' : '');
    criadas.push(id + ' ' + p.assunto); linha++;
  });
  // Confirmar correções: Concluído + Confirmado, com data (a coluna Conferência exige resposta, data e confirmação)
  const confirmadas = [];
  a.resolvidas.forEach(function (r) {
    const hoje = dataHoje_();
    ps.getRange(r.linha, 9).setValue('Concluído');
    ps.getRange(r.linha, 11).setValue(hoje);
    ps.getRange(r.linha, 12).setValue('Corrigido: confirmado pela Clara na leitura do site de ' + a.hoje + '.');
    ps.getRange(r.linha, 13).setValue(hoje);
    ps.getRange(r.linha, 15).setValue('Confirmado');
    confirmadas.push(r.id + ' ' + r.assunto);
  });
  return { ref: a.ref, escritos: escritos, criadas: criadas, confirmadas: confirmadas };
}

/* ---------- gerado por scripts/construir-clara.py: não editar à mão ---------- */
const PAINEL_HTML = "<!doctype html>\n<html><head><base target=\"_top\"><meta charset=\"utf-8\">\n<style>\nbody{font-family:Arial,sans-serif;font-size:13px;color:#202124;margin:0;padding:12px}\nh3{font-size:14px;margin:14px 0 6px}\ntextarea{width:100%;height:70px;box-sizing:border-box;font-size:11px}\nselect{font-size:12px;width:100%}\n.doc{display:grid;grid-template-columns:1fr 120px;gap:4px;align-items:center;margin:3px 0}\nbutton{background:#1a73e8;color:#fff;border:0;border-radius:6px;padding:8px 14px;font-size:13px;cursor:pointer;margin-top:8px}\nbutton.sec{background:#fff;color:#1a73e8;border:1px solid #dadce0}\nbutton:disabled{opacity:.5}\ntable{border-collapse:collapse;width:100%;font-size:12px}\ntd{border-bottom:1px solid #eee;padding:4px 2px;vertical-align:top}\n.muda{background:#fff8e1}\n.falta{color:#c5221f;font-weight:bold}\n.ok{color:#188038}\n.p{border-left:3px solid #1a73e8;padding:4px 8px;margin:6px 0;background:#f8f9fa}\n.sara{border-left-color:#f9ab00}\n.erro{color:#c5221f;margin-top:8px}\n.muted{color:#5f6368;font-size:12px}\n</style></head>\n<body>\n<div class=\"muted\">1. Na página pública do imóvel, carrega no marcador <b>Clara</b>.<br>2. Cola aqui (Ctrl+V).</div>\n<textarea id=\"txt\" placeholder=\"Cola aqui a leitura da Clara\"></textarea>\n<h3>Documentos na ficha do EGO</h3>\n<div class=\"muted\">Vê o bloco \"Documentos\" na ficha do imóvel no EGO. \"Está noutra categoria\": o ficheiro existe mas foi carregado no sítio errado (por exemplo, em Outros documentos).</div>\n<div id=\"docs\"></div>\n<button id=\"analisar\" onclick=\"analisar()\">Analisar</button>\n<div id=\"erro\" class=\"erro\"></div>\n<div id=\"res\"></div>\n<script>\nconst DOCS=[['caderneta','Caderneta Predial'],['certificado','Certificado Energético'],['contrato','Contrato de Mediação'],['licenca','Licença de Habitação']];\ndocument.getElementById('docs').innerHTML=DOCS.map(d=>'<div class=\"doc\"><span>'+d[1]+'</span><select id=\"d_'+d[0]+'\"><option value=\"\">Não vi</option><option value=\"sim\">Tem ficheiro</option><option value=\"categoria\">Está noutra categoria</option><option value=\"nao\">Em falta</option><option value=\"na\">Não se aplica</option></select></div>').join('');\nfunction docs(){const o={};DOCS.forEach(d=>o[d[0]]=document.getElementById('d_'+d[0]).value);return o;}\nfunction esc(s){return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;');}\nfunction falhou(e){document.getElementById('erro').textContent=(e&&e.message)||String(e);document.querySelectorAll('button').forEach(b=>b.disabled=false);}\nfunction analisar(){\n  document.getElementById('erro').textContent='';document.getElementById('res').innerHTML='A analisar…';\n  document.getElementById('analisar').disabled=true;\n  google.script.run.withSuccessHandler(mostrar).withFailureHandler(falhou).analisar(document.getElementById('txt').value,docs());\n}\nfunction mostrar(a){\n  document.getElementById('analisar').disabled=false;\n  let h='<h3>'+esc(a.ref)+' · linha '+a.linha+' do Levantamento</h3>';\n  h+='<table>'+a.campos.map(c=>{const m=String(c.atual)!==String(c.novo);const cls=/Em falta|Formato errado|Categoria errada/.test(c.novo)?'falta':(c.novo==='Preenchido'?'ok':'');return '<tr class=\"'+(m?'muda':'')+'\"><td>'+esc(c.coluna)+'</td><td>'+(m?'<s class=\"muted\">'+esc(c.atual||'vazio')+'</s> ':'')+'<span class=\"'+cls+'\">'+esc(c.novo)+'</span><div class=\"muted\">'+esc(c.motivo)+'</div></td></tr>';}).join('')+'</table>';\n  const novas=a.pendencias.filter(p=>!p.jaExiste), ja=a.pendencias.filter(p=>p.jaExiste);\n  h+='<h3>Pendências novas ('+novas.length+')</h3>'+(novas.length?novas.map(p=>'<div class=\"p '+(p.sara?'sara':'')+'\"><b>'+esc(p.assunto)+'</b><div class=\"muted\">'+(p.sara?'Pergunta para a Sara':'Para ti (operacional)')+' · '+esc(p.acao)+'</div></div>').join(''):'<div class=\"muted\">Nenhuma.</div>');\n  if(a.resolvidas&&a.resolvidas.length)h+='<h3>Correções confirmadas ('+a.resolvidas.length+')</h3>'+a.resolvidas.map(r=>'<div class=\"p\" style=\"border-left-color:#188038\"><b>'+esc(r.id+' '+r.assunto)+'</b><div class=\"muted\">Já não aparece no site: passa a Concluído e Confirmado.</div></div>').join('');\n  if(ja.length)h+='<div class=\"muted\">Já registadas: '+ja.map(p=>esc(p.jaExiste+' '+p.assunto)).join('; ')+'</div>';\n  if(a.notas.length)h+='<div class=\"muted\">'+a.notas.map(esc).join('<br>')+'</div>';\n  h+='<button onclick=\"gravar()\">Confirmar e gravar no Sheet</button> <button class=\"sec\" onclick=\"document.getElementById(\\'res\\').innerHTML=\\'\\'\">Cancelar</button>';\n  document.getElementById('res').innerHTML=h;\n}\nfunction gravar(){\n  document.querySelectorAll('button').forEach(b=>b.disabled=true);\n  google.script.run.withSuccessHandler(r=>{document.getElementById('res').innerHTML='<p class=\"ok\"><b>Gravado.</b> '+esc(r.ref)+': '+r.escritos+' campos atualizados'+(r.criadas.length?'; pendências criadas: '+r.criadas.map(esc).join(', '):'; nenhuma pendência nova')+(r.confirmadas&&r.confirmadas.length?'; correções confirmadas: '+r.confirmadas.map(esc).join(', '):'')+'.</p>';document.getElementById('txt').value='';document.querySelectorAll('button').forEach(b=>b.disabled=false);}).withFailureHandler(falhou).gravar(document.getElementById('txt').value,docs());\n}\n</script>\n</body></html>\n";
const LISTA_HTML = "<!doctype html>\n<html><head><base target=\"_top\"><meta charset=\"utf-8\">\n<style>\nbody{font-family:Arial,sans-serif;font-size:13px;color:#202124;margin:0;padding:12px}\nh3{font-size:14px;margin:16px 0 6px}\n.muted{color:#5f6368;font-size:12px}\n.barra{background:#e8eaed;border-radius:4px;height:8px;margin:4px 0 2px}\n.barra div{background:#188038;height:8px;border-radius:4px}\n.item{border-left:3px solid #1a73e8;background:#f8f9fa;padding:6px 8px;margin:6px 0}\n.item.sara{border-left-color:#f9ab00}\n.item b{cursor:pointer;color:#1a73e8}\n.item ul{margin:4px 0 0 16px;padding:0}\na{color:#1a73e8}\nbutton{background:#fff;color:#1a73e8;border:1px solid #dadce0;border-radius:6px;padding:6px 12px;font-size:12px;cursor:pointer;margin-top:8px}\n</style></head>\n<body>\n<div id=\"out\">A carregar…</div>\n<button onclick=\"carregar()\">Atualizar</button>\n<script>\nfunction esc(s){return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;');}\nfunction ir(sep,l){google.script.run.irPara(sep,l);}\nfunction liga(u){return u?' · <a href=\"'+esc(u)+'\" target=\"_blank\">página pública</a>':'';}\nfunction barra(a,b,t){const p=b?Math.round(100*a/b):0;return '<div>'+t+': <b>'+a+' de '+b+'</b></div><div class=\"barra\"><div style=\"width:'+p+'%\"></div></div>';}\nfunction mostrar(d){\n  let h='<h3>Progresso</h3>'+barra(d.contagem['Prioritária'][0],d.contagem['Prioritária'][1],'Prioritários verificados')+barra(d.verificados,d.total,'Todos os imóveis verificados');\n  h+='<h3>1. Prioritários por verificar ('+d.prioritarios.length+')</h3>';\n  h+=d.prioritarios.length?d.prioritarios.map(im=>'<div class=\"item\"><b onclick=\"ir(\\'Levantamento\\','+im.linha+')\">'+esc(im.ref)+'</b> · '+esc(im.natureza)+' · '+esc(im.concelho)+liga(im.url)+'</div>').join(''):'<div class=\"muted\">Todos verificados.</div>';\n  h+='<h3>2. As tuas pendências ('+d.minhas.reduce((n,x)=>n+x.pendencias.length,0)+' em '+d.minhas.length+' imóveis)</h3>';\n  h+=d.minhas.length?d.minhas.map(im=>'<div class=\"item\"><b onclick=\"ir(\\'Pendências da equipa\\','+im.pendencias[0].linha+')\">'+esc(im.ref)+'</b> '+(im.prioridade==='Prioritária'?'· prioritário':'')+liga(im.url)+'<ul>'+im.pendencias.map(p=>'<li>'+esc(p.assunto)+'<div class=\"muted\">'+esc(p.acao)+'</div></li>').join('')+'</ul></div>').join(''):'<div class=\"muted\">Nenhuma.</div>';\n  h+='<h3>3. À espera da Sara ('+d.sara.length+')</h3>';\n  h+=d.sara.length?d.sara.map(p=>'<div class=\"item sara\"><b onclick=\"ir(\\'Pendências da equipa\\','+p.linha+')\">'+esc(p.ref)+'</b> · '+esc(p.assunto)+'</div>').join(''):'<div class=\"muted\">Nenhuma.</div>';\n  if(!d.prioritarios.length&&d.altaTotal)h+='<h3>Depois: prioridade Alta por verificar ('+d.altaTotal+')</h3>'+d.alta.map(im=>'<div class=\"item\"><b onclick=\"ir(\\'Levantamento\\','+im.linha+')\">'+esc(im.ref)+'</b> · '+esc(im.natureza)+' · '+esc(im.concelho)+liga(im.url)+'</div>').join('');\n  h+='<p class=\"muted\">Carrega numa referência para ir à linha no Sheet.</p>';\n  document.getElementById('out').innerHTML=h;\n}\nfunction carregar(){document.getElementById('out').textContent='A carregar…';google.script.run.withSuccessHandler(mostrar).withFailureHandler(e=>document.getElementById('out').textContent=e.message).listaTrabalho();}\ncarregar();\n</script>\n</body></html>\n";
const RESUMO_HTML = "<!doctype html>\n<html><head><base target=\"_top\"><meta charset=\"utf-8\">\n<style>\nbody{font-family:Arial,sans-serif;font-size:13px;color:#202124;margin:0;padding:12px}\nlabel{display:block;font-size:12px;color:#5f6368;margin-top:8px}\nselect,input{width:100%;box-sizing:border-box;font-size:13px;padding:4px}\nbutton{background:#1a73e8;color:#fff;border:0;border-radius:6px;padding:8px 12px;font-size:13px;cursor:pointer;margin:8px 6px 0 0}\nbutton.sec{background:#fff;color:#1a73e8;border:1px solid #dadce0}\n#prev{border:1px solid #dadce0;border-radius:6px;padding:8px;margin-top:10px;font-size:12px;max-height:420px;overflow:auto;background:#fff}\n.ok{color:#188038;margin-top:8px}.muted{color:#5f6368;font-size:12px}\n</style></head>\n<body>\n<label>Período</label>\n<select id=\"dias\" onchange=\"ver()\"><option value=\"7\">Últimos 7 dias</option><option value=\"14\">Últimos 14 dias</option><option value=\"30\">Últimos 30 dias</option></select>\n<label>Assunto</label><input id=\"assunto\" readonly onclick=\"this.select()\">\n<button class=\"sec\" onclick=\"copiarAssunto()\">Copiar assunto</button><button onclick=\"copiarEmail()\">Copiar email</button>\n<div id=\"msg\" class=\"ok\"></div>\n<div id=\"prev\">A preparar…</div>\n<p class=\"muted\">Abre o webmail da Janela (janela.pt/webmail), cria uma mensagem para a Sara com a Júlia em Cc, cola o assunto e o email (Ctrl+V). Revê e envia tu.</p>\n<script>\nfunction ver(){document.getElementById('prev').textContent='A preparar…';google.script.run.withSuccessHandler(r=>{document.getElementById('prev').innerHTML=r.html;document.getElementById('assunto').value=r.assunto;}).withFailureHandler(e=>document.getElementById('prev').textContent=e.message).previewResumo(+document.getElementById('dias').value);}\nfunction aviso(t){const m=document.getElementById('msg');m.textContent=t;setTimeout(()=>m.textContent='',4000);}\nfunction copiarAssunto(){const i=document.getElementById('assunto');i.select();document.execCommand('copy');aviso('Assunto copiado.');}\nfunction copiarEmail(){const el=document.getElementById('prev');const r=document.createRange();r.selectNodeContents(el);const s=window.getSelection();s.removeAllRanges();s.addRange(r);const ok=document.execCommand('copy');s.removeAllRanges();aviso(ok?'Email copiado, com a tabela. Cola no webmail.':'Não consegui copiar: seleciona o texto acima e usa Ctrl+C.');}\nver();\n</script>\n</body></html>\n";
const MARCADOR_JS = "(async () => { const fim = (txt, ref) => { navigator.clipboard.writeText(txt).then(() => alert('Clara: ' + (ref || 'imóvel') + ' lido. No Sheet: Clara > Analisar imóvel e cola (Ctrl+V).'), () => prompt('Clara: copia este texto (Ctrl+C) e cola no painel da Clara no Sheet:', txt)); }; if (!/janela-imobiliaria\\.com$/.test(location.hostname)) { alert('Clara: abre a página pública do imóvel no site da Janela e carrega outra vez no marcador.'); return; } const ld = d => { for (const s of d.querySelectorAll('script[type=\"application/ld+json\"]')) { try { const j = JSON.parse(s.textContent); if (j['@type'] === 'RealEstateListing') return j; } catch (e) {} } return null; }; const me = ld(document); if (!me) { alert('Clara: esta página não parece ser a ficha de um imóvel.'); return; } const ext = x => ((JSON.stringify(x).match(/\\.(pdf|jpe?g|png|webp|gif)\\b/i) || [])[1] || '?').toLowerCase().replace('jpeg', 'jpg'); const out = { v: 1, origem: 'site', lido: new Date().toISOString(), url: location.href.split('?')[0], ref: null, textos: {} }; let p = null; const u = performance.getEntriesByType('resource').map(e => e.name).find(n => /websiteapi\\.egorealestate\\.com\\/v1\\/Properties\\/\\d+\\?.*propertyid=/.test(n)); if (u) { try { p = await (await fetch(u, { cache: 'no-store' })).json(); } catch (e) {} } if (p && p.Reference) { const I = p.Images || []; Object.assign(out, { ref: p.Reference, alterado: p.LastModified, fotos: I.length, fotosComAlt: I.filter(i => (i.AlternativeText || '').trim()).length, fotosComLegenda: I.filter(i => (i.Description || '').trim()).length, plantas: (p.BluePrints || []).map(ext), videos: (p.Videos || []).length, visitaVirtual: !!(p.HasVirtualTour || (p.VirtualTours || []).length || (p.ExternalVirtualTours || []).length), fotos360: (p.Photos360 || []).length, folhetos: (p.Brochures || []).length, caracteristicas: (p.Features || []).reduce((n, g) => n + ((g.Childs || []).length), 0), classeEnergetica: p.EnergyCertification || '' }); } else { const html = document.documentElement.outerHTML; const ids = t => new Set(html.match(new RegExp('/T' + t + '/ID[0-9a-f-]+', 'g')) || []).size; const r = (document.querySelector('.detailContainer') || document.body).textContent.match(/Ref\\.\\s*([A-Z]{2,5}\\d+)/); Object.assign(out, { ref: r && r[1], parcial: true, fotos: ids('photo'), fotos360: ids('panoramic'), folhetos: ids('brochure'), plantas: [...new Set(html.match(/\\/Tblueprint\\/ID[0-9a-f-]+\\.\\w+/g) || [])].map(s => s.split('.').pop().toLowerCase()), videos: document.querySelector('#videoTab.propertyMediaDisabled') ? 0 : null }); } for (const l of document.querySelectorAll('link[rel=alternate][hreflang]')) { if (l.hreflang === 'x-default') continue; const k = l.hreflang.slice(0, 2).toUpperCase(); try { const j = ld(new DOMParser().parseFromString(await (await fetch(l.href, { cache: 'no-store' })).text(), 'text/html')) || {}; out.textos[k] = { titulo: j.name || '', descricao: j.description || '' }; } catch (e) { out.textos[k] = { erro: true }; } } if (!out.textos.PT) out.textos.PT = { titulo: me.name || '', descricao: me.description || '' }; fim('CLARA1:' + JSON.stringify(out), out.ref); })();";
