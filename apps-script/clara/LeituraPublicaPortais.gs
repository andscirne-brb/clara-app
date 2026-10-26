function ipLerPublicas_(items){
 let work=items.map(c=>({c,url:ipUrl_(c.portal,c.id,c.url),done:false,ref:'',erro:''}));
 for(let hop=0;hop<4;hop++){const pending=work.filter(w=>!w.done);if(!pending.length)break;const responses=UrlFetchApp.fetchAll(pending.map(w=>({url:w.url,followRedirects:false,muteHttpExceptions:true,method:'get',headers:{Accept:'text/html'}})));
 responses.forEach((res,i)=>{const w=pending[i],status=res.getResponseCode();if([301,302,303,307,308].includes(status)){const h=res.getAllHeaders(),loc=String(h.Location||h.location||'');let u=loc;if(loc.startsWith('/'))u=(w.c.portal==='Green-Acres'?'https://www.green-acres.pt':'https://www.rightmove.co.uk')+loc;const allowed=w.c.portal==='Green-Acres'?ipUrl_(w.c.portal,w.c.id,u):/^https:\/\/www\.rightmove\.co\.uk\/properties\/\d+(?:#.*)?$/.test(u)?u.split('#')[0]===ipUrl_('Rightmove',w.c.id)?u.split('#')[0]:'':'';if(!allowed||w.c.portal==='Green-Acres'&&/\/([A-Za-z0-9]+)\.htm$/.exec(allowed)[1].toLowerCase()!==/\/([A-Za-z0-9]+)\.htm$/.exec(w.c.url)[1].toLowerCase())w.erro='Redirecionamento inesperado; por rever.';else if(hop===3)w.erro='Demasiados redirecionamentos.';else{w.url=allowed;return;}}
 else if(status===200){try{w.ref=ipExtrairRef_(w.c.portal,res.getContentText());if(!w.ref)w.erro='Referência original não encontrada na ficha pública.';}catch(e){w.erro=e.message;}}
 else w.erro='Ficha indisponível (HTTP '+status+'); por rever, sem contornar o acesso.';w.done=true;});}
 return work;
}
