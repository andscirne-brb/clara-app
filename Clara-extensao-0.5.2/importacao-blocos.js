/* Divide a leitura guardada para a enviar sem a colocar num campo de texto. */
function criarBlocosImportacaoClara(texto, limite = 64000) {
  if (typeof texto !== 'string' || !texto.startsWith('CLARA7:') ||
      !Number.isSafeInteger(limite) || limite < 2) {
    throw Error('Leitura ou tamanho de bloco inválido.');
  }
  const blocos = [];
  for (let inicio = 0; inicio < texto.length;) {
    let fim = Math.min(inicio + limite, texto.length);
    const ultimo = texto.charCodeAt(fim - 1);
    if (fim < texto.length && ultimo >= 0xD800 && ultimo <= 0xDBFF) fim--;
    blocos.push(texto.slice(inicio, fim));
    inicio = fim;
  }
  return blocos;
}

/* Uma sessão de receção em memória. Só entrega a leitura quando está completa. */
function criarRecetorImportacaoClara(total) {
  if (!Number.isSafeInteger(total) || total < 1 || total > 200)
    throw Error('Número de blocos inválido.');
  const blocos = [];
  return {
    receber(indice, texto) {
      if (!Number.isSafeInteger(indice) || indice < 0 || indice >= total ||
          typeof texto !== 'string' || !texto.length || texto.length > 64000)
        throw Error('Bloco inválido.');
      if (indice > blocos.length) throw Error('Falta um bloco anterior.');
      if (indice === blocos.length) blocos.push(texto);
      else if (blocos[indice] !== texto) throw Error('O bloco repetido tem conteúdo diferente.');
      return blocos.length;
    },
    concluir() {
      if (blocos.length !== total) throw Error('A receção ainda está incompleta.');
      const texto = blocos.join('');
      if (!texto.startsWith('CLARA7:')) throw Error('Formato de recolha inválido.');
      const dados = JSON.parse(texto.slice(7));
      if (dados.v !== 7 || dados.origem !== 'site' || dados.tipo !== 'lote-imoveis' ||
          !Array.isArray(dados.fichas) || !dados.fichas.length ||
          dados.fichas.length !== dados.totalLidos || dados.totalLidos > dados.totalSite)
        throw Error('A leitura recebida não coincide com o total declarado.');
      return texto;
    }
  };
}
/* Envia a leitura guardada ao painel, sem iniciar a gravação. */
async function enviarImportacaoClara(tabId, frameId, texto, id, documento) {
  const blocos = criarBlocosImportacaoClara(texto);
  const enviar = async pedido => {
    const [resposta] = await chrome.scripting.executeScript({
      target: {tabId, frameIds: [frameId]},
      world: 'MAIN',
      args: [{...pedido, id}, documento],
      func: (mensagem, destino) => {
        try {
          if (typeof documentoImportacaoClara !== 'function' || documentoImportacaoClara() !== destino || typeof receberImportacaoClara !== 'function')
            throw Error('O painel aberto ainda não aceita importação direta.');
          return {valor: receberImportacaoClara(mensagem)};
        } catch (erro) {
          return {erro: String(erro.message || erro)};
        }
      }
    });
    if (!resposta?.result || resposta.result.erro)
      throw Error(resposta?.result?.erro || 'O painel não respondeu.');
    return resposta.result.valor;
  };
  const inicio = await enviar({acao: 'iniciar', total: blocos.length});
  if (!Number.isInteger(inicio) || inicio < 0 || inicio > blocos.length)
    throw Error('O painel devolveu um ponto de retoma inválido.');
  for (let indice = inicio; indice < blocos.length; indice++) {
    const recebidos = await enviar({acao: 'bloco', indice, texto: blocos[indice]});
    if (recebidos !== indice + 1) throw Error('O painel não confirmou o bloco enviado.');
  }
  const resultado = await enviar({acao: 'concluir'});
  if (!resultado?.recebida) throw Error('O painel não confirmou a recolha completa.');
  return resultado;
}

