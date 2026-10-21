/**
 * Clara · modelo para registar pendências para a Sara no separador "Pendências da equipa".
 * Títulos na linha 5; dados a partir da linha 6 (até à 305, onde está a fórmula de Conferência).
 * Colunas: A ID | B Referência EGO | C Tema | D Assunto | E Evidência / fonte | F Ação necessária |
 * G Responsável | H Prioridade | I Estado | J Data de registo | K Última atualização |
 * L Resposta / decisão | M Data de resolução | N Onde corrigir | O Verificação final |
 * P Conferência (FÓRMULA, nunca escrever) | Q Aguarda análise de.
 * Não duplica referência + assunto. Substituir SHEET_ID (não guardar o ID real no repositório).
 */
function registarPendencias(novas) {
  // novas: [[referencia, tema, assunto, evidencia, acao, prioridade, estado, ondeCorrigir], ...]
  const sh = SpreadsheetApp.openById(SHEET_ID).getSheetByName('Pendências da equipa');
  const tz = SpreadsheetApp.openById(SHEET_ID).getSpreadsheetTimeZone();
  const hoje = Utilities.parseDate(Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd'), tz, 'yyyy-MM-dd'); // só data, sem horas
  const v = sh.getRange(6, 1, 300, 17).getDisplayValues();
  const existe = {}; let maxId = 0; let livre = -1;
  v.forEach(function (r, i) {
    if (r[1]) existe[r[1] + '|' + r[3]] = true;
    const m = /^P(\d+)$/.exec(r[0]); if (m) maxId = Math.max(maxId, +m[1]);
    if (livre < 0 && !r[0] && !r[1] && !r[3]) livre = i;
  });
  if (livre < 0) throw new Error('Sem linhas livres em Pendências da equipa.');
  let linha = 6 + livre;
  novas.forEach(function (p) {
    if (existe[p[0] + '|' + p[2]]) { console.log('já existe: ' + p[2]); return; }
    maxId++; const id = 'P' + ('000' + maxId).slice(-4);
    sh.getRange(linha, 1, 1, 15).setValues([[id, p[0], p[1], p[2], p[3], p[4], 'Por atribuir', p[5], p[6], hoje, hoje, '', '', p[7], 'Por verificar']]);
    sh.getRange(linha, 17).setValue('Sara');
    console.log('registada ' + id + ' na linha ' + linha + ': ' + p[2]);
    linha++;
  });
}
