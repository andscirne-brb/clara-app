/* Leitura em massa das fichas públicas: usa o mesmo coletor da leitura individual, separador a separador.
   Os resultados ficam em chrome.storage.local (só neste computador) até serem copiados por lotes para o Sheets. */
const MASSA={versao:'0.5.1',paralelo:3,porLote:25,limiteFichaMs:60000,sitemap:'https://www.janela-imobiliaria.com/sitemap-pt-pt.xml'};
let massaAtiva=null,massaParar=false;
const esperar=ms=>new Promise(r=>setTimeout(r,ms));
const caminhoFicha=u=>{try{const x=new URL(u);return decodeURI(x.pathname).replace(/\/+$/,'').toLowerCase();}catch(e){return '';}};
async function massaEstado(){return (await chrome.storage.local.get('massa')).massa||null;}
async function massaGuardar(m){m.quando=Date.now();await chrome.storage.local.set({massa:m});}

async function urlsDoSitemap(){
 const r=await fetch(MASSA.sitemap,{cache:'no-store'});if(!r.ok)throw Error('Não consegui abrir a lista de imóveis do site ('+r.status+').');
 const xml=await r.text(),vistos=new Set(),urls=[];
 for(const m of xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)){const u=m[1].replace(/&amp;/g,'&');if(!fichaUrlPermitido(u)||!/^https:\/\/(?:www\.)?janela-imobiliaria\.com\/casasvenda\//.test(u))continue;/* Só fichas de imóveis: notícias e empreendimentos ficam de fora. */const id=(u.match(/\/(\d+)\/?$/)||[])[1];if(!id||vistos.has(id))continue;vistos.add(id);urls.push(u);}
 if(!urls.length)throw Error('A lista do site não tem fichas de imóveis.');if(urls.length>2000)throw Error('A lista do site tem um número inesperado de páginas ('+urls.length+').');
 return urls;
}

async function lerFichaEmSeparador(tabId,url){
 await chrome.tabs.update(tabId,{url});const fim=Date.now()+MASSA.limiteFichaMs,alvo=caminhoFicha(url);
 let outra=0;
 for(;;){const t=await chrome.tabs.get(tabId),aqui=caminhoFicha(t.url||t.pendingUrl||'');
  if(t.status==='complete'&&aqui===alvo)break;
  if(t.status==='complete'&&t.url&&!t.url.startsWith('about:')&&aqui!==alvo){if(!outra)outra=Date.now();else if(Date.now()-outra>4000)throw Error('A página redirecionou para outro endereço; o imóvel pode ter sido retirado do site.');}else outra=0;
  if(Date.now()>fim)throw Error('A página não carregou a tempo.');await esperar(300);}
 await chrome.scripting.executeScript({target:{tabId},world:'MAIN',files:['ego-collector.js']});
 const res=await chrome.scripting.executeScript({target:{tabId},world:'MAIN',func:async()=>{const raiz=document.documentElement;if(raiz.dataset.claraFichaBusy)return{ok:false,erro:'Leitura repetida no mesmo separador.'};raiz.dataset.claraFichaBusy='true';try{return{ok:true,d:await recolherFichaClara(document,{estado(){}})};}catch(e){return{ok:false,erro:String(e.message||e).slice(0,300)};}finally{delete raiz.dataset.claraFichaBusy;}}});
 if(caminhoFicha((await chrome.tabs.get(tabId)).url)!==alvo)throw Error('A página mudou durante a leitura.');
 const r=res[0]?.result;if(!r?.ok)throw Error(r?.erro||'A ficha não respondeu.');
 /* Em massa, só serve a leitura completa pela API da página: a parcial deixaria valores antigos (ex.: alt texts) sem confirmar. */
 if(r.d.parcial)throw Error('Os dados da ficha não ficaram disponíveis a tempo (leitura parcial). Volta a tentar este imóvel.');
 resumoFichaClara(r.d);return r.d;
}

async function comPrazo(p,ms,erro){let t;try{return await Promise.race([p,new Promise((_,rej)=>{t=setTimeout(()=>rej(Error(erro)),ms);})]);}finally{clearTimeout(t);}}

async function executarMassa(continuar,limite){
 const manter=setInterval(()=>{chrome.runtime.getPlatformInfo().catch(()=>{});},20000);let janela=null;massaParar=false;
 try{
  let m=continuar?await massaEstado():null;
  if(!m||!continuar){
   const todas=await urlsDoSitemap(),urls=limite?todas.slice(0,limite):todas;
   await chrome.storage.local.clear();
   m={v:1,pedido:crypto.randomUUID(),estado:'a-ler',versao:MASSA.versao,inicio:new Date().toISOString(),teste:!!limite,urls,feitos:0,falhas:[],lotes:0,copiados:[]};await massaGuardar(m);
  }else{if(m.estado==='concluido')return;m.estado='a-ler';await massaGuardar(m);}
  const pendentes=[];for(let i=0;i<m.urls.length;i++){if(!(await chrome.storage.local.get('ficha:'+i))['ficha:'+i])pendentes.push(i);}
  janela=await chrome.windows.create({url:'about:blank',focused:false,state:'minimized'});
  const tabs=[(await chrome.tabs.query({windowId:janela.id}))[0].id];for(let k=1;k<MASSA.paralelo;k++)tabs.push((await chrome.tabs.create({windowId:janela.id,url:'about:blank',active:false})).id);
  let cursor=0;
  const trabalhador=async tabId=>{while(!massaParar&&cursor<pendentes.length){const i=pendentes[cursor++],url=m.urls[i];let r;
   for(let tentativa=1;tentativa<=2;tentativa++){try{const d=await comPrazo(lerFichaEmSeparador(tabId,url),MASSA.limiteFichaMs+30000,'A leitura do imóvel excedeu o tempo previsto.');d.recolha={ferramenta:'extensao',versao:MASSA.versao,modo:'massa',pedido:m.pedido};r={ok:true,d};break;}catch(e){r={ok:false,url,erro:String(e.message||e).slice(0,300)};if(/redirecionou/.test(r.erro))break;await chrome.tabs.update(tabId,{url:'about:blank'}).catch(()=>{});await esperar(1500);}}
   await chrome.storage.local.set({['ficha:'+i]:r});m.feitos++;if(!r.ok)m.falhas.push({url:r.url,erro:r.erro});if(m.feitos%3===0)await massaGuardar(m);}};
  await Promise.all(tabs.map(trabalhador));
  if(massaParar){m.estado='parado';await massaGuardar(m);return;}
  /* Lotes: só fichas lidas com sucesso, sem referências repetidas. */
  const fichas=[],refs=new Map();
  for(let i=0;i<m.urls.length;i++){const r=(await chrome.storage.local.get('ficha:'+i))['ficha:'+i];if(!r?.ok)continue;const ref=r.d.ref;if(refs.has(ref)){m.falhas.push({url:m.urls[i],erro:'Referência '+ref+' repetida noutra página do site ('+refs.get(ref)+'). Não incluída.'});continue;}refs.set(ref,m.urls[i]);fichas.push(r.d);}
  m.falhas=m.falhas.filter((f,i,a)=>a.findIndex(x=>x.url===f.url&&x.erro===f.erro)===i);
  const n=Math.ceil(fichas.length/MASSA.porLote);
  for(let k=0;k<n;k++){const parte=fichas.slice(k*MASSA.porLote,(k+1)*MASSA.porLote);await chrome.storage.local.set({['lote:'+(k+1)]:'CLARA7:'+JSON.stringify({v:7,origem:'site',tipo:'lote-imoveis',pedido:m.pedido,lote:k+1,lotes:n,totalLidos:fichas.length,totalSite:m.urls.length,lido:m.inicio,recolha:{ferramenta:'extensao',versao:MASSA.versao,modo:'massa'},fichas:parte})});}
  /* Texto único com todas as fichas: uma só colagem no Sheets, gravação contínua e retomável no painel. */
  if(fichas.length)await chrome.storage.local.set({todos:'CLARA7:'+JSON.stringify({v:7,origem:'site',tipo:'lote-imoveis',modo:'todos',pedido:m.pedido,lote:1,lotes:1,totalLidos:fichas.length,totalSite:m.urls.length,lido:m.inicio,recolha:{ferramenta:'extensao',versao:MASSA.versao,modo:'massa'},fichas})});
  m.lotes=n;m.lidos=fichas.length;m.estado='concluido';m.fim=new Date().toISOString();await massaGuardar(m);
 }catch(e){const m=await massaEstado()||{v:1};m.estado='erro';m.erro=String(e.message||e).slice(0,400);await massaGuardar(m);}
 finally{clearInterval(manter);if(janela)await chrome.windows.remove(janela.id).catch(()=>{});massaAtiva=null;}
}

chrome.runtime.onMessage.addListener((msg,sender,reply)=>{
 if(sender.id!==chrome.runtime.id||!msg||typeof msg.massa!=='string')return;
 if(msg.massa==='estado'){reply({ativa:!!massaAtiva});return;}
 if(msg.massa==='iniciar'||msg.massa==='continuar'){
  if(massaAtiva||ativo){reply({erro:'Já existe uma leitura em curso.'});return;}
  const limite=msg.massa==='iniciar'&&Number.isInteger(msg.limite)&&msg.limite>0&&msg.limite<=50?msg.limite:0;
  massaAtiva=executarMassa(msg.massa==='continuar',limite);reply({ok:true});return;
 }
 if(msg.massa==='parar'){massaParar=true;reply({ok:true});return;}
 if(msg.massa==='lote'){chrome.storage.local.get('lote:'+msg.n).then(async x=>{const t=x['lote:'+msg.n];if(t){const m=await massaEstado();if(m&&!m.copiados.includes(msg.n)){m.copiados.push(msg.n);await massaGuardar(m);}}reply({texto:t||''});});return true;}
 if(msg.massa==='marcar'){massaEstado().then(async m=>{if(m&&!m.copiados.includes(msg.n)){m.copiados.push(msg.n);await massaGuardar(m);}reply({ok:true});});return true;}
 if(msg.massa==='todos'){chrome.storage.local.get('todos').then(x=>reply({texto:x.todos||''}));return true;}
 if(msg.massa==='limpar'){if(massaAtiva){reply({erro:'A leitura ainda está em curso.'});return;}chrome.storage.local.clear().then(()=>reply({ok:true}));return true;}
});
