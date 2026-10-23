(async () => {
  /* CLARA_UI */
  const ui=painelMarcadorClara();if(!ui)return;
  /* IDEALISTA_COLLECTOR */
  if (/^(?:www\.)?idealista\.pt$/.test(location.hostname)) {
    try {ui.estado('A ler a página do Idealista…');const d=recolherIdealista(document,{url:location.href,lido:new Date().toISOString()});if(d.tipo==='geral'){ui.estado('A ler totais e gráfico diário de contactos…');try{await recolherDiariosIdealista(document,d);}catch(e){d.avisoSerie=e.message;}}
    await ui.concluir('CLARA2:'+JSON.stringify(d),d.registos.length+' registos · '+d.cobertura+'.','Idealista: estatísticas',d.avisoSerie?'O gráfico diário não foi recolhido; os totais mantêm-se disponíveis.':'');}catch(e){ui.falhar(e.message);}return;
  }
  if (!/^(?:www\.)?janela-imobiliaria\.com$/.test(location.hostname)){ui.falhar('Abre a página pública do imóvel no site da Janela, ou uma página de lista/estatísticas do Idealista.');return;}
  try {
  ui.estado('A ler a ficha do imóvel…');
  const ld = d => { for (const s of d.querySelectorAll('script[type="application/ld+json"]')) { try { const j = JSON.parse(s.textContent); if (j['@type'] === 'RealEstateListing') return j; } catch (e) {} } return null; };
  const me = ld(document);
  if(!me){ui.falhar('Esta página não é uma ficha de imóvel. Abre o anúncio e volta a clicar no marcador.');return;}
  const ext = x => ((JSON.stringify(x).match(/\.(pdf|jpe?g|png|webp|gif)\b/i) || [])[1] || '?').toLowerCase().replace('jpeg', 'jpg');
  const out = { v: 1, origem: 'site', lido: new Date().toISOString(), url: location.href.split('?')[0], ref: null, textos: {} };
  let p = null;
  const u = performance.getEntriesByType('resource').map(e => e.name).find(n => /websiteapi\.egorealestate\.com\/v1\/Properties\/\d+\?.*propertyid=/.test(n));
  if (u) { try { p = await fetchClara(u,true); } catch (e) {} }
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
  const alternativos=new Map();for(const l of document.querySelectorAll('link[rel=alternate][hreflang]')){const k=l.hreflang.slice(0,2).toUpperCase();if(['PT','EN','FR','DE','ES'].includes(k)&&!alternativos.has(k)&&/^https?:\/\/(?:www\.)?janela-imobiliaria\.com\//.test(l.href))alternativos.set(k,l.href);}
  let feitos=0;ui.estado('A ler títulos e descrições nos idiomas disponíveis…');
  await Promise.all(Array.from(alternativos).map(async([k,url])=>{try{const j=ld(new DOMParser().parseFromString(await fetchClara(url,false),'text/html'));if(!j)throw Error('Idioma não lido');out.textos[k]={titulo:j.name||'',descricao:j.description||''};}catch(e){out.textos[k]={erro:true};}finally{feitos++;ui.estado('Idiomas lidos: '+feitos+' de '+alternativos.size+'…');}}));
  const atual=(document.documentElement.lang||'').slice(0,2).toUpperCase();if(['PT','EN','FR','DE','ES'].includes(atual)&&(!out.textos[atual]||out.textos[atual].erro))out.textos[atual]={titulo:me.name||'',descricao:me.description||''};if(!out.textos.PT)out.textos.PT={erro:true};
  if(!out.ref){ui.falhar('Não consegui identificar a referência. Confirma que abriste a ficha completa do imóvel e volta a tentar.');return;}
  const falharam=Object.values(out.textos).filter(x=>x.erro).length;await ui.concluir('CLARA1:'+JSON.stringify(out),out.ref+' · '+(out.fotos===null||out.fotos===undefined?'fotografias por verificar':out.fotos+' fotografias')+'.','eGO: estado',(out.parcial?'Leitura parcial: há campos por verificar. ':'')+(falharam?falharam+' idioma(s) não foram lidos; não serão tratados como vazios.':''));
  }catch(e){ui.falhar(e.name==='AbortError'?'A página demorou demasiado. Volta a tentar.':e.message||'Volta a tentar na página do imóvel.');}
})();
