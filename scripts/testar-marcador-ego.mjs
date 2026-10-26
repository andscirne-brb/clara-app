import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const source=fs.readFileSync(new URL('../apps-script/clara/marcador.js',import.meta.url),'utf8');
const block=source.slice(source.indexOf('  /* Nomes do bloco'),source.indexOf('  const alternativos'));
const photo=(id,alt)=>({getAttribute:k=>k==='data-url'?`https://example.invalid/Tphoto/ID${id}.jpg`:k==='data-description'?'Legenda':'',querySelector:()=>({getAttribute:()=>alt})});
function read(total,photos,videoUrls=[]){
 const gallery={querySelector:s=>s==='.totalImgCounter'?{textContent:String(total)}:photos[0],querySelectorAll:()=>photos};
 const document={documentElement:{lang:'pt'},querySelector:s=>s==='#videoContent'?{querySelectorAll:()=>videoUrls.map(u=>({getAttribute:()=>u}))}:null,querySelectorAll:()=>[gallery]};
 const c={document,out:{parcial:true,videos:null}};vm.createContext(c);vm.runInContext(block,c);return c.out;
}
let r=read(2,[photo('aaaa','Sala'),photo('bbbb','')],['https://example.invalid/a.mp4','https://example.invalid/a.mp4']);
assert.equal(r.fotos,2);assert.equal(r.fotosComAlt,1);assert.equal(r.fotosComAltCompletos,true);assert.equal(r.videos,1);
r=read(3,[photo('aaaa','Sala'),photo('bbbb','Quarto')]);assert.equal(r.fotosComAltCompletos,undefined);assert.equal(r.videos,null);
r=read(2,[photo('aaaa','Sala'),photo('aaaa','Sala')]);assert.equal(r.fotosComAltCompletos,undefined);
console.log('PASS marcador eGO: galeria completa, alt vazio, duplicados, galeria incompleta e vídeo desconhecido.');
