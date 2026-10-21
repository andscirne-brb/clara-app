/**
 * Arrumação do Sheet aprovada pela Andreia a 22/10/2026 (corre uma vez, dentro do projeto ligado ao Sheet).
 * Não apaga dados de imóveis. Cada passo regista o resultado; se um falhar, os outros continuam.
 */
function aplicarArrumacao() {
  const ss = SpreadsheetApp.getActive();
  const passo = function (nome, f) { try { f(); console.log('OK · ' + nome); } catch (e) { console.log('FALHOU · ' + nome + ': ' + e.message); } };
  const PESSOAS = ['Andreia', 'Sara', 'Júlia', 'Idília'];
  const lista = function (v) { return SpreadsheetApp.newDataValidation().requireValueInList(v, true).setAllowInvalid(true).setHelpText('Escolhe uma opção da lista.').build(); };
  const colunas = function (sh, hr) { return sh.getRange(hr, 1, 1, sh.getLastColumn()).getDisplayValues()[0]; };
  const validar = function (nome, hr, regras) {
    const sh = ss.getSheetByName(nome); if (!sh) throw new Error('sem separador ' + nome);
    const h = colunas(sh, hr); const n = sh.getMaxRows() - hr;
    Object.keys(regras).forEach(function (c) { const i = h.indexOf(c); if (i < 0) { console.log('  coluna não encontrada: ' + nome + ' · ' + c); return; } sh.getRange(hr + 1, i + 1, n, 1).setDataValidation(lista(regras[c])); });
  };
  const trocarTexto = function (sh, linhas, de, para) {
    const r = sh.getRange(1, 1, linhas, sh.getLastColumn()); const v = r.getValues(); const f = r.getFormulas(); let n = 0;
    v.forEach(function (row, i) { row.forEach(function (x, j) { if (!f[i][j] && typeof x === 'string' && x.indexOf(de) >= 0) { sh.getRange(i + 1, j + 1).setValue(x.split(de).join(para)); n++; } }); });
    return n;
  };

  // 1. Levantamento
  const lev = ss.getSheetByName('Levantamento');
  const lh = colunas(lev, 9);
  passo('Levantamento: visita virtual descontinuada (coluna escondida)', function () {
    const i = lh.indexOf('Visita virtual (não avaliada)');
    if (i >= 0) { lev.getRange(9, i + 1).setValue('Visita virtual (descontinuada)'); lev.hideColumns(i + 1); }
    trocarTexto(lev, 8, 'Visita virtual não é avaliada (20/10/2026).', 'Visita virtual descontinuada: não é avaliada.');
  });
  passo('Levantamento: "Ligação à ficha EGO" passa a "Página pública"', function () {
    const i = lh.indexOf('Ligação à ficha EGO'); if (i >= 0) lev.getRange(9, i + 1).setValue('Página pública');
  });
  passo('Levantamento: responsável pelo acompanhamento = Andreia', function () {
    const i = lh.indexOf('Responsável pelo acompanhamento'); if (i < 0) throw new Error('coluna');
    const refs = lev.getRange(10, 1, 1000, 1).getDisplayValues();
    const r = lev.getRange(10, i + 1, 1000, 1); const v = r.getValues();
    r.setValues(v.map(function (x, k) { return [refs[k][0] && (!x[0] || x[0] === 'Por atribuir') ? 'Andreia' : x[0]]; }));
  });

  // 2. Pendências antigas: regra (esclarecimento = Sara; operacional = Andreia)
  passo('Pendências: classificar as antigas pela regra', function () {
    const ps = ss.getSheetByName('Pendências da equipa');
    const v = ps.getRange(6, 1, 300, 17).getDisplayValues(); let a = 0, s = 0;
    v.forEach(function (r, i) {
      if (!r[1] || r[6] !== 'Por atribuir') return;
      if (r[8] === 'Por tratar') { ps.getRange(6 + i, 7).setValue('Andreia'); ps.getRange(6 + i, 17).setValue(''); a++; }
      else if (r[8] === 'A aguardar esclarecimento') { ps.getRange(6 + i, 17).setValue('Sara'); s++; }
    });
    console.log('  operacionais para a Andreia: ' + a + ' · perguntas para a Sara: ' + s);
  });

  // 3. Registo de alterações: o levantamento já não é um Excel
  passo('Registo: "Levantamento Excel" passa a "Levantamento"', function () {
    const rg = ss.getSheetByName('Registo de alterações'); const h = colunas(rg, 5); const i = h.indexOf('Onde foi alterado');
    const r = rg.getRange(6, i + 1, rg.getLastRow() - 5, 1); r.setValues(r.getValues().map(function (x) { return [x[0] === 'Levantamento Excel' ? 'Levantamento' : x[0]]; }));
    trocarTexto(rg, 4, 'edições no Excel ou no eGO', 'edições no Sheet ou no eGO');
  });

  // 4. Dashboard: resumo das pendências em vez da cópia das primeiras 15
  passo('Dashboard: resumo das pendências', function () {
    const db = ss.getSheetByName('Dashboard');
    trocarTexto(db, 86, 'Inclui organização do Excel', 'Inclui a seleção dos imóveis prioritários');
    db.getRange(68, 1, 16, 11).clearContent();
    const P = "'Pendências da equipa'!";
    const abertas = P + 'I6:I305,"<>Concluído",' + P + 'I6:I305,"<>Não aplicável"';
    db.getRange(68, 1, 1, 2).setValues([['Indicador', 'Total']]);
    db.getRange(69, 1, 6, 1).setValues([['Pendências em aberto'], ['Para a Andreia (operacionais)'], ['À espera da Sara (esclarecimentos)'], ['Imóveis com pendências em aberto'], ['Concluídas'], ['Com aviso na coluna Conferência']]);
    db.getRange(69, 2, 6, 1).setFormulas([
      ['=COUNTIFS(' + P + 'B6:B305,"<>",' + abertas + ')'],
      ['=COUNTIFS(' + P + 'G6:G305,"Andreia",' + abertas + ')'],
      ['=COUNTIFS(' + P + 'Q6:Q305,"Sara",' + P + 'I6:I305,"A aguardar esclarecimento")'],
      ['=IFERROR(COUNTUNIQUE(FILTER(' + P + 'B6:B305,' + P + 'B6:B305<>"",' + P + 'I6:I305<>"Concluído",' + P + 'I6:I305<>"Não aplicável")),0)'],
      ['=COUNTIFS(' + P + 'I6:I305,"Concluído")'],
      ['=COUNTIF(' + P + 'P6:P305,"?*")']
    ]);
    db.getRange(75, 1).setValue('O detalhe está no separador Pendências da equipa: filtra por Responsável ou por "Aguarda análise de".');
  });

  // 5. Histórico de indicadores: esconder colunas ainda sem dados
  passo('Histórico de indicadores: esconder colunas vazias', function () {
    const hi = ss.getSheetByName('Histórico de indicadores'); const h = colunas(hi, 5);
    ['Referência do anúncio', 'Score observado', 'Escala / designação do score'].forEach(function (c) { const i = h.indexOf(c); if (i >= 0) hi.hideColumns(i + 1); });
  });

  // 6. Listas de escolha nas colunas que devem ser uniformes
  passo('Listas: Registo de alterações', function () { validar('Registo de alterações', 5, { 'Autor': PESSOAS.concat(['Clara']), 'Onde foi alterado': ['eGO', 'Portal', 'Levantamento'], 'Verificado por': PESSOAS.concat(['Clara', 'Clara (conferência das referências)']) }); });
  passo('Listas: Textos por idioma', function () { validar('Textos por idioma', 5, { 'Idioma': ['PT', 'EN', 'FR', 'DE', 'ES'], 'Estado da recolha': ['Por recolher', 'Recolhido'], 'Estado da proposta': ['Por preparar', 'Proposta pronta', 'Aplicada no eGO', 'Não aplicável'], 'Revisor': PESSOAS }); });
  passo('Listas: Histórico de indicadores', function () { validar('Histórico de indicadores', 5, { 'Plataforma': ['eGO', 'Idealista', 'Green-Acres', 'Rightmove'], 'Estado do anúncio': ['Disponível', 'Em Prospecção', 'Reservado', 'Vendido', 'Retirado'], 'Registado por': PESSOAS.concat(['Clara']) }); });
  passo('Listas: Leads por período', function () { validar('Leads por período', 5, { 'Origem / portal': ['Idealista', 'Green-Acres', 'Rightmove', 'eGO', 'Site da Janela'], 'Registado por': PESSOAS.concat(['Clara']) }); });
  ['Perfis dos portais', 'Histórico dos perfis'].forEach(function (n) {
    passo('Listas: ' + n, function () { validar(n, 1, { 'Portal': ['idealista', 'green-acres', 'rightmove'], 'Estado': ['Por verificar', 'Em curso', 'Ajustar', 'Pendente', 'Fonte', 'Concluído'], 'Depende de': PESSOAS, 'Idioma': ['PT', 'EN', 'FR', 'DE', 'ES'] }); });
  });

  // 7. Ordem e separadores escondidos
  passo('Ordem dos separadores', function () {
    ['Dashboard', 'Pendências da equipa', 'Levantamento', 'Registo de alterações', 'Histórico de indicadores', 'Leads por período', 'Perfis dos portais', 'Rightmove - anúncios', 'Textos por idioma', 'Histórico dos perfis', 'Origem EGO'].forEach(function (n, k) {
      const sh = ss.getSheetByName(n); if (!sh) return; ss.setActiveSheet(sh); ss.moveActiveSheet(k + 1);
    });
    ss.setActiveSheet(ss.getSheetByName('Dashboard'));
  });
  passo('Esconder Textos por idioma e Histórico dos perfis', function () { ss.getSheetByName('Textos por idioma').hideSheet(); ss.getSheetByName('Histórico dos perfis').hideSheet(); });
}
