import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const maintenance=fs.readFileSync(new URL('./organizar-perfis.gs',import.meta.url),'utf8');
const mc={}; vm.createContext(mc); vm.runInContext(maintenance,mc);
const portalPlan=mc.planoPerfis_([
 ['portal-teste','Nome e dados da empresa','Confirmar nome.','Ajustar','Andreia','2026-10-20','https://example.invalid'],
 ['portal-teste','Logótipo e imagens','Confirmar imagem.','Pendente','Sara','2026-10-20','https://example.invalid'],
 ['portal-teste','Origem da consulta','Fonte','Fonte'],
 ['portal-teste','Texto do perfil','Texto preservado.','Concluído'],
 ['portal-teste','Próxima ação','Rever nome e imagem.','Em curso']
]);
assert.equal(portalPlan.length,1); assert.equal(portalPlan[0].sara,true); assert.equal(portalPlan[0].notas.length,2);
const source=fs.readFileSync(new URL('../apps-script/clara/Codigo.gs',import.meta.url),'utf8');
const headers=['Referência EGO','Imagens','Alt-text','Descrição PT','Descrição EN','Descrição FR','Descrição DE','Descrição ES','Características','Vídeo','Planta','Folheto','Caderneta Predial (anexo)','Certificado Energético (anexo)','Contrato Mediação (anexo)','Licença Habitação (anexo)','Página pública','Data da verificação','Estado da verificação'];
const txh=['Referência EGO','Idioma','Título original','Descrição original','Origem / evidência','Data de recolha','Estado da recolha'];
const hish=['Data da alteração','Referência EGO','ID da pendência','Autor','Onde foi alterado','Campo / assunto','Antes','Depois / alteração realizada','Motivo / fonte','Resultado da verificação','Data da verificação','Verificado por'];
class Sheet {
 constructor(name,width=20){this.name=name;this.width=width;this.cells=new Map();this.forms=new Map();}
 getName(){return this.name} getMaxRows(){return 2000} getLastColumn(){return this.width}
 getLastRow(){return Math.max(1,...[...this.cells.keys(),...this.forms.keys()].map(k=>+k.split(',')[0]))}
 getRange(r,c,n=1,m=1){return new Range(this,r,c,n,m)}
 seed(r,vs){vs.forEach((v,j)=>this.cells.set(`${r},${j+1}`,v));return this}
}
class Range {
 constructor(sh,r,c,n,m){Object.assign(this,{sh,r,c,n,m})}
 getValue(){return this.sh.cells.get(`${this.r},${this.c}`)??''}
 getFormula(){return this.sh.forms.get(`${this.r},${this.c}`)??''}
 getA1Notation(){return `${this.r}:${this.c}`}
 getValues(){return Array.from({length:this.n},(_,i)=>Array.from({length:this.m},(_,j)=>this.sh.cells.get(`${this.r+i},${this.c+j}`)??''))}
 getDisplayValues(){return this.getValues().map(r=>r.map(v=>v instanceof Date?'22/10/2026':String(v)))}
 getFormulas(){return Array.from({length:this.n},(_,i)=>Array.from({length:this.m},(_,j)=>this.sh.forms.get(`${this.r+i},${this.c+j}`)??''))}
 setValue(v){if(typeof v==='string'&&v.startsWith('='))throw Error('Unsafe formula');this.sh.cells.set(`${this.r},${this.c}`,v);return this}
 setRichTextValue(v){this.sh.cells.set(`${this.r},${this.c}`,v.text);return this}
}
const docs={caderneta:'sim',certificado:'sim',contrato:'sim',licenca:'sim'};
function payload(){return {ref:'TESTE-001',url:'https://example.invalid/imovel',fotos:3,fotosComAlt:3,fotosComLegenda:3,caracteristicas:2,videos:1,plantas:['jpg'],folhetos:1,textos:Object.fromEntries(['PT','EN','FR','DE','ES'].map(k=>[k,{titulo:`Título ${k}`,descricao:`Descrição ${k}`}]))}}
function fixture(){
 const lev=new Sheet('Levantamento',headers.length).seed(9,headers).seed(10,['TESTE-001']);
 const tx=new Sheet('Textos por idioma',7).seed(5,txh);
 ['PT','EN','FR','DE','ES'].forEach((k,i)=>tx.seed(6+i,['TESTE-001',k,`Antigo ${k}`,`Texto antigo ${k}`,'',new Date('2026-10-21T00:00:00Z'),'Revisto']));
 const hist=new Sheet('Registo de alterações',12).seed(5,hish);
 const pend=new Sheet('Pendências da equipa',17).seed(5,['ID','Referência EGO','Tema','Assunto']);
 const sheets=new Map([lev,tx,hist,pend].map(s=>[s.name,s]));
 let fail=false, releases=0, acquired=true;
 const ss={getSheetByName:n=>sheets.get(n),getSpreadsheetTimeZone:()=> 'Europe/Lisbon'};
 const context=vm.createContext({Date,console,SpreadsheetApp:{getActive:()=>ss,flush(){if(fail){fail=false;throw Error('Synthetic flush failure')}},newRichTextValue:()=>({setText(text){return {build:()=>({text})}}})},LockService:{getDocumentLock:()=>({tryLock:()=>acquired,releaseLock(){releases++}})},Utilities:{getUuid:()=> 'SYNTHETIC-ID',formatDate:(_,__,fmt)=>fmt==='yyyy-MM-dd'?'2026-10-22':'22/10/2026',parseDate:()=>new Date('2026-10-22T00:00:00Z')}});
 vm.runInContext(source,context);
 return {context,lev,tx,hist,pend,sheets,fail(){fail=true},busy(){acquired=false},releases:()=>releases};
}
const analyse=(f,d,documents=docs)=>f.context.analisar('CLARA1:'+JSON.stringify(d),documents);
const save=(f,d,documents=docs)=>f.context.gravar('CLARA1:'+JSON.stringify(d),documents);
const get=(s,r,c)=>s.getRange(r,c).getValue();
const snapshot=f=>JSON.stringify([...f.sheets].map(([n,s])=>[n,[...s.cells], [...s.forms]]));
let f=fixture(),d=payload();
assert.equal(analyse(f,d).completa,true);
d.parcial=true;assert.equal(analyse(f,d).campos.find(p=>p.coluna==='Estado da verificação').novo,'Em curso');
delete d.parcial;delete d.textos.FR;assert.equal(analyse(f,d).campos.find(p=>p.coluna==='Descrição FR').novo,'Por verificar');assert.equal(analyse(f,d).completa,false);
assert.equal(analyse(f,payload(),{...docs,licenca:''}).completa,false);
f=fixture();d=payload();d.textos.FR.descricao=d.textos.EN.descricao;
f.pend.seed(6,['P0001','TESTE-001','Textos','Descrição em francês em falta','','','Andreia','Alta','Concluído','21/10/2026','21/10/2026','Resolvida','21/10/2026','','Confirmado']);
f.pend.seed(8,['P0008','OUTRO-TESTE','Documentos','Não alterar esta linha']);
d.fotosComAlt=0;d.plantas=['pdf'];
let a=analyse(f,d);assert.equal(a.pendencias.find(p=>p.jaExiste==='P0001').reabrir,true);
let r=save(f,d);assert.equal(r.reabertas.length,1);assert.equal(r.criadas.length,2);assert.equal(get(f.pend,6,9),'Por tratar');assert.equal(get(f.pend,6,13),'');assert.equal(get(f.pend,6,7),'Andreia');assert.equal(get(f.pend,6,8),'Alta');assert.equal(get(f.pend,8,2),'OUTRO-TESTE');assert.equal(get(f.pend,7,1),'P0009');assert.equal(get(f.pend,9,1),'P0010');
assert.equal(get(f.tx,8,4),d.textos.FR.descricao);assert(r.historico>10);assert([...f.hist.cells.values()].includes('Texto antigo FR'));assert([...f.hist.cells.values()].includes('Resolvida'));
const h=snapshot(f);r=save(f,d);assert.equal(r.historico,0);assert.equal(r.criadas.length,0);assert.equal(r.reabertas.length,0);assert.equal(snapshot(f),h);
f=fixture();d=payload();delete d.textos.FR;save(f,d);assert.equal(get(f.tx,8,4),'Texto antigo FR');assert.equal(get(f.lev,10,headers.indexOf('Estado da verificação')+1),'Em curso');
f=fixture();d=payload();d.textos.PT.descricao='=1+1';save(f,d);assert.equal(get(f.tx,6,4),'=1+1');
f=fixture();const before=snapshot(f);f.fail();assert.throws(()=>save(f,payload()),/repostas/);for(const s of f.sheets.values())for(const[k,v]of s.cells)if(v==='')s.cells.delete(k);
// Blank writes may leave empty cells; compare meaningful content rather than map storage.
const clean=s=>[...s.cells].filter(([,v])=>v!=='');const baseline=fixture();assert.deepEqual([...f.sheets].map(([n,s])=>[n,clean(s)]),[...baseline.sheets].map(([n,s])=>[n,clean(s)]));assert.equal(f.releases(),1);
f=fixture();f.busy();assert.throws(()=>save(f,payload()),/outra gravação/);assert.equal(f.releases(),0);
f=fixture();d=payload();d.parcial=true;const statusCol=headers.indexOf('Estado da verificação')+1;f.lev.forms.set('10,'+statusCol,'=FORMULA_EXISTENTE()');save(f,d);assert.equal(f.lev.forms.get('10,'+statusCol),'=FORMULA_EXISTENTE()');assert.equal(get(f.lev,10,headers.indexOf('Alt-text')+1),'Por verificar');assert.equal(get(f.lev,10,headers.indexOf('Características')+1),'Por verificar');
f=fixture();f.lev.forms.set('10,2','=1');assert.throws(()=>save(f,payload()),/fórmula/);assert.equal(get(f.tx,6,4),'Texto antigo PT');
new vm.Script(fs.readFileSync(new URL('../apps-script/clara/Painel.html',import.meta.url),'utf8').match(/<script>([\s\S]*)<\/script>/)[1]);
console.log('PASS: leitura parcial, idioma inacessível, documentos incompletos, reabertura, vagas intercaladas, cinco idiomas, histórico antes/depois, repetição, texto literal, rollback, bloqueio e fórmulas protegidas.');

{ const f=fixture(); assert.equal(f.context.dataDe_('2026-10-21').getDate(),21);assert.equal(f.context.dataDe_('21/10/2026').getDate(),21);assert.equal(f.context.dataDe_('2026-10-21 17:33:00').getMonth(),9);assert.equal(f.context.dataDe_('sem data'),null);console.log('PASS: resumo semanal aceita datas ISO e antigas, com ou sem horas.'); }
