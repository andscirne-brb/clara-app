import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';
const c={URL,AbortController,setTimeout,clearTimeout};vm.createContext(c);vm.runInContext(fs.readFileSync(new URL('../apps-script/clara/idealista-ativos.js',import.meta.url),'utf8'),c);
const one={total:2,registos:[{id:'101',ref:'TESTE-001'}]},two={total:2,registos:[{id:'102',ref:'TESTE-002'}]};
assert.equal(c.juntarPaginasAtivosIdealista([one,two],2).length,2);assert.throws(()=>c.juntarPaginasAtivosIdealista([one,one],2));assert.throws(()=>c.juntarPaginasAtivosIdealista([one],2));assert.equal(c.juntarPaginasAtivosIdealista([{total:0,registos:[]}],0).length,0);
const d={url:'https://www.idealista.pt/webtool/stats/loadImpactStats',lido:'2026-10-25T12:00:00Z',registos:[{metricas:{anunciosAtivosHoje:2}}]},source={querySelectorAll:()=>[{textContent:'2 anúncios ativos hoje',getAttribute:()=>'/tools/publicacion/idealista?ScopeId=1'}]};
c.recolherIdealista=()=>d;c.lerPaginaAtivosIdealista=x=>x;
let seen=[],repeat=false,changed=false;
c.DOMParser=class{parseFromString(s){return JSON.parse(s)}};
c.fetch=async url=>{const page=Number(new URL(url).searchParams.get('CurrentPage'));seen.push(page);return{ok:true,url,text:async()=>JSON.stringify(page===1?(changed&&seen.length>2?two:one):repeat?one:two)}};
let out=await c.recolherAtivosIdealista(source,d,{estado:()=>{}});assert.equal(out.total,2);assert.deepEqual(seen,[1,2,1]);assert.equal(out.paginas,2);
repeat=true;seen=[];await assert.rejects(()=>c.recolherAtivosIdealista(source,d,{estado:()=>{}}),/repetiu/);repeat=false;changed=true;seen=[];await assert.rejects(()=>c.recolherAtivosIdealista(source,d,{estado:()=>{}}),/mudaram/);
console.log('PASS recolha ativos: páginas completas, mesma origem, repetição rejeitada e primeira página reconferida.');

assert.equal((fs.readFileSync(new URL('../apps-script/clara/marcador.js',import.meta.url),'utf8').match(/await recolherExcelIdealista/g)||[]).length,1,'Uma única exportação Excel por clique');

{
 let removed=0,blocked=false;c.setTimeout=(fn,ms)=>ms===120?(queueMicrotask(fn),0):setTimeout(fn,ms);c.DOMParser=class{parseFromString(){return{bad:true}}};c.lerPaginaAtivosIdealista=x=>{if(!x||x.bad)throw Error('Página sem lista');return x;};
 const framed={...source,body:{appendChild(){}},createElement(){const f={style:{},setAttribute(){},remove(){removed++;}};Object.defineProperty(f,'contentWindow',{get:()=>({location:{href:f.src}})});Object.defineProperty(f,'contentDocument',{get:()=>blocked?null:Number(new URL(f.src).searchParams.get('CurrentPage'))===2?two:one});return f;}};
 changed=false;seen=[];out=await c.recolherAtivosIdealista(framed,d,{estado:()=>{}});assert.equal(out.total,2);assert.equal(removed,3);
 blocked=true;await assert.rejects(()=>c.recolherAtivosIdealista(framed,d,{estado:()=>{}}),/terminou de carregar/);assert.equal(removed,4);
 console.log('PASS página dinâmica: espera pela lista renderizada e remove a janela interna em sucesso e falha.');
}
