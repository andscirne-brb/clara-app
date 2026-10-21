/**
 * M0 (aplicado a 21/10/2026 com autorização da Andreia): fuso de Lisboa e listas de escolha
 * (aviso, sem bloquear). Pode correr outra vez sem duplicar.
 * Nota: Levantamento, Pendências da equipa e Registo de alterações são TABELAS do Google Sheets;
 * a API do Apps Script não permite proteger intervalos nelas (getProtections falha).
 * As colunas calculadas ficam sem proteção automática.
 * Substituir SHEET_ID (não guardar o ID real no repositório).
 */
function aplicarRegrasM0() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  ss.setSpreadsheetTimeZone('Europe/Lisbon');
  const PESSOAS = ['Por atribuir', 'Andreia', 'Sara', 'Júlia', 'Idília'];
  const VERIF = ['Por verificar', 'Preenchido', 'Em falta', 'Formato errado', 'Não aplicável', 'Não foi possível verificar'];
  const lista = function (valores) {
    return SpreadsheetApp.newDataValidation().requireValueInList(valores, true)
      .setAllowInvalid(true).setHelpText('Escolhe uma opção da lista.').build();
  };
  const tratar = function (nome, hr, regras) {
    const sh = ss.getSheetByName(nome);
    const lc = sh.getLastColumn(); const n = sh.getMaxRows() - hr;
    const heads = sh.getRange(hr, 1, 1, lc).getDisplayValues()[0];
    Object.keys(regras).forEach(function (h) {
      const c = heads.indexOf(h);
      if (c < 0) { console.log('AVISO coluna não encontrada em ' + nome + ': ' + h); return; }
      try { sh.getRange(hr + 1, c + 1, n, 1).setDataValidation(lista(regras[h])); console.log(nome + ' · ' + h + ': lista aplicada'); }
      catch (e) { console.log('AVISO lista não aplicada em ' + nome + ' · ' + h + ': ' + e.message); }
    });
  };
  const lev = {};
  ['Imagens', 'Alt-text', 'Descrição PT', 'Descrição EN', 'Descrição FR', 'Descrição DE', 'Descrição ES', 'Características',
    'Vídeo', 'Visita virtual (não avaliada)', 'Planta', 'Caderneta Predial (anexo)', 'Certificado Energético (anexo)',
    'Contrato Mediação (anexo)', 'Licença Habitação (anexo)', 'Folheto'].forEach(function (h) { lev[h] = VERIF; });
  lev['Estado da verificação'] = ['Por iniciar', 'Em curso', 'Verificado'];
  lev['Prioridade'] = ['Prioritária', 'Alta', 'Normal'];
  lev['Responsável pelo acompanhamento'] = PESSOAS;
  tratar('Levantamento', 9, lev);
  tratar('Pendências da equipa', 5, {
    'Tema': ['Imagens', 'Textos', 'Características', 'Áreas', 'Construção', 'Plantas', 'Vídeo', 'Visita virtual', 'Documentos', 'Indicadores', 'Outro'],
    'Responsável': PESSOAS,
    'Prioridade': ['Alta', 'Normal'],
    'Estado': ['Por tratar', 'A aguardar esclarecimento', 'Em curso', 'Concluído', 'Não aplicável'],
    'Onde corrigir': ['eGO', 'eGO e portais', 'eGO, site, portais e folhetos', 'Portais', 'Site'],
    'Verificação final': ['Por verificar', 'Confirmado', 'Não confirmado'],
    'Aguarda análise de': ['Sara', 'Andreia', 'Júlia', 'Idília']
  });
  tratar('Registo de alterações', 5, {
    'Onde foi alterado': ['eGO', 'Portal', 'Levantamento Excel'],
    'Resultado da verificação': ['Confirmado', 'Referência conferida nos prints e no levantamento', 'Realizado pela autora; sem reverificação independente', 'Por verificar']
  });
}
