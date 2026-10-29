function recolherLigacaoPublica(doc){
 const clean=s=>String(s||'').replace(/\s+/g,' ').trim(),p=location.hostname.endsWith('green-acres.pt')?'green-acres':'rightmove',url=location.origin+location.pathname;let id='',ref='';
 if(p==='green-acres'){
 const pairs=[...doc.querySelectorAll('.agency-details .label-value')].map(e=>[clean(e.querySelector('label')?.textContent),clean(e.querySelector('p')?.textContent)]);const refs=pairs.filter(x=>x[0]==='Número de mandato').map(x=>x[1]),ids=pairs.filter(x=>x[0]==='Referência').map(x=>x[1]);if(refs.length!==1||ids.length!==1)throw Error('A referência da ficha não ficou identificada sem ambiguidade.');ref=refs[0];id=ids[0];
 }else{const m=/^\/properties\/(\d+)\/?$/.exec(location.pathname);if(!m)throw Error('Abre a ficha de um imóvel no Rightmove.');id=m[1];const refs=[...(doc.body.innerText||doc.body.textContent).matchAll(/#ref\s*:\s*((?:[A-ZÀ-ÖØ-Þ]{1,6}[ _-]?)?\d{3,10}(?: ?[_-][A-ZÀ-ÖØ-Þ0-9]{1,8}| \(\d{1,3}\))?)(?![A-ZÀ-ÖØ-Þ0-9_-]|\s*\()/gi)].map(m=>clean(m[1]).toUpperCase()).filter(ipRefPublica);if(new Set(refs).size!==1)throw Error('Referência original ausente ou ambígua na descrição.');ref=refs[0];}
 if(!/^\d{1,20}$/.test(id)||!ipRefPublica(ref))throw Error('Referência inválida na ficha.');return{v:5,origem:p,tipo:'ligacao',id,refEgo:ref.toUpperCase(),url,lido:new Date().toISOString(),marcadorVersao:'20261026.2'};
}
function ipRefPublica(s){return typeof s==='string'&&s.length<=40&&/^(?:[A-ZÀ-ÖØ-Þ]{1,6}[ _-]?)?\d{3,10}(?: ?[_-][A-ZÀ-ÖØ-Þ0-9]{1,8}| \(\d{1,3}\))?$/i.test(s);}
