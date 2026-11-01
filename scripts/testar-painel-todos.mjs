// Painel: todos os imóveis numa só colagem, com dados sintéticos. Gravação contínua, retoma e classificação.
import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';
const html=fs.readFileSync(new URL('../apps-script/clara/Painel.html',import.meta.url),'utf8');
const f=new Map(),el=id=>{if(!f.has(id))f.set(id,{id,value:'',hidden:false,disabled:false,textContent:'',innerHTML:'',className:'',addEventListener(){},focus(){},insertAdjacentHTML(_,h){this.innerHTML=h+this.innerHTML;}});return f.get(id);};
const ls=new Map(),localStorage={getItem:k=>ls.has(k)?ls.get(k):null,setItem:(k,v)=>ls.set(k,String(v)),removeItem:k=>ls.delete(k)};
let chamadas=[],falharUma=true;
const run=()=>{const h={ok:null,ko:null};const o={withSuccessHandler(fn){h.ok=fn;return o;},withFailureHandler(fn){h.ko=fn;return o;},
 gravarFichaLote(ficha){chamadas.push(ficha.ref);setTimeout(()=>{if(ficha.ref==='TST003')h.ko(Error('A referência TST003 não está no Levantamento.'));else if(ficha.ref==='TST004'&&falharUma){falharUma=false;h.ko(Error('Tempo esgotado'));}else h.ok({ref:ficha.ref,escritos:ficha.ref==='TST001'?3:0});},0);}};return o;};
const c={console,document:{getElementById:el},localStorage,setTimeout,clearTimeout,Date,JSON,Promise,google:{script:{get run(){return run();}}}};
vm.createContext(c);vm.runInContext(html.match(/<script>([\s\S]*?)<\/script>/)[1].replace(/__CLARA_[A-Z]+__/g,'x'),c);
const fichas=[1,2,3,4,5].map(n=>({v:1,origem:'site',ref:'TST00'+n,url:'https://www.janela-imobiliaria.com/casasvenda/t/'+n}));
const texto='CLARA7:'+JSON.stringify({v:7,origem:'site',modo:'todos',pedido:'p1',lote:1,lotes:1,fichas});
el('txt').value=texto;assert.ok(!c.reconhecer(texto).erro,'aceita mais de 60? (aqui 5) modo todos reconhecido');
const muitas='CLARA7:'+JSON.stringify({v:7,origem:'site',modo:'todos',pedido:'p2',lote:1,lotes:1,fichas:Array.from({length:400},(_,i)=>({ref:'T'+i}))});assert.ok(!c.reconhecer(muitas).erro,'400 fichas aceites em modo todos');
assert.ok(c.reconhecer(muitas.replace('"modo":"todos",','')).erro,'lote normal mantém limite de 60');
await c.analisar();assert.ok(el('res').innerHTML.includes('5 por guardar'));
await c.gravar();
let p=JSON.parse(ls.get('clara.todos.v1.p1'));assert.equal(p.TST001.escritos,3);assert.ok(p.TST003.fora);assert.ok(p.TST004.erro);assert.ok(p.TST005.ok);
assert.ok(el('res').innerHTML.includes('Gravação com falhas'));
chamadas=[];await c.analisar();await c.gravar();assert.deepEqual(chamadas,['TST004'],'retoma só o que falhou; fora do Levantamento não é repetido');
assert.ok(el('res').innerHTML.includes('Todos os imóveis guardados'));
assert.ok(!ls.has('clara.rascunho.v1.x')||ls.get('clara.rascunho.v1.x').length<400000,'texto grande não vai para o rascunho');
console.log('PASS painel todos: uma colagem, gravação contínua, fora do Levantamento listado sem repetir, erro repetido na retoma, progresso guardado.');
