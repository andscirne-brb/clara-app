/* Gerado por scripts/construir-coletor-imovel.py; não editar à mão. */
async function fetchClara(url,json){if(!/^https:\/\/(?:www\.)?janela-imobiliaria\.com\//.test(url)&&!/^https:\/\/websiteapi\.egorealestate\.com\/v1\/Properties\/\d+\?/.test(url))throw Error('Fonte externa não autorizada.');const control=new AbortController(),timer=setTimeout(()=>control.abort(),12000);try{const r=await fetch(url,{cache:'no-store',signal:control.signal});if(!r.ok)throw Error('A página não respondeu corretamente.');return json?await r.json():await r.text();}finally{clearTimeout(timer);}}

async function aguardarFichaClara(doc){
 const pronta=()=>Array.from(doc.querySelectorAll('script[type="application/ld+json"]')).some(n=>{try{return JSON.parse(n.textContent)['@type']==='RealEstateListing';}catch(e){return false;}})&&(!!doc.querySelector('.mediaGallery .totalImgCounter')||/Ref\.\s*[A-Z]{2,5}\d+/.test(doc.querySelector('.detailContainer')?.textContent||''));
 if(pronta())return;
 await new Promise((resolve,reject)=>{let timer;const obs=new MutationObserver(()=>{if(pronta()){obs.disconnect();clearTimeout(timer);resolve();}});obs.observe(doc.documentElement,{childList:true,subtree:true});timer=setTimeout(()=>{obs.disconnect();reject(Error('A ficha não terminou de carregar. Atualiza a página pública e volta a tentar.'));},12000);if(pronta()){obs.disconnect();clearTimeout(timer);resolve();}});
}
async function recolherFichaClara(doc,ui){
 await aguardarFichaClara(doc);
  ui.estado('A ler a ficha do imóvel…');
  const ld = d => { for (const s of d.querySelectorAll('script[type="application/ld+json"]')) { try { const j = JSON.parse(s.textContent); if (j['@type'] === 'RealEstateListing') return j; } catch (e) {} } return null; };
  const me = ld(doc);
  if(!me)throw Error('Abre a ficha pública completa do imóvel no website.');
  const ext = x => ((JSON.stringify(x).match(/\.(pdf|jpe?g|png|webp|gif)\b/i) || [])[1] || '?').toLowerCase().replace('jpeg', 'jpg');
  const out = { v: 1, marcadorVersao: '20261028.2', origem: 'site', lido: new Date().toISOString(), url: location.href.split('?')[0], ref: null, idiomaCaracteristicas: (doc.documentElement.lang || '').slice(0,2).toUpperCase(), textos: {} };
  let p = null;
  const u = performance.getEntriesByType('resource').map(e => e.name).find(n => /websiteapi\.egorealestate\.com\/v1\/Properties\/\d+\?.*propertyid=/.test(n));
  if (u) { try { p = await fetchClara(u,true); } catch (e) {} }
  const refDom=(doc.querySelector('.detailContainer')||doc.body).textContent.match(/Ref\.\s*([A-Z]{2,5}\d+)/);
  if(p&&p.Reference&&refDom&&p.Reference!==refDom[1])throw Error('As referências da página e dos dados não correspondem. Atualiza a ficha.');
  if (p && p.Reference) {
    const I = p.Images || [];
    Object.assign(out, {
      ref: p.Reference, alterado: p.LastModified, fotos: I.length,
      fotosComAlt: I.filter(i => (i.AlternativeText || '').trim()).length,
      fotosComLegenda: I.filter(i => (i.Description || '').trim()).length,
      plantas: (p.BluePrints || []).map(ext), videos: (p.Videos || []).length,
      visitaVirtual: !!(p.HasVirtualTour || (p.VirtualTours || []).length || (p.ExternalVirtualTours || []).length),
      fotos360: (p.Photos360 || []).length, folhetos: (p.Brochures || []).length,
      nomesCaracteristicas: (p.Features || []).flatMap(g => (g.Childs || []).map(f => typeof f === 'string' ? f : typeof f.Name === 'string' ? f.Name : '')),
      caracteristicas: (p.Features || []).reduce((n, g) => n + ((g.Childs || []).length), 0),
      classeEnergetica: p.EnergyCertification || ''
    });
  } else {
    const html = doc.documentElement.outerHTML;
    const ids = t => new Set(html.match(new RegExp('/T' + t + '/ID[0-9a-f-]+', 'g')) || []).size;
    const r = (doc.querySelector('.detailContainer') || doc.body).textContent.match(/Ref\.\s*([A-Z]{2,5}\d+)/);
    Object.assign(out, {
      ref: r && r[1], parcial: true, fotos: ids('photo'), fotos360: ids('panoramic'), folhetos: ids('brochure'),
      plantas: [...new Set(html.match(/\/Tblueprint\/ID[0-9a-f-]+\.\w+/g) || [])].map(s => s.split('.').pop().toLowerCase()),
      videos: doc.querySelector('#videoTab.propertyMediaDisabled') ? 0 : null
    });
  }
  /* Nomes do bloco do próprio imóvel; exclui equipamentos da zona envolvente. */
  const blocoFeatures=doc.querySelector('.propertyBasicFeatures');
  if(blocoFeatures){
    const itens=Array.from(blocoFeatures.querySelectorAll('.detailWrapper .detailItem'));
    const nomes=itens.filter(e=>{const ul=e.closest('.detailWrapper'),m=(ul.className||'').match(/\bfeat\d+\b/),h=m&&blocoFeatures.querySelector('.featureHeader.'+m[0]);return !h||!/zona envolvente|surroundings/i.test(h.textContent);}).map(e=>{const n=e.querySelector('.label'),v=e.querySelector('.value');return n&&v&&(v.querySelector('[class*="tick"]')||v.textContent.trim()&&!/^(0|n[aã]o|no)$/i.test(v.textContent.trim()))?n.textContent.trim():'';});
    if(itens.length&&nomes.length&&nomes.every(Boolean)){out.nomesCaracteristicas=nomes;out.nomesCaracteristicasCompletos=true;out.caracteristicas=nomes.length;out.idiomaCaracteristicas=(doc.documentElement.lang||'').slice(0,2).toUpperCase();}
  }
  /* A leitura parcial pode confirmar blocos completos da ficha pública. */
  if(out.parcial){
    out.fotos=null;
    const galerias=Array.from(doc.querySelectorAll('.mediaContainer')).filter(g=>g.querySelector('.totalImgCounter')&&g.querySelector('.thumbItens[data-mediaid]'));
    if(galerias.length===1){
      const g=galerias[0],total=Number(g.querySelector('.totalImgCounter').textContent.trim()),fotos=new Map();
      for(const t of g.querySelectorAll('.thumbItens[data-mediaid]')){const img=t.querySelector('img'),id=((t.getAttribute('data-url')||'').match(/\/Tphoto\/ID[0-9a-f-]+/i)||[])[0];if(id&&img)fotos.set(id,img);}
      if(Number.isInteger(total)&&total>0&&fotos.size===total){out.fotos=total;out.fotosComAlt=Array.from(fotos.values()).filter(i=>(i.getAttribute('alt')||'').trim()).length;out.fotosComAltCompletos=true;out.fotosComLegenda=Array.from(g.querySelectorAll('.thumbItens[data-mediaid]')).filter(t=>(t.getAttribute('data-description')||'').trim()).length;}
    }
    const video=doc.querySelector('#videoContent'),urls=video?Array.from(video.querySelectorAll('.thumbItens.video[data-url]')).map(e=>e.getAttribute('data-url').trim()):[];
    if(urls.length&&urls.every(u=>/^https?:\/\//i.test(u)))out.videos=new Set(urls).size;
  }
  const alternativos=new Map();for(const l of doc.querySelectorAll('link[rel=alternate][hreflang]')){const k=l.hreflang.slice(0,2).toUpperCase();if(['PT','EN','FR','DE','ES'].includes(k)&&!alternativos.has(k)&&/^https?:\/\/(?:www\.)?janela-imobiliaria\.com\//.test(l.href))alternativos.set(k,l.href);}
  let feitos=0;ui.estado('A ler títulos e descrições nos idiomas disponíveis…');
  await Promise.all(Array.from(alternativos).map(async([k,url])=>{try{const j=ld(new DOMParser().parseFromString(await fetchClara(url,false),'text/html'));if(!j)throw Error('Idioma não lido');out.textos[k]={titulo:j.name||'',descricao:j.description||''};}catch(e){out.textos[k]={erro:true};}finally{feitos++;ui.estado('Idiomas lidos: '+feitos+' de '+alternativos.size+'…');}}));
  const atual=(doc.documentElement.lang||'').slice(0,2).toUpperCase();if(['PT','EN','FR','DE','ES'].includes(atual)&&(!out.textos[atual]||out.textos[atual].erro))out.textos[atual]={titulo:me.name||'',descricao:me.description||''};if(!out.textos.PT)out.textos.PT={erro:true};
  if(!out.ref)throw Error('A referência do imóvel não ficou identificada.');
  return out;
}
