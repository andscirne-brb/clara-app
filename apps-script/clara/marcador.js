(async () => {
  const fim = (txt, ref) => { navigator.clipboard.writeText(txt).then(() => alert('Clara: ' + (ref || 'imóvel') + ' lido. No Sheet: Clara > Analisar imóvel e cola (Ctrl+V).'), () => prompt('Clara: copia este texto (Ctrl+C) e cola no painel da Clara no Sheet:', txt)); };
  if (!/janela-imobiliaria\.com$/.test(location.hostname)) { alert('Clara: abre a página pública do imóvel no site da Janela e carrega outra vez no marcador.'); return; }
  const ld = d => { for (const s of d.querySelectorAll('script[type="application/ld+json"]')) { try { const j = JSON.parse(s.textContent); if (j['@type'] === 'RealEstateListing') return j; } catch (e) {} } return null; };
  const me = ld(document);
  if (!me) { alert('Clara: esta página não parece ser a ficha de um imóvel.'); return; }
  const ext = x => ((JSON.stringify(x).match(/\.(pdf|jpe?g|png|webp|gif)\b/i) || [])[1] || '?').toLowerCase().replace('jpeg', 'jpg');
  const out = { v: 1, origem: 'site', lido: new Date().toISOString(), url: location.href.split('?')[0], ref: null, textos: {} };
  let p = null;
  const u = performance.getEntriesByType('resource').map(e => e.name).find(n => /websiteapi\.egorealestate\.com\/v1\/Properties\/\d+\?.*propertyid=/.test(n));
  if (u) { try { p = await (await fetch(u, { cache: 'no-store' })).json(); } catch (e) {} }
  if (p && p.Reference) {
    const I = p.Images || [];
    Object.assign(out, {
      ref: p.Reference, alterado: p.LastModified, fotos: I.length,
      fotosComAlt: I.filter(i => (i.AlternativeText || '').trim()).length,
      fotosComLegenda: I.filter(i => (i.Description || '').trim()).length,
      plantas: (p.BluePrints || []).map(ext), videos: (p.Videos || []).length,
      visitaVirtual: !!(p.HasVirtualTour || (p.VirtualTours || []).length || (p.ExternalVirtualTours || []).length),
      fotos360: (p.Photos360 || []).length, folhetos: (p.Brochures || []).length,
      caracteristicas: (p.Features || []).reduce((n, g) => n + ((g.Childs || []).length), 0),
      classeEnergetica: p.EnergyCertification || ''
    });
  } else {
    const html = document.documentElement.outerHTML;
    const ids = t => new Set(html.match(new RegExp('/T' + t + '/ID[0-9a-f-]+', 'g')) || []).size;
    const r = (document.querySelector('.detailContainer') || document.body).textContent.match(/Ref\.\s*([A-Z]{2,5}\d+)/);
    Object.assign(out, {
      ref: r && r[1], parcial: true, fotos: ids('photo'), fotos360: ids('panoramic'), folhetos: ids('brochure'),
      plantas: [...new Set(html.match(/\/Tblueprint\/ID[0-9a-f-]+\.\w+/g) || [])].map(s => s.split('.').pop().toLowerCase()),
      videos: document.querySelector('#videoTab.propertyMediaDisabled') ? 0 : null
    });
  }
  for (const l of document.querySelectorAll('link[rel=alternate][hreflang]')) {
    if (l.hreflang === 'x-default') continue;
    const k = l.hreflang.slice(0, 2).toUpperCase();
    try { const j = ld(new DOMParser().parseFromString(await (await fetch(l.href, { cache: 'no-store' })).text(), 'text/html')) || {}; out.textos[k] = { titulo: j.name || '', descricao: j.description || '' }; }
    catch (e) { out.textos[k] = { erro: true }; }
  }
  if (!out.textos.PT) out.textos.PT = { titulo: me.name || '', descricao: me.description || '' };
  fim('CLARA1:' + JSON.stringify(out), out.ref);
})();
