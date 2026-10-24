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
 constructor(name,width=20){this.name=name;this.width=width;this.cells=new Map();this.forms=new Map();this.formats=new Map();}
 getName(){return this.name} getMaxRows(){return this.maxRows??2000} insertRowsAfter(after,n){assert.equal(after,this.getMaxRows());if(this.failGrowth)throw Error("Limite de células");this.maxRows=after+n;return this;} getLastColumn(){return this.width}
 getLastRow(){return Math.max(1,...[...this.cells.keys(),...this.forms.keys()].map(k=>+k.split(',')[0]))}
 getRange(r,c,n=1,m=1){return new Range(this,r,c,n,m)}
 seed(r,vs){vs.forEach((v,j)=>this.cells.set(`${r},${j+1}`,v));return this}
}
class Range {
 constructor(sh,r,c,n,m){Object.assign(this,{sh,r,c,n,m})}
 copyFormatToRange(sh,start,end,first,last){for(let r=first;r<=last;r++)for(let c=start;c<=end;c++)sh.formats.set(`${r},${c}`,this.sh.formats.get(`${this.r},${this.c+c-start}`)??'0.###############');return this;}
 getValue(){return this.sh.cells.get(`${this.r},${this.c}`)??''}
 getFormula(){return this.sh.forms.get(`${this.r},${this.c}`)??''}
 getA1Notation(){return `${this.r}:${this.c}`}
 getSheet(){return this.sh}
 getNumberFormat(){return this.sh.formats.get(`${this.r},${this.c}`)??'0.###############'}
 setNumberFormat(v){this.sh.formats.set(`${this.r},${this.c}`,v);return this}
 getNumberFormats(){return Array.from({length:this.n},(_,i)=>Array.from({length:this.m},(_,j)=>this.sh.formats.get(`${this.r+i},${this.c+j}`)??'0.###############'))}
 setValues(vs){vs.forEach((row,i)=>row.forEach((v,j)=>new Range(this.sh,this.r+i,this.c+j,1,1).setValue(v)));return this}
 getValues(){return Array.from({length:this.n},(_,i)=>Array.from({length:this.m},(_,j)=>this.sh.cells.get(`${this.r+i},${this.c+j}`)??''))}
 getDisplayValues(){return this.getValues().map(r=>r.map(v=>v instanceof Date?'22/10/2026':String(v)))}
 getFormulas(){return Array.from({length:this.n},(_,i)=>Array.from({length:this.m},(_,j)=>this.sh.forms.get(`${this.r+i},${this.c+j}`)??''))}
 setValue(v){const literal=typeof v==='string'&&v.startsWith("'");if(literal)v=v.slice(1);if(!literal&&typeof v==='string'&&v.startsWith('='))throw Error('Unsafe formula');if(!literal&&typeof v==='string'&&/^\d+$/.test(v))v=Number(v);if(typeof v==='string')v=v.replace(/\r\n?/g,'\n');this.sh.cells.set(`${this.r},${this.c}`,v);return this}
 setRichTextValue(v){this.sh.cells.set(`${this.r},${this.c}`,this.getNumberFormat()!=='@'&&/^\d+$/.test(v.text)?Number(v.text):v.text.replace(/\r\n?/g,'\n'));return this}
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
 const context=vm.createContext({Date,console:{log(t){if(!String(t).startsWith('Clara desempenho '))console.log(t);}},SpreadsheetApp:{getActive:()=>ss,flush(){if(fail){fail=false;throw Error('Synthetic flush failure')}},newRichTextValue:()=>({setText(text){return {build:()=>({text})}}})},LockService:{getDocumentLock:()=>({tryLock:()=>acquired,releaseLock(){releases++}})},Utilities:{getUuid:()=> 'SYNTHETIC-ID',formatDate:(_,__,fmt)=>fmt==='yyyy-MM-dd'?'2026-10-22':'22/10/2026',parseDate:()=>new Date('2026-10-22T00:00:00Z')}});
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

f=fixture();d=payload();d.textos.PT.titulo='00123';d.textos.PT.descricao='Linha 1\r\nLinha 2';save(f,d);
assert.equal(get(f.tx,6,3),'00123');assert.equal(get(f.tx,6,4),'Linha 1\nLinha 2');
assert.equal(f.context.mesmoValor_(22,'22'),false,'não desliga a conferência de tipos');
assert.equal(f.context.mesmoValor_('Texto A','Texto B'),false);
assert.equal(f.context.mesmoValor_('A\r\nB','A\nB'),true);
assert([...f.hist.cells.values()].some(v=>v==='00123'),'histórico conserva números como texto literal');
console.log('PASS gravação: texto numérico e zeros iniciais preservados, CRLF normalizado, tipos e conteúdo divergentes continuam rejeitados.');

assert.equal(get(f.tx,6,3),'00123');assert.equal(f.tx.getRange(6,3).getNumberFormat(),'0.###############');console.log('PASS texto literal: apóstrofo nativo preserva zeros iniciais e não muda formatos.');

const repairContext=vm.createContext({});vm.runInContext(fs.readFileSync(new URL('./corrigir-formulas-dashboard.gs',import.meta.url),'utf8'),repairContext);
assert.equal(repairContext.separadoresPtClara_('=IF(A1="a,b",1,0)'),'=IF(A1="a,b";1;0)');
assert.equal(repairContext.separadoresPtClara_('=IF(A1="a""b,c",1,0)'),'=IF(A1="a""b,c";1;0)');
console.log('PASS fórmulas PT: separadores corrigidos sem alterar texto entre aspas.');

f=fixture();d=payload();d.textos.PT.titulo='00123';d.textos.PT.descricao="'Texto com apóstrofo inicial";
const originalFormatSetter=Range.prototype.setNumberFormat;Range.prototype.setNumberFormat=function(){throw Error('Não pode definir o formato de número de células numa coluna escrita.');};
try{save(f,d);assert.equal(get(f.tx,6,3),'00123');assert.equal(get(f.tx,6,4),"'Texto com apóstrofo inicial");f=fixture();f.fail();assert.throws(()=>save(f,payload()),/células foram repostas/);}finally{Range.prototype.setNumberFormat=originalFormatSetter;}
console.log('PASS colunas tipadas: gravação e rollback sem chamadas de formatação, apóstrofo inicial preservado.');

// Partial resolution narrows evidence without replacing ownership or manual state.
f=fixture();d=payload();
f.pend.seed(6,['P0001','TESTE-001','Documentos','Documentos obrigatórios sem ficheiro no eGO','Faltam quatro documentos','Ação antiga','Equipa teste','Alta','Em curso','2026-10-01','2026-10-01','','','eGO','Por verificar']);
const pendingDocs={...docs,licenca:'nao'};
assert.equal(analyse(f,d,pendingDocs).pendencias.find(p=>p.jaExiste==='P0001').atualizar,true);
save(f,d,pendingDocs);
assert.match(get(f.pend,6,5),/Licença/);assert.doesNotMatch(get(f.pend,6,5),/Caderneta|Certificado|Contrato/);
assert.equal(get(f.pend,6,7),'Equipa teste');assert.equal(get(f.pend,6,8),'Alta');assert.equal(get(f.pend,6,9),'Em curso');assert.equal(get(f.pend,6,10),'2026-10-01');
assert([...f.hist.cells.values()].includes('Faltam quatro documentos'));
const stable=snapshot(f);save(f,d,pendingDocs);assert.equal(snapshot(f),stable);
f=fixture();f.pend.seed(6,['P0001','TESTE-001','Documentos','Documentos obrigatórios sem ficheiro no eGO','Faltam quatro documentos','Ação antiga','Equipa teste','Alta','Em curso']);
save(f,d,{...pendingDocs,contrato:''});assert.equal(get(f.pend,6,5),'Faltam quatro documentos');
console.log('PASS pendências: resolução parcial atualiza evidência, preserva gestão e histórico, não repete, leitura documental incompleta não reduz faltas.');

f=fixture();let batchWrites=0,singleWrites=0;const originalBatch=Range.prototype.setValues,originalSingle=Range.prototype.setValue;
Range.prototype.setValues=function(vs){batchWrites++;return originalBatch.call(this,vs)};
Range.prototype.setValue=function(v){singleWrites++;return originalSingle.call(this,v)};
try{save(f,payload());assert(batchWrites<singleWrites/3,'muito menos escritas remotas por intervalo');}finally{Range.prototype.setValues=originalBatch;Range.prototype.setValue=originalSingle;}
// A gap with a formula must not enter a write batch.
f=fixture();f.lev.forms.set('10,3','=FORMULA_SEGURA()');
const ps=[2,4].map(col=>({sh:f.lev,linha:10,col,cel:f.lev.getRange(10,col),antes:'',depois:'Novo',antesFormato:'0.###############'}));
assert.equal(f.context.lotesGravacaoClara_(ps).length,2);
console.log('PASS lotes: menos chamadas de escrita; lacunas e fórmulas não incluídas.');

f=fixture();d=payload();const absent={...docs,licenca:'sem_dossier',certificado:'nao'};
a=analyse(f,d,absent);let dp=a.pendencias.find(p=>p.tema==='Documentos');assert.equal(dp.sara,true);assert.match(dp.acao,/Sara: Licença/);assert.match(dp.acao,/dossier.*Certificado/);save(f,d,absent);assert.equal(get(f.pend,6,7),'Sara');assert.equal(get(f.pend,6,17),'Sara');assert.equal(get(f.pend,6,9),'A aguardar esclarecimento');
f=fixture();f.pend.seed(6,['P0001','TESTE-001','Documentos','Documentos obrigatórios sem ficheiro no eGO','Falta licença','Verificar dossier','Andreia','Alta','Por tratar']);save(f,d,{...docs,licenca:'sem_dossier'});assert.equal(get(f.pend,6,17),'Sara');assert.equal(get(f.pend,6,7),'Sara');assert.equal(get(f.pend,6,8),'Alta');assert.equal(get(f.pend,6,9),'A aguardar esclarecimento');
console.log('PASS documentos: ausência no dossier delega análise à Sara em pendência nova ou existente; distingue documentos por procurar no dossier.');

f=fixture();f.pend.seed(6,['P0001','TESTE-001','Documentos','Documentos obrigatórios sem ficheiro no eGO','Outras faltas já conferidas','Verificar dossier','Andreia','Alta','Por tratar']);save(f,d,{licenca:'sem_dossier'});assert.equal(get(f.pend,6,17),'Sara');assert.match(get(f.pend,6,5),/Outras faltas já conferidas/);let once=snapshot(f);save(f,d,{licenca:'sem_dossier'});assert.equal(snapshot(f),once);console.log('PASS delegação parcial: preserva faltas anteriores e não duplica notas.');

f=fixture();d=payload();d.parcial=true;delete d.textos.FR;
['Alt-text','Características','Descrição FR','Certificado Energético (anexo)'].forEach(h=>f.lev.cells.set('10,'+(headers.indexOf(h)+1),'Preenchido'));
f.pend.seed(6,['P0001','TESTE-001','Imagens','Fotografias sem texto alternativo','','','Andreia','Normal','Por tratar']);
a=analyse(f,d,{});['Alt-text','Características','Descrição FR','Certificado Energético (anexo)'].forEach(h=>assert.equal(a.campos.find(x=>x.coluna===h).novo,'Preenchido'));assert.equal(a.resolvidas.length,0);assert(a.naoVerificados.some(x=>x.coluna==='Descrição FR'&&x.preservado));save(f,d,{});assert.equal(get(f.pend,6,9),'Por tratar');console.log('PASS leitura parcial: preserva estados conhecidos e não conclui pendências de blocos não lidos.');

f=fixture();d=payload();d.fotos=14;d.fotosComAlt=11;f.pend.seed(6,['P0001','TESTE-001','Imagens','Fotografias sem texto alternativo','14 fotografias sem texto alternativo','Ação antiga','Andreia','Alta','Em curso']);save(f,d);assert.match(get(f.pend,6,5),/3 de 14/);assert.equal(get(f.pend,6,9),'Em curso');console.log('PASS pendências de imagens: resolução parcial reduz faltas sem duplicar ou alterar gestão.');

f=fixture();d=payload();d.caracteristicas=1;d.nomesCaracteristicas=['Elevador'];d.textos.PT.descricao='Apartamento com piscina e garagem. Elevador no prédio. Sem lareira. Possibilidade de jardim.';
let cross=f.context.cruzarCaracteristicasClara_(d);assert.deepEqual(Array.from(cross.sugestoes,x=>x.nome),['Piscina','Garagem']);assert.equal(cross.assinaladasSemTexto.length,0);d.parcial=true;assert.equal(f.context.cruzarCaracteristicasClara_(d).avaliadas,0);delete d.parcial;d.nomesCaracteristicas=[''];assert.equal(f.context.cruzarCaracteristicasClara_(d).avaliadas,0);console.log('PASS características: evidência textual, negação e hipótese excluídas, nomes ausentes e leitura parcial não produzem conclusão.');

f=fixture();d=payload();const report=save(f,d);assert(report.desempenho.intervalos<report.desempenho.celulas/5);assert(Object.hasOwn(report.desempenho.fases,'preparacao'));
const plan=[20,21,23].flatMap(linha=>[1,2].map(col=>({sh:f.hist,linha,col,cel:f.hist.getRange(linha,col),antes:'',depois:'X',antesFormato:'0.###############'})));
let groups=f.context.lotesGravacaoClara_(plan);assert.equal(groups.length,2);assert.equal(groups[0].linhas.length,2);assert.equal(groups[1].linha,23);console.log('PASS blocos: histórico retangular, linha intermédia não incluída, métricas por fase.');

f=fixture();const snapshotMeaningful=x=>JSON.stringify([...x.sheets].map(([n,s])=>[n,[...s.cells].filter(([,v])=>v!==''),[...s.forms]]));const baseFailure=snapshotMeaningful(f);let injected=false;
Range.prototype.setValues=function(vs){if(!injected&&this.n>1){injected=true;new Range(this.sh,this.r,this.c,1,1).setValue(vs[0][0]);throw Error('Falha a meio do bloco');}return originalBatch.call(this,vs);};
try{assert.throws(()=>save(f,payload()),/células foram repostas/);assert(injected);assert.equal(snapshotMeaningful(f),baseFailure);}finally{Range.prototype.setValues=originalBatch;}
console.log('PASS recuperação: bloco parcialmente escrito é integralmente reposto.');

f=fixture();headers.push('Observações / justificação N/A');f=fixture();f.lev.seed(10,['TESTE-001']);f.lev.cells.set('10,'+headers.length,'Nota manual preservada.');
a=analyse(f,payload(),{...docs,caderneta:'nao',licenca:'sem_dossier'});const note=a.campos.find(x=>x.coluna==='Observações / justificação N/A').novo;assert.match(note,/Caderneta Predial: em falta no eGO; dossier por verificar/);assert.match(note,/Licença de Habitação: em falta no eGO e no dossier; aguarda análise da Sara/);assert.match(note,/Nota manual preservada/);assert.equal(a.campos.find(x=>x.coluna==='Licença Habitação (anexo)').novo,'Em falta');save(f,payload(),{...docs,caderneta:'nao',licenca:'sem_dossier'});let stableDoc=snapshot(f);save(f,payload(),{...docs,caderneta:'nao',licenca:'sem_dossier'});assert.equal(snapshot(f),stableDoc);save(f,payload(),{...docs,caderneta:'',licenca:'sim'});assert.match(get(f.lev,10,headers.length),/Caderneta/);assert.doesNotMatch(get(f.lev,10,headers.length),/Licença/);console.log('PASS diferenciação: observações por documento, notas manuais preservadas, contagens compatíveis, repetição e resolução.');

// Reproduz a perda de Date em coluna com validação de data, mantendo conferência estrita.
const setOriginal=Range.prototype.setValue;
Range.prototype.setValue=function(v){if(/[dy]/i.test(this.getNumberFormat())){if(v instanceof Date)v='';else if(typeof v==='number')v=new Date(Math.round((v-25569)*86400000));}return setOriginal.call(this,v);};
try{
 f=fixture();f.context.SpreadsheetApp.getActive().getSpreadsheetTimeZone=()=> 'UTC';
 f.context.Utilities.formatDate=(d,tz,fmt)=>fmt==="yyyy-MM-dd'T'HH:mm:ss.SSS"?d.toISOString().slice(0,-1):fmt==='yyyy-MM-dd'?d.toISOString().slice(0,10):'22/10/2026';
 for(let row=6;row<100;row++){
  [10,11,13].forEach(col=>f.pend.formats.set(`${row},${col}`,'yyyy-mm-dd'));
  f.tx.formats.set(`${row},6`,'yyyy-mm-dd');f.hist.formats.set(`${row},1`,'yyyy-mm-dd');
 }
 f.lev.formats.set('10,'+(headers.indexOf('Data da verificação')+1),'yyyy-mm-dd');
 d=payload();d.plantas=['pdf'];save(f,d);assert.equal(get(f.pend,6,10).toISOString(),'2026-10-22T00:00:00.000Z');assert.equal(f.pend.getRange(6,10).getNumberFormat(),'yyyy-mm-dd');
 const stable=snapshot(f);save(f,d);assert.equal(snapshot(f),stable);
 const dadosAtuais=()=>JSON.stringify([...f.sheets].map(([n,s])=>[n,[...s.cells].filter(([k,v])=>v!=='').sort((a,b)=>a[0].localeCompare(b[0])),[...s.forms],[...s.formats]]));
 d.textos.PT.descricao='Mudança de teste';const pre=dadosAtuais();f.fail();assert.throws(()=>save(f,d),/repostas/);assert.equal(dadosAtuais(),pre);
 assert.equal(f.context.mesmoValor_(new Date('2026-10-22'),'2026-10-22'),false);
 console.log('PASS datas nativas: Date perdido reproduzido, série numérica preserva valor e formato, repetição e rollback verificados sem relaxar comparação.');
}finally{Range.prototype.setValue=setOriginal;}

f=fixture();const rss=f.context.SpreadsheetApp.getActive();rss.getUrl=()=> 'https://example.invalid/sheet/edit';f.sheets.set('Dashboard',{getSheetId:()=>101});f.pend.getSheetId=()=>202;
f.context.PropertiesService={getScriptProperties:()=>({getProperty:()=> '303'})};
let weeklyReport=f.context.previewResumo(7,'Rever anúncios prioritários\nConfirmar <documentos>');
assert.equal(weeklyReport.proximosPassos.length,2);assert.match(weeklyReport.html,/href="https:\/\/example.invalid\/sheet\/edit#gid=101"/);assert.match(weeklyReport.html,/#gid=202&amp;fvid=303/);assert.match(weeklyReport.html,/Confirmar &lt;documentos>/);assert.match(weeklyReport.html,/<table/);assert.match(weeklyReport.html,/Seguimento previsto para a próxima semana/);
weeklyReport=f.context.previewResumo(7,'');assert.match(weeklyReport.html,/Planeamento por preencher/);assert.equal(weeklyReport.proximosPassos.length,0);
f.context.PropertiesService={getScriptProperties:()=>({getProperty:()=> 'invalido'})};assert.equal(f.context.previewResumo(7,'Plano').links.filtrada,false);
console.log('PASS resumo: links do documento ativo e vista filtrada privada, plano explícito escapado e ausência de compromissos inventados.');

f=fixture();f.hist.seed(6,['2026-10-22','TESTE-001','','Andreia','Levantamento','Textos por idioma · PT · Descrição original','','Descrição completa privada']);f.hist.seed(7,['2026-10-22','TESTE-001','','Andreia','Levantamento','Textos por idioma · PT · Título original','','Título privado']);
const compact=f.context.resumoSemanal(7);const work=compact.linhas.find(x=>x.ref==='TESTE-001').trabalho.join(' ');assert.match(work,/Registados textos por idioma: PT/);assert(!work.includes('Descrição completa privada'));assert.equal((work.match(/Registados textos por idioma/g)||[]).length,1);console.log('PASS tabela semanal: alterações por idioma agrupadas sem expor textos completos.');

f=fixture();f.hist.maxRows=7;f.hist.seed(6,['2026-10-20','ANCIEN-1']).seed(7,['2026-10-21','ANCIEN-2']);f.hist.formats.set('7,1','0.###############');
const oldHistory=[...f.hist.cells].filter(([k])=>+k.split(',')[0]<=7);save(f,payload());assert(f.hist.getMaxRows()>=207);oldHistory.forEach(([k,v])=>assert.equal(f.hist.cells.get(k),v));assert.equal(f.hist.getRange(8,1).getNumberFormat(),'0.###############');assert.equal(get(f.hist,8,2),'TESTE-001');const grown=f.hist.getMaxRows();save(f,payload());assert.equal(f.hist.getMaxRows(),grown);
f=fixture();f.hist.maxRows=6;f.hist.seed(6,['2026-10-20','ANCIEN']);f.hist.failGrowth=true;const unchanged=snapshot(f);assert.throws(()=>save(f,payload()),/Não foi possível ampliar/);assert.equal(snapshot(f),unchanged);
console.log('PASS capacidade do histórico: amplia automaticamente, preserva registos e formatos, não amplia em repetição e aborta sem escrita se atingir limite.');
