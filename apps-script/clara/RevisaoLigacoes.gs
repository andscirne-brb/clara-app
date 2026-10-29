/* Revisão explícita: não retirar sufixos nem aproximar referências do catálogo. */
function ipPlanoRevisao_(old,ego,provas,data){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(data))throw Error('Data de revisão inválida.');
 const map=new Map(),seen=new Set();
 for(const p of provas){
  const key=p.portal+'|'+p.id,previous=old.find(r=>r[0]===p.portal&&String(r[1])===p.id);
  if(!['Green-Acres','Rightmove'].includes(p.portal)||typeof p.id!=='string'||seen.has(key)||!previous||previous[4]==='Confirmada'||!ipRefValida_(p.ref))throw Error('Prova repetida ou ligação inválida para revisão.');seen.add(key);
  const url=ipUrl_(p.portal,p.id,p.url);if(!url||p.portal==='Rightmove'&&p.url.split('#')[0]!==url)throw Error('Página da prova inválida.');
  if(p.portal==='Green-Acres'&&/\/([A-Za-z0-9]+)\.htm$/.exec(url)[1].toLowerCase()!==/\/([A-Za-z0-9]+)\.htm$/.exec(previous[6])[1].toLowerCase())throw Error('A prova corresponde a outro anúncio.');
  if(previous[3]&&ipRef_(previous[3])!==p.ref)throw Error('A prova diverge da referência anterior.');
  map.set(key,p);
 }
 return old.map(r=>{
  if(r[4]==='Confirmada'||r[4]==='Conflito de referências')return r.slice();
  const p=map.get(r[0]+'|'+r[1]),a=r.slice();if(p){a[3]=p.ref;a[4]=ipEstado_(p.ref,ego);a[5]=(r[0]==='Green-Acres'?'Número de mandato':'#ref')+' explícito conferido na ficha pública';a[7]=data;a[8]='';}
  if(a[3]&&a[4]==='Referência ausente no levantamento'){
   const note='Referência explícita não consta do Levantamento atual. Atualizar a lista eGO antes de associar; não retirar sufixos nem aproximar referências.';
   if(!String(a[8]||'').includes(note))a[8]=[a[8],note].filter(Boolean).join('\n');
   a[7]=data;
  }
  return a;
 });
}
