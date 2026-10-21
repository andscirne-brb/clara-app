/**
 * Clara · funções de diagnóstico do Google Sheet do levantamento.
 * Correm no Apps Script da conta da Janela, nunca na Clara.
 * Só leem ESTRUTURA (nomes, títulos, contagens, regras) e opções de colunas
 * de categoria. Nunca mostram referências, descrições nem outros valores dos imóveis.
 *
 * Antes de usar: substituir SHEET_ID pelo ID do Sheet (não guardar o ID real
 * neste repositório público).
 */
const SHEET_ID = 'COLOCAR_AQUI_O_ID_DO_SHEET';

function mostrarEstrutura() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const out = { ficheiro: ss.getName(), fuso: ss.getSpreadsheetTimeZone(), separadores: [] };
  ss.getSheets().forEach(function (sh) {
    const lastRow = sh.getLastRow(), lastCol = sh.getLastColumn();
    const info = { nome: sh.getName(), oculto: sh.isSheetHidden(), linhas_com_conteudo: lastRow,
      colunas: lastCol, linhas_fixas: sh.getFrozenRows(), linha_titulos: null, titulos: [],
      colunas_com_formulas: [], colunas_com_validacao: [],
      protecoes: sh.getProtections(SpreadsheetApp.ProtectionType.RANGE).length +
                 sh.getProtections(SpreadsheetApp.ProtectionType.SHEET).length };
    if (lastRow > 0 && lastCol > 0) {
      const top = sh.getRange(1, 1, Math.min(20, lastRow), lastCol).getDisplayValues();
      for (let r = 0; r < top.length; r++) {
        const textos = top[r].filter(function (v) { return v !== '' && isNaN(Number(v)); });
        if (textos.length >= 3) { info.linha_titulos = r + 1; info.titulos = top[r]; break; }
      }
      if (info.linha_titulos && lastRow > info.linha_titulos) {
        const r = info.linha_titulos + 1;
        const f = sh.getRange(r, 1, 1, lastCol).getFormulas()[0];
        const dv = sh.getRange(r, 1, 1, lastCol).getDataValidations()[0];
        for (let c = 0; c < lastCol; c++) {
          const t = info.titulos[c] || ('coluna ' + (c + 1));
          if (f[c]) info.colunas_com_formulas.push(t);
          if (dv[c]) info.colunas_com_validacao.push(t);
        }
      }
    }
    out.separadores.push(info);
  });
  console.log(JSON.stringify(out));
}

/** Só os títulos das linhas 7 a 9 do Levantamento (a linha 9 é a dos títulos). */
function titulosLevantamento() {
  const sh = SpreadsheetApp.openById(SHEET_ID).getSheetByName('Levantamento');
  const rows = sh.getRange(7, 1, 3, sh.getLastColumn()).getDisplayValues();
  console.log(JSON.stringify({ linha7: rows[0], linha8: rows[1], linha9: rows[2] }));
}

/** Validações, formatação condicional, proteções e filtros (sem ler valores). */
function verificarRegras() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const out = { fuso: ss.getSpreadsheetTimeZone(), separadores: [] };
  ss.getSheets().forEach(function (sh) {
    const lastRow = Math.max(sh.getMaxRows(), 1), lastCol = Math.max(sh.getLastColumn(), 1);
    const dv = sh.getRange(1, 1, Math.min(lastRow, 1200), lastCol).getDataValidations();
    const porColuna = {}, tipos = {};
    dv.forEach(function (row) {
      row.forEach(function (v, c) {
        if (!v) return;
        porColuna[c + 1] = (porColuna[c + 1] || 0) + 1;
        const t = String(v.getCriteriaType()); tipos[t] = (tipos[t] || 0) + 1;
      });
    });
    out.separadores.push({
      nome: sh.getName(),
      celulas_com_validacao_por_coluna: porColuna,
      tipos_de_validacao: tipos,
      regras_formatacao_condicional: sh.getConditionalFormatRules().length,
      protecoes: sh.getProtections(SpreadsheetApp.ProtectionType.RANGE).length + sh.getProtections(SpreadsheetApp.ProtectionType.SHEET).length,
      filtros: sh.getFilter() ? 'sim' : 'não'
    });
  });
  out.intervalos_com_nome = ss.getNamedRanges().map(function (n) { return n.getName(); });
  console.log(JSON.stringify(out));
}

/**
 * Opções já usadas nas colunas de categoria (estado, prioridade, responsável...).
 * Serve para desenhar as listas de escolha sem invalidar o que existe.
 * Ignora colunas de texto livre e nunca mostra referências nem descrições.
 */
function listarCategorias() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const ignorar = /refer|descri|observa|resumo|liga|link|data|antes|depois|motivo|título|titulo|texto|nome|url|id da|conferência|categorias|campos em falta|assunto|resposta|ação|acao/i;
  ['Levantamento', 'Pendências da equipa', 'Registo de alterações', 'Perfis dos portais'].forEach(function (nome) {
    const sh = ss.getSheetByName(nome); if (!sh) return;
    const lr = sh.getLastRow(), lc = sh.getLastColumn();
    const top = sh.getRange(1, 1, Math.min(20, lr), lc).getDisplayValues();
    let hr = 0;
    for (let r = 0; r < top.length; r++) {
      if (top[r].filter(function (v) { return v !== '' && isNaN(Number(v)); }).length >= 3) { hr = r + 1; break; }
    }
    if (!hr) return;
    const heads = top[hr - 1];
    console.log('### ' + nome + ' (títulos na linha ' + hr + '): ' + heads.join(' | '));
    if (lr <= hr) return;
    const vals = sh.getRange(hr + 1, 1, lr - hr, lc).getDisplayValues();
    for (let c = 0; c < lc; c++) {
      const h = heads[c]; if (!h || ignorar.test(h)) continue;
      const cont = {};
      vals.forEach(function (row) { const v = String(row[c]).trim(); if (v) cont[v] = (cont[v] || 0) + 1; });
      const k = Object.keys(cont);
      if (!k.length) { console.log('  ' + h + ': (vazia)'); continue; }
      if (k.length > 12 || k.some(function (x) { return x.length > 45 || /\d{3}/.test(x); })) {
        console.log('  ' + h + ': texto livre ou números (' + k.length + ' valores diferentes), não listado');
        continue;
      }
      console.log('  ' + h + ': ' + k.map(function (x) { return x + ' (' + cont[x] + ')'; }).join(' · '));
    }
  });
}
