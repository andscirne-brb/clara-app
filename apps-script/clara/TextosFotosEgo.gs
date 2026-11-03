/** Valida a tabela da extensão 0.5.2 antes de apresentar a revisão. */
function analisarTextosFotosEgo(texto) {
  const idiomas = ['PT', 'EN', 'FR', 'DE', 'ES'];
  const cabecalho = 'Ficha eGO\tFoto\tID foto\tIdioma\tEstado\tTexto no eGO';
  if (typeof texto !== 'string' || texto.length > 500000) throw Error('Leitura inválida.');
  const linhas = texto.replace(/\r\n/g, '\n').replace(/\n+$/, '').split('\n');
  if (linhas.shift() !== cabecalho || !linhas.length) throw Error('Cola a tabela de textos das fotos da Clara.');
  const fotos = new Map();
  let ficha;
  for (const linha of linhas) {
    const campos = linha.split('\t');
    const [idFicha, numero, idFoto, idioma, estado, valor] = campos;
    if (campos.length !== 6 || !/^\d+$/.test(idFicha) || !/^[1-9]\d*$/.test(numero) ||
        !/^[\da-f-]+$/i.test(idFoto) || !idiomas.includes(idioma) ||
        (ficha && ficha !== idFicha)) throw Error('Linha inválida ou mistura de fichas.');
    if (valor.trim() ? estado !== 'Preenchido no eGO' :
        !['Em falta no eGO', 'Por verificar'].includes(estado)) throw Error('Estado e texto incompatíveis.');
    ficha = idFicha;
    if (!fotos.has(idFoto)) fotos.set(idFoto, {numero, estados: {}});
    const foto = fotos.get(idFoto);
    if (foto.numero !== numero || foto.estados[idioma]) throw Error('Foto ou idioma repetido.');
    foto.estados[idioma] = estado;
  }
  if (linhas.length !== fotos.size * idiomas.length ||
      new Set([...fotos.values()].map(foto => foto.numero)).size !== fotos.size)
    throw Error('A leitura não contém os cinco idiomas por foto.');
  return {ficha, fotos: fotos.size, idiomas: idiomas.map(idioma => {
    const lista = [...fotos.values()];
    return {
      idioma,
      preenchidos: lista.filter(f => f.estados[idioma] === 'Preenchido no eGO').length,
      emFalta: lista.filter(f => f.estados[idioma] === 'Em falta no eGO').map(f => Number(f.numero)),
      porVerificar: lista.filter(f => f.estados[idioma] === 'Por verificar').map(f => Number(f.numero))
    };
  })};
}
function guardarTextosFotosEgo(texto, referencia) {
  const leitura = analisarTextosFotosEgo(texto);
  const ref = String(referencia || '').trim().toUpperCase();
  if (!/^[A-Z0-9][A-Z0-9/-]{0,39}$/.test(ref)) throw Error('Indica a referência exata do Levantamento.');
  const lock = LockService.getDocumentLock();
  lock.waitLock(10000);
  try {
    const ss = SpreadsheetApp.getActive();
    const lev = ss.getSheetByName('Levantamento');
    const refs = lev.getRange(10, 1, Math.max(1, lev.getLastRow() - 9), 1).getDisplayValues();
    if (refs.filter(([valor]) => valor.trim().toUpperCase() === ref).length !== 1)
      throw Error('A referência tem de existir uma única vez no Levantamento.');
    const nome = 'eGO - textos das fotos';
    let folha = ss.getSheetByName(nome);
    if (!folha) {
      folha = ss.insertSheet(nome);
      folha.appendRow(['Referência', 'Ficha eGO', 'Data do registo', 'Fotos', 'Cobertura por idioma', 'ID da leitura']);
      folha.hideSheet();
    }
    const chave = Utilities.base64EncodeWebSafe(Utilities.computeDigest(
      Utilities.DigestAlgorithm.SHA_256, texto.replace(/\r\n/g, '\n').trimEnd()
    ));
    const anteriores = folha.getLastRow() > 1
      ? folha.getRange(2, 1, folha.getLastRow() - 1, 6).getDisplayValues() : [];
    if (anteriores.some(r => r[1] === leitura.ficha && r[0] !== ref || r[0] === ref && r[1] !== leitura.ficha))
      throw Error('Já existe uma associação diferente para esta referência ou ficha.');
    if (anteriores.some(r => r[5] === chave)) return {referencia: ref, repetida: true};
    const resumo = leitura.idiomas.map(i => i.idioma + ' · ' + i.preenchidos + ' preenchidos · em falta: ' +
      (i.emFalta.join(', ') || 'nenhuma') + ' · por verificar: ' + (i.porVerificar.join(', ') || 'nenhuma')).join('\n');
    folha.appendRow([ref, leitura.ficha, Utilities.formatDate(new Date(), ss.getSpreadsheetTimeZone(), 'yyyy-MM-dd'),
      leitura.fotos, resumo, chave]);
    SpreadsheetApp.flush();
    return {referencia: ref, repetida: false};
  } finally {
    lock.releaseLock();
  }
}
