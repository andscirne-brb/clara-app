/* Piloto: uma leitura no Resumo Green-Acres, mantendo fontes e falhas separadas. */
async function recolherConjuntoGreen(doc,ui){
 if(location.hostname!=='back.green-acres.com'||!/^\/pt\/Agent\/?$/.test(location.pathname))throw Error('Abre o Resumo da conta Green-Acres para a recolha conjunta.');
 const hrefs=Array.from(doc.querySelectorAll('a[href]')).map(a=>new URL(a.getAttribute('href'),location.href)).filter(u=>u.origin===location.origin&&u.pathname==='/pt/Agent/Advert/List'),blocos=[],faltas=[];
 try{ui.estado('1 de 2 · A recolher cinco CSV oficiais…');const d=await recolherGreenAcres(doc,ui);blocos.push({nome:'estatisticas',texto:'CLARA4:'+JSON.stringify(d)});}catch(e){faltas.push({nome:'estatisticas',erro:String(e.message||e).slice(0,600)});}
 try{
  if(!hrefs.length)throw Error('Não encontrei a ligação oficial para a lista dos anúncios. Não usei um endereço alternativo.');
  ui.estado('2 de 2 · A abrir a lista sem mudar esta página…');const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),20000);let page;
  try{const r=await fetch(hrefs[0].href,{credentials:'same-origin',cache:'no-store',signal:controller.signal});if(!r.ok||new URL(r.url).origin!==location.origin||new URL(r.url).pathname!=='/pt/Agent/Advert/List')throw Error('A lista não respondeu com a sessão atual.');page=new DOMParser().parseFromString(await r.text(),'text/html');}finally{clearTimeout(timer);}
  const d=await recolherAnunciosGreen(page,ui);blocos.push({nome:'anuncios',texto:'CLARA4:'+JSON.stringify(d)});
 }catch(e){faltas.push({nome:'anuncios',erro:String(e.name==='AbortError'?'A lista demorou demasiado.':e.message||e).slice(0,600)});}
 if(!blocos.length)throw Error(faltas.map(f=>f.nome+': '+f.erro).join(' · '));
 return{v:6,origem:'green-acres',tipo:'conjunta',marcadorVersao:'20261028.1',lido:new Date().toISOString(),blocos,faltas};
}
