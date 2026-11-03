/* Recolhe identificadores das fichas na página autenticada da lista eGO. */
function lerPaginaCarteiraEgo(doc, endereco) {
  const pagina = new URL(endereco);
  if (pagina.origin !== 'https://admin.egorealestate.com' ||
      pagina.pathname.replace(/\/$/, '') !== '/egocore/realestates') {
    throw Error('Abre a lista de imóveis no eGO.');
  }
  const fichas = new Map();
  for (const link of doc.querySelectorAll('a[href]')) {
    const href = new URL(link.getAttribute('href'), pagina);
    const id = /^\/egocore\/realestate\/(\d+)\/?$/.exec(href.pathname)?.[1];
    if (href.origin !== pagina.origin || !id) continue;
    fichas.set(id, {id, url: pagina.origin + '/egocore/realestate/' + id});
  }
  if (!fichas.size) throw Error('A página não mostrou fichas. Confirma a sessão e os filtros.');
  return [...fichas.values()];
}

/* O leitor autenticado confirma o fim da lista e o total anunciado pelo eGO. */
async function percorrerCarteiraEgo(lerPagina) {
  const fichas = new Map();
  const paginas = new Set();
  let cursor = null;
  let total;
  do {
    const pagina = await lerPagina(cursor);
    if (typeof pagina.chave !== 'string' || !pagina.chave || paginas.has(pagina.chave))
      throw Error('O eGO repetiu uma página. A carteira ficou por confirmar.');
    paginas.add(pagina.chave);
    if (!Number.isSafeInteger(pagina.total) || pagina.total < 0 ||
        (total !== undefined && total !== pagina.total))
      throw Error('O total da lista do eGO ficou por confirmar.');
    total = pagina.total;
    for (const ficha of pagina.fichas) fichas.set(ficha.id, ficha);
    if (pagina.fim === true) {
      if (fichas.size !== total) throw Error('A lista terminou com ' + fichas.size + ' de ' + total + ' fichas.');
      return [...fichas.values()];
    }
    if (!pagina.proxima || fichas.size >= total || paginas.size > total)
      throw Error('A paginação da carteira ficou por confirmar.');
    cursor = pagina.proxima;
  } while (true);
}
