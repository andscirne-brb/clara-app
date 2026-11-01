// Leitura de todos os imóveis com Chrome simulado e dados sintéticos (sem dados reais).
import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';
const ext=new URL('../apps-script/rightmove-extension/',import.meta.url),read=f=>fs.readFileSync(new URL(f,ext),'utf8');
const base='https://www.janela-imobiliaria.com/casasvenda/';
const ficha=n=>base+'teste-'+n+'/'+(100000+n);
const sitemap='<urlset>'+[1,2,3,4,5,6,7].map(n=>'<url><loc>'+ficha(n)+'</loc></url>').join('')+'<url><loc>'+ficha(2)+'</loc></url><url><loc>https://www.janela-imobiliaria.com/comprarcasa</loc></url></urlset>';
function criar(opcoes={}){
 const store={},tabs={},janelas=[];let proxTab=10,injecoes=0;
 const comportamento=url=>{const n=+url.match(/(\d+)$/)[1]-100000;return n===3?'redirect':n===4?'falha':n===5?'repetida':'ok';};
 const chrome={runtime:{id:'x',getPlatformInfo:async()=>({}),onMessage:{addListener(){}}},
  storage:{local:{get:async k=>k in store?{[k]:store[k]}:{},set:async o=>Object.assign(store,JSON.parse(JSON.stringify(o))),clear:async()=>{for(const k of Object.keys(store))delete store[k];}},session:{set:async()=>{},remove:async()=>{}}},
  windows:{create:async o=>{janelas.push(o);tabs[proxTab]={id:proxTab,url:'about:blank',status:'complete'};return{id:1,tabs:[{id:proxTab++}]};},remove:async()=>{janelas.pop();}},
  tabs:{query:async()=>[{id:10}],create:async()=>{tabs[proxTab]={id:proxTab,url:'about:blank',status:'complete'};return{id:proxTab++};},
   update:async(id,o)=>{const t=tabs[id];t.url=o.url&&comportamento.length&&o.url.startsWith('https')&&comportamento(o.url)==='redirect'?'https://www.janela-imobiliaria.com/':o.url;t.status='complete';return t;},get:async id=>({...tabs[id]})},
  scripting:{executeScript:async o=>{if(o.files)return[{}];injecoes++;const url=tabs[o.target.tabId].url,c=comportamento(url),n=+url.match(/(\d+)$/)[1]-100000;
   if(c==='falha')return[{result:{ok:false,erro:'A ficha não terminou de carregar.'}}];return[{result:{ok:true,d:{v:1,origem:'site',url,ref:c==='repetida'?'TST001':'TST00'+n,fotos:n,fotosComAlt:n,textos:{PT:{titulo:'T',descricao:'D'}},plantas:[],videos:0,folhetos:0,caracteristicas:1}}}];}}};
 const ctx={console,chrome,URL,Date,Promise,Error,Map,Set,JSON,crypto:{randomUUID:()=>'pedido-teste'},setTimeout:(f,ms)=>setTimeout(f,ms>=10000?ms:Math.min(ms,5)),clearTimeout,setInterval:()=>1,clearInterval(){},decodeURI,
  fetch:async u=>{assert.equal(u,'https://www.janela-imobiliaria.com/sitemap-pt-pt.xml');return{ok:true,status:200,text:async()=>sitemap};},importScripts(){}};
 vm.createContext(ctx);vm.runInContext(read('core.js')+'\n'+read('massa.js')+'\nthis.executarMassa=executarMassa;this.massaPorLote=v=>{MASSA.porLote=v;};',ctx);
 return{ctx,store,janelas,injecoes:()=>injecoes};
}
let t=criar();t.ctx.massaPorLote(2);await t.ctx.executarMassa(false,0);
let m=t.store.massa;assert.equal(m.estado,'concluido',m.erro);assert.equal(m.urls.length,7,'sitemap deduplicado e só fichas');
assert.equal(m.lidos,4);assert.equal(m.lotes,2);assert.equal(t.janelas.length,0,'janela fechada no fim');
assert.ok(m.falhas.some(f=>/redirecionou/.test(f.erro)),'redirecionamento listado');assert.ok(m.falhas.some(f=>/não terminou/.test(f.erro)),'falha listada');assert.ok(m.falhas.some(f=>/repetida/.test(f.erro)),'referência repetida listada');
const lotes=[1,2].map(n=>JSON.parse(t.store['lote:'+n].slice(7)));assert.deepEqual(lotes.map(l=>l.fichas.length),[2,2]);
for(const l of lotes){assert.equal(l.v,7);assert.equal(l.origem,'site');assert.equal(l.lotes,2);for(const f of l.fichas){assert.equal(f.v,1);assert.equal(f.recolha.modo,'massa');}}
const refs=lotes.flatMap(l=>l.fichas.map(f=>f.ref));assert.equal(new Set(refs).size,refs.length,'sem referências repetidas');assert.ok(!refs.includes('TST003')&&!refs.includes('TST004'),'falhas nunca entram nos lotes');
// Retoma: só lê o que falta.
t=criar();t.ctx.massaPorLote(25);await t.ctx.executarMassa(false,3);assert.equal(t.store.massa.urls.length,3,'modo teste limita o número de imóveis');
t.store.massa.estado='parado';delete t.store['ficha:2'];t.store.massa.feitos=2;const antes=t.injecoes();await t.ctx.executarMassa(true,0);assert.equal(t.injecoes()-antes,0,'redirecionamento não injeta coletor');assert.equal(t.store.massa.estado,'concluido');
console.log('PASS leitura de todos: sitemap só com fichas e sem duplicados, redirecionamentos e falhas listados e excluídos, referência repetida bloqueada, lotes CLARA7 completos, modo teste e retoma só do que falta.');
// Leitura parcial (sem dados da API) nunca entra nos lotes: é repetida e, se persistir, listada como não lida.
{const base2='https://www.janela-imobiliaria.com/casasvenda/';const t2=criar();const ex=t2.ctx.chrome.scripting.executeScript;t2.ctx.chrome.scripting.executeScript=async o=>{const r=await ex(o);if(!o.files&&r[0]?.result?.ok&&/100001$/.test(r[0].result.d.url))r[0].result.d.parcial=true;return r;};t2.ctx.massaPorLote(25);await t2.ctx.executarMassa(false,2);const m2=t2.store.massa;assert.equal(m2.lidos,1,'parcial excluída');assert.ok(m2.falhas.some(f=>/parcial/.test(f.erro)),'parcial listada');console.log('PASS leitura parcial excluída dos lotes e listada.');}
// Texto único com todas as fichas lidas.
{const t3=criar();t3.ctx.massaPorLote(2);await t3.ctx.executarMassa(false,0);const todos=JSON.parse(t3.store.todos.slice(7));assert.equal(todos.modo,'todos');assert.equal(todos.fichas.length,t3.store.massa.lidos);assert.equal(new Set(todos.fichas.map(f=>f.ref)).size,todos.fichas.length);console.log('PASS texto único com todas as fichas lidas, sem repetidas.');}
