/* Carteira atual: lista oficial de publicação, nunca o ranking do período. */
function lerPaginaAtivosIdealista(doc){
 const text=doc.body.textContent.replace(/\s+/g,' '),total=/(\d+)\s*\/\s*(?:\d+|ilimitado)\s*em idealista\b/i.exec(text);
 if(!total)throw Error('O total da carteira ativa não ficou identificado.');
 const records=Array.from(doc.querySelectorAll('ul.row')).filter(r=>r.querySelector('a[href*="/tools/propiedad/"]')).map(r=>{const a=r.querySelector('a[href*="/tools/propiedad/"]'),m=/\/tools\/propiedad\/(\d+)\//.exec(a.getAttribute('href')||''),ref=r.querySelector('[title^="Ref."]');if(!m||!ref)throw Error('Uma referência da carteira não ficou identificada.');const value=ref.getAttribute('title').replace(/^Ref\.\s*/,'').trim();if(!value||value.length>100)throw Error('Referência inválida na carteira.');return{id:m[1],ref:value};});
 return{total:Number(total[1]),registos:records};
}
function juntarPaginasAtivosIdealista(pages,expected){
 if(!Number.isInteger(expected)||expected<0||expected>1000||!pages.length||pages.some(p=>p.total!==expected))throw Error('O total dos anúncios ativos mudou durante a leitura.');
 const ids=new Set(),records=[];for(const p of pages)for(const r of p.registos){if(ids.has(r.id))throw Error('Uma página repetiu anúncios. Não confirmei a carteira.');ids.add(r.id);records.push(r);}
 if(records.length!==expected)throw Error('A carteira ficou incompleta: '+records.length+' de '+expected+' anúncios.');
 return records.sort((a,b)=>a.id.localeCompare(b.id));
}
async function recolherAtivosIdealista(doc,d,ui){
 const link=Array.from(doc.querySelectorAll('a[href]')).find(a=>/\d+\s+anúncios ativos hoje/.test(a.textContent));if(!link)throw Error('A ligação para os anúncios ativos não está disponível.');
 const url=new URL(link.getAttribute('href'),d.url),origin=new URL(d.url).origin,expected=d.registos[0].metricas.anunciosAtivosHoje;
 if(url.origin!==origin||url.pathname!=='/tools/publicacion/idealista'||url.searchParams.get('ScopeId')!=='1')throw Error('A ligação da carteira não foi reconhecida.');
 const initial=recolherIdealista(doc,{url:d.url,lido:d.lido});if(JSON.stringify([initial.periodo,initial.filtros,initial.registos])!==JSON.stringify([d.periodo,d.filtros,d.registos]))throw Error('As estatísticas mudaram antes da leitura da carteira.');const start=JSON.stringify(initial);
 const rendered=async(u)=>{const frame=doc.createElement('iframe');frame.setAttribute('aria-hidden','true');frame.tabIndex=-1;frame.style.cssText='position:fixed;left:-10000px;top:0;width:1200px;height:800px;pointer-events:none;';frame.src=u.href;doc.body.appendChild(frame);try{let previous='',stable=0;for(let i=0;i<100;i++){await new Promise(r=>setTimeout(r,120));try{const location=new URL(frame.contentWindow.location.href);if(location.origin!==origin||location.pathname!==url.pathname)continue;const data=lerPaginaAtivosIdealista(frame.contentDocument),sig=JSON.stringify(data);stable=sig===previous?stable+1:0;previous=sig;if((data.registos.length||data.total===0)&&stable>=5)return data;}catch(e){}}throw Error('A lista de ativos não terminou de carregar.');}finally{frame.remove();}};
 const load=async(page)=>{const u=new URL(url);u.searchParams.set('CurrentPage',page);u.searchParams.set('OrderBy','activeAds');u.searchParams.set('OrderedType','desc');const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),12000);try{const res=await fetch(u.href,{credentials:'same-origin',cache:'no-store',signal:controller.signal});if(!res.ok||new URL(res.url).origin!==origin||new URL(res.url).pathname!==url.pathname)throw Error('A sessão ou a lista dos anúncios ativos não está disponível.');const parsed=new DOMParser().parseFromString(await res.text(),'text/html');let result;try{result=lerPaginaAtivosIdealista(parsed);}catch(e){return await rendered(u);}return !result.registos.length&&expected?await rendered(u):result;}finally{clearTimeout(timer);}};
 ui.estado('A recolher a carteira ativa: página 1…');const first=await load(1),pages=[first],size=first.registos.length;
 if(first.total!==expected||(!size&&expected))throw Error('A lista de ativos não coincide com o total das estatísticas.');
 const count=expected?Math.ceil(expected/size):1;if(count>50)throw Error('Demasiadas páginas para conferir a carteira.');
 for(let page=2;page<=count;page++){ui.estado('Carteira ativa: página '+page+' de '+count+'…');pages.push(await load(page));}
 const records=juntarPaginasAtivosIdealista(pages,expected),check=await load(1);
 if(JSON.stringify(check)!==JSON.stringify(first)||start!==JSON.stringify(recolherIdealista(doc,{url:d.url,lido:d.lido})))throw Error('A carteira ou os filtros mudaram durante a leitura.');
 return{total:expected,url:url.href,paginas:count,registos:records};
}
