importScripts('core.js');
let ativo=null,pedidoAtual="";
const LIMITE_RELATORIO_MS=90000;
async function comLimite(operacao,ms,nome){let timer;try{return await Promise.race([Promise.resolve().then(operacao),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('O relatório '+nome+' excedeu 90 segundos. Atualiza esse relatório antes de repetir.')),ms);})]);}finally{clearTimeout(timer);}}
const guardar=state=>chrome.storage.session.set({clara:{...state,pedido:pedidoAtual,versao:"0.3.0",quando:Date.now()}});
async function abrir(tipo){const url=RM_RELATORIOS[tipo],tabs=await chrome.tabs.query({url:url+'*'}),exatas=tabs.filter(t=>rmUrlPermitido(t.url,tipo));if(exatas.length>1)throw Error('Há vários separadores deste relatório. Mantém apenas um para evitar escolher filtros errados.');if(exatas.length)return exatas[0];return chrome.tabs.create({url,active:false});}
async function recolher(tipo){const tab=await abrir(tipo);if(tipo==='leads'){await chrome.tabs.update(tab.id,{active:true});}for(let i=0;i<80;i++){const t=await chrome.tabs.get(tab.id);if(!rmUrlPermitido(t.url,tipo)){if(t.status==='complete')throw Error('Inicia sessão no separador '+tipo+' e volta a tentar.');}else if(t.status==='complete'){const r=await chrome.scripting.executeScript({target:{tabId:tab.id},world:'ISOLATED',func:(kind)=>kind==='leads'?!!document.querySelector('[data-testid="stat-value-total-leads"]'):!!document.querySelector('#property-performance-report .export-report'),args:[tipo]});if(r[0]?.result)break;}if(i===79)throw Error('O relatório não terminou de carregar.');await new Promise(r=>setTimeout(r,250));}
const atual=await chrome.tabs.get(tab.id);if(!rmUrlPermitido(atual.url,tipo))throw Error('O separador mudou.');
await chrome.scripting.executeScript({target:{tabId:tab.id},world:'MAIN',files:['collectors.js']});
const result=await chrome.scripting.executeScript({target:{tabId:tab.id},world:'MAIN',func:async(kind)=>{const raiz=document.documentElement,chave='claraRightmoveExt';if(raiz.dataset[chave])return{ok:false,erro:'Já existe uma recolha neste separador. Aguarda o fim antes de repetir.'};raiz.dataset[chave]='busy';try{const d=await recolherRightmove(document,{estado(){}});d.marcadorVersao='20261028.2';return {ok:true,d};}catch(e){return{ok:false,erro:String(e.message||e).slice(0,600)};}finally{delete raiz.dataset[chave];}},args:[tipo]});
if(!rmUrlPermitido((await chrome.tabs.get(tab.id)).url,tipo))throw Error('O relatório mudou durante a leitura.');const r=result[0]?.result;if(!r?.ok)throw Error(r?.erro||'Sem resposta do relatório.');return r.d;}
async function recolherFichaAtual(){
 const tabs=await chrome.tabs.query({active:true,currentWindow:true});const tab=tabs[0];
 if(!tab||!fichaUrlPermitido(tab.url))throw Error('Abre a página pública do imóvel no website da agência e clica em Ler este imóvel. A ficha interna do eGO não é lida nesta versão.');
 const inicio=tab.url;await chrome.scripting.executeScript({target:{tabId:tab.id},world:'MAIN',files:['ego-collector.js']});
 const results=await chrome.scripting.executeScript({target:{tabId:tab.id},world:'MAIN',func:async()=>{const raiz=document.documentElement;if(raiz.dataset.claraFichaBusy)return{ok:false,erro:'Já existe uma leitura deste imóvel. Atualiza a página antes de repetir.'};raiz.dataset.claraFichaBusy='true';try{return{ok:true,d:await recolherFichaClara(document,{estado(){}})};}catch(e){return{ok:false,erro:String(e.message||e).slice(0,600)};}finally{delete raiz.dataset.claraFichaBusy;}}});
 if((await chrome.tabs.get(tab.id)).url!==inicio)throw Error('A página mudou durante a leitura. Não vou copiar outro imóvel.');
 const result=results[0]?.result;if(!result?.ok)throw Error(result?.erro||'A ficha não respondeu.');
 const info=resumoFichaClara(result.d);return{d:result.d,info};
}
function identificarExtensao(d){
 d.recolha={ferramenta:'extensao',versao:'0.3.0'};
 if(Array.isArray(d.blocos))for(const b of d.blocos){const prefixo=b.texto.slice(0,7),x=JSON.parse(b.texto.slice(7));x.recolha={...d.recolha};b.texto=prefixo+JSON.stringify(x);}
 return d;
}
async function recolherPortalAtual(tipo){
 const [tab]=await chrome.tabs.query({active:true,currentWindow:true});
 if(!tab||!portalUrlPermitido(tab.url,tipo))throw Error(tipo==='idealista'?'Abre Estatísticas dos teus anúncios no Idealista.':'Abre Resumo da conta ou Anúncios no Green-Acres.');
 const inicio=tab.url;await chrome.scripting.executeScript({target:{tabId:tab.id},world:'MAIN',files:['portal-collectors.js']});
 const results=await chrome.scripting.executeScript({target:{tabId:tab.id},world:'MAIN',func:async(kind)=>{
  const raiz=document.documentElement;if(raiz.dataset.claraPortalBusy)return{ok:false,erro:'Já existe uma recolha nesta página. Aguarda o fim antes de repetir.'};
  raiz.dataset.claraPortalBusy='true';
  try{const ui={estado(){}};let d;
   if(kind==='green-acres')d=/^\/pt\/Agent\/?$/.test(location.pathname)?await recolherConjuntoGreen(document,ui):await recolherGreenAcres(document,ui);
   else{d=recolherIdealista(document,{url:location.href,lido:new Date().toISOString()});if(d.tipo==='geral')d=await recolherConjuntoIdealista(document,d,ui);else if(d.tipo==='ranking')d=await recolherExcelIdealista(document,d,ui);else throw Error('Abre Gráfico ou Ranking dos teus anúncios.');}
   return{ok:true,d};
  }catch(e){return{ok:false,erro:String(e.message||e).slice(0,600)};}finally{delete raiz.dataset.claraPortalBusy;}
 },args:[tipo]});
 if((await chrome.tabs.get(tab.id)).url!==inicio)throw Error('A página mudou durante a recolha. A leitura não foi copiada.');
 const r=results[0]?.result;if(!r?.ok)throw Error(r?.erro||'O portal não respondeu.');
 const prefixo=validarPortalClara(r.d,tipo);return{d:identificarExtensao(r.d),prefixo};
}
async function executarPortal(tipo){
 const destino=(tipo==='idealista'?'Idealista':'Green-Acres')+': estatísticas';
 await guardar({estado:'a-recolher',destino,mensagem:'A recolher exportações e anúncios do portal…'});
 try{const {d,prefixo}=await comLimite(()=>recolherPortalAtual(tipo),LIMITE_RELATORIO_MS,'do portal');
 const faltas=d.faltas||[],resumo=d.v===6?[d.blocos.length+' blocos recolhidos',...d.blocos.map(b=>b.nome)]:[d.tipo==='anuncios'?d.total+' anúncios':d.fonte||'Relatório recolhido'];
 await guardar({estado:'pronto',destino,texto:prefixo+JSON.stringify(d),resumo,faltas,mensagem:faltas.length?'Recolha incompleta. Revê os blocos em falta antes de guardar.':'Leitura pronta. Revê os períodos e confirma no Sheets.'});
 }catch(e){await guardar({estado:'erro',destino,mensagem:String(e.message||e).slice(0,600)});}finally{ativo=null;}
}
async function executarFicha(){await guardar({estado:'a-recolher',mensagem:'A ler o imóvel e os idiomas disponíveis…',destino:'eGO: estado'});try{const {d,info}=await comLimite(recolherFichaAtual,LIMITE_RELATORIO_MS,'do imóvel');await guardar({estado:'pronto',destino:'eGO: estado',texto:'CLARA1:'+JSON.stringify(identificarExtensao(d)),resumo:['Imóvel '+info.ref,'CONFIRMADO NESTA LEITURA',...info.confirmados,'POR VERIFICAR',...info.porVerificar],faltas:[],mensagem:'Leitura pronta. Os campos por verificar não serão reconfirmados. Cola em Clara > eGO: estado para rever e guardar.'});}catch(e){await guardar({estado:'erro',destino:'eGO: estado',mensagem:String(e.message||e).slice(0,600)});}finally{ativo=null;}}
async function executar(){await guardar({estado:'a-recolher',mensagem:'A recolher os dois relatórios…'});try{const r=await Promise.allSettled(['leads','performance'].map(tipo=>comLimite(()=>recolher(tipo),LIMITE_RELATORIO_MS,tipo))),d=rmJuntar(r);await guardar({estado:'pronto',texto:'CLARA6:'+JSON.stringify(identificarExtensao(d)),resumo:d.blocos.map(b=>{const x=JSON.parse(b.texto.slice(7));return b.nome==='leads'?x.totais.total+' leads · '+x.periodo.inicio+' a '+x.periodo.fim:x.total+' anúncios · '+(x.tipo==='performance_csv'?'CSV 30/60/90 dias':'leitura da página; CSV indisponível');}),faltas:d.faltas,mensagem:d.faltas.length?'Recolha incompleta. Revê o que falta.':'Dois relatórios recolhidos. Revê os períodos e a agência no Sheets.'});}catch(e){await guardar({estado:'erro',mensagem:String(e.message||e).slice(0,600)});}finally{ativo=null;}}
chrome.runtime.onMessage.addListener((m,sender,reply)=>{if(sender.id!==chrome.runtime.id)return;if(m?.acao==='estado'){reply({ativo:!!ativo});return;}if(m?.acao==='iniciar'){if(!ativo){if(typeof m.pedido!=='string'||!/^[a-zA-Z0-9-]{1,80}$/.test(m.pedido)){reply({erro:'Pedido de recolha inválido.'});return;}if(!['ego','rightmove','idealista','green-acres'].includes(m.tipo)){reply({erro:'Ação de recolha desconhecida.'});return;}pedidoAtual=m.pedido;ativo=m.tipo==='ego'?executarFicha():m.tipo==='rightmove'?executar():executarPortal(m.tipo);}reply({iniciado:true,pedido:pedidoAtual});}if(m?.acao==='limpar'){if(ativo){reply({erro:'A recolha ainda está em curso.'});return;}chrome.storage.session.remove('clara').then(()=>reply({ok:true}));return true;}});
