function ipIdentidadePublica_(c,html){
 const tag=/<link\b[^>]*\brel\s*=\s*["']canonical["'][^>]*>/i.exec(html),canonical=tag&&/\bhref\s*=\s*["']([^"']+)["']/i.exec(tag[0]);
 if(c.portal==='Rightmove')return !!(canonical&&canonical[1].replace(/\/$/,'')===ipUrl_('Rightmove',c.id));
 const blocks=html.match(/<div\b[^>]*class=["'][^"']*\blabel-value\b[^"']*["'][^>]*>[\s\S]{0,2000}?<\/div>/gi)||[],ids=[];blocks.forEach(b=>{const l=/<label[^>]*>([\s\S]*?)<\/label>/i.exec(b),v=/<p[^>]*>([\s\S]*?)<\/p>/i.exec(b);if(l&&v&&ipTexto_(l[1]).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase()==='referencia')ids.push(ipTexto_(v[1]));});return ids.length===1&&ids[0]===c.id;
}
function ipLerPublicas_(items){
 let work=items.map(c=>({c,url:ipUrl_(c.portal,c.id,c.url),done:false,ref:'',erro:''}));
 for(let hop=0;hop<4;hop++){const pending=work.filter(w=>!w.done);if(!pending.length)break;const requests=pending.map(w=>({url:w.url,followRedirects:false,muteHttpExceptions:true,method:'get',headers:{Accept:'text/html'}}));let responses;try{responses=UrlFetchApp.fetchAll(requests);}catch(e){responses=requests.map(req=>{try{return UrlFetchApp.fetch(req.url,req);}catch(err){return null;}});}
 responses.forEach((res,i)=>{const w=pending[i];if(!res){w.erro='Acesso indisponível a partir do Google; confirmar referência com o marcador na ficha pública.';w.done=true;return;}const status=res.getResponseCode();if([301,302,303,307,308].includes(status)){const h=res.getAllHeaders(),loc=String(h.Location||h.location||'');let u=loc;if(loc.startsWith('/'))u=(w.c.portal==='Green-Acres'?'https://www.green-acres.pt':'https://www.rightmove.co.uk')+loc;const allowed=w.c.portal==='Green-Acres'?ipUrl_(w.c.portal,w.c.id,u):/^https:\/\/www\.rightmove\.co\.uk\/properties\/\d+(?:#.*)?$/.test(u)?u.split('#')[0]===ipUrl_('Rightmove',w.c.id)?u.split('#')[0]:'':'';if(!allowed||w.c.portal==='Green-Acres'&&/\/([A-Za-z0-9]+)\.htm$/.exec(allowed)[1].toLowerCase()!==/\/([A-Za-z0-9]+)\.htm$/.exec(w.c.url)[1].toLowerCase())w.erro='Redirecionamento inesperado; por rever.';else if(hop===3)w.erro='Demasiados redirecionamentos.';else{w.url=allowed;return;}}
 else if(status===200){try{const html=res.getContentText();if(!ipIdentidadePublica_(w.c,html))throw Error('A identidade do anúncio não ficou confirmada na resposta pública.');w.ref=ipExtrairRef_(w.c.portal,html);if(!w.ref)w.erro='Referência original não encontrada na ficha pública.';}catch(e){w.erro=e.message;}}
 else w.erro='Ficha indisponível (HTTP '+status+'); por rever, sem contornar o acesso.';w.done=true;});}
 return work;
}
