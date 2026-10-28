import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';
const c={console,Utilities:{formatDate:d=>d.toISOString().slice(0,10)}};vm.createContext(c);vm.runInContext(fs.readFileSync(new URL('../apps-script/clara/Rightmove.gs',import.meta.url),'utf8'),c);vm.runInContext((fs.readFileSync(new URL('../apps-script/clara/GreenAcres.gs',import.meta.url),'utf8')+'\n'+fs.readFileSync(new URL('../apps-script/clara/DashboardVisual.gs',import.meta.url),'utf8')),c);
const r=(id,a,b,val,k='contactos')=>['2026-10-23','geral',a,b,'["Venda e arrendamento"]','','',k,val,'',id];
assert.equal(c.periodo30Dashboard_([r('a','2026-07-25','2026-10-22',246),r('b','2026-09-22','2026-10-21',61)],'UTC').metricas.contactos,61);
assert.equal(c.periodo30Dashboard_([r('a','2026-09-22','2026-10-21',61),r('b','2026-09-22','2026-10-21',0)],'UTC').metricas.contactos,0);
assert.equal(c.periodo30Dashboard_([r('a','2026-07-25','2026-10-22',246)],'UTC'),null);
assert.equal(c.periodo30Dashboard_([r('a','2026-02-01','2026-03-02',1)],'UTC').metricas.contactos,1);
assert.equal(c.periodo30Dashboard_([r('a','2026-09-22','2026-10-21',1),r('b','2026-09-23','2026-10-22',2)],'UTC').metricas.contactos,2);
console.log('PASS dashboard visual: janela de 30 dias, data mais recente, repetição não somada, zero preservado, ausência distinta de zero e passagem de mês.');

vm.runInContext(fs.readFileSync(new URL('../apps-script/clara/ProgressoDashboard.gs',import.meta.url),'utf8'),c);
const er=(day,id,value,portal='eGO')=>[day,id,portal,'',value];
let e=c.serieCompletudeEGO_([er('2026-10-01','A',.8),er('2026-10-01','B',1),er('2026-10-02','A',1),er('2026-10-03','A','100%'),er('2026-10-03','B','90,0%'),er('2026-10-01','X',0)],['A','B'],'UTC');
assert.equal(e.length,2);assert.equal(e[0].media,.9);assert.equal(e[1].media,.95);assert.equal(e[1].data,'2026-10-03');
assert.equal(c.serieCompletudeEGO_([er('2026-10-01','A','150%')],['A'],'UTC').length,0);
assert.equal(c.serieCompletudeEGO_([er('2026-10-01','A','')],['A'],'UTC').length,0);
assert.equal(c.serieCompletudeEGO_([er('2026-10-01','A',0)],['A'],'UTC')[0].media,0);
const rr=(day,batch,id,value)=>[day,batch,id,value];
let rm=c.serieRightmove_([rr('2026-10-01','a','1',3),rr('2026-10-01','a','2',5),rr('2026-10-01','b','1',4),rr('2026-10-01','b','2',6),rr('2026-10-02','c','1',9),rr('2026-10-03','d','1',0),rr('2026-10-03','d','2',0)],['1','2'],'UTC');
assert.equal(rm.length,2);assert.equal(rm[0].media,5);assert.equal(rm[1].media,0);
assert.equal(c.serieRightmove_([rr('2026-10-01','a','1',5),rr('2026-10-01','a','3',5)],['1','2'],'UTC').length,0);
console.log('PASS progressão: mesmo grupo completo, datas parciais excluídas, percentagens e valores inválidos, zeros reais, última recolha da data e sem somar lotes.');

const crypto=await import('node:crypto');
class RangeHist{constructor(sh,r,col,n=1,w=1){Object.assign(this,{sh,r,col,n,w});}getValues(){return Array.from({length:this.n},(_,i)=>Array.from({length:this.w},(_,j)=>this.sh.a[this.r+i-1]?.[this.col+j-1]??''));}getDisplayValues(){return this.getValues().map(r=>r.map(String));}setValues(v){if(this.r>1&&this.sh.ss.failNext){this.sh.ss.failNext=false;throw Error('falha simulada');}v.forEach((row,i)=>row.forEach((x,j)=>{this.sh.a[this.r+i-1]??=[];this.sh.a[this.r+i-1][this.col+j-1]=x;}));return this;}clearContent(){return this.setValues(Array.from({length:this.n},()=>Array(this.w).fill('')));}setBackground(){return this;}setFontColor(){return this;}setFontWeight(){return this;}setNumberFormat(){return this;}}
class SheetHist{constructor(ss){this.ss=ss;this.a=[];}getRange(...args){return new RangeHist(this,...args);}getLastRow(){let n=this.a.length;while(n&&!this.a[n-1]?.some(x=>x!==''))n--;return n;}getMaxRows(){return 1000;}setFrozenRows(){}setColumnWidths(){}}
const ssH={sh:null,getSheetByName(){return this.sh;},insertSheet(){return this.sh=new SheetHist(this);}};
c.Utilities={formatDate:()=> '2026-10-23',parseDate:x=>x,DigestAlgorithm:{SHA_256:1},Charset:{UTF_8:1},computeDigest:(_,s)=>Array.from(crypto.createHash('sha256').update(s).digest())};c.SpreadsheetApp={flush(){}};
const source=(id,val,day='2026-10-20')=>{const r=Array(22).fill('');r[0]=day;r[2]=id;r[5]=10;r[6]=1;r[7]='Disponível';r[17]=val;return r;};
let captured=c.guardarMedicaoRightmove_(ssH,[source('1',3),source('2',5)],'UTC');assert.equal(captured.length,2);assert.equal(ssH.sh.getLastRow(),3);
c.guardarMedicaoRightmove_(ssH,[source('2',5),source('1',3)],'UTC');assert.equal(ssH.sh.getLastRow(),3);
captured=c.guardarMedicaoRightmove_(ssH,[source('1',5),source('2',5)],'UTC');assert.equal(captured.length,4);assert.equal(c.serieRightmove_(captured,['1','2'],'UTC')[0].media,5);
const before=JSON.stringify(ssH.sh.a);ssH.failNext=true;assert.throws(()=>c.guardarMedicaoRightmove_(ssH,[source('1',9),source('2',9)],'UTC'),/falha simulada/);assert.equal(JSON.stringify(ssH.sh.a.slice(0,5)),before);
assert.throws(()=>c.guardarMedicaoRightmove_(ssH,[source('1',3),source('1',3)],'UTC'),/repetidos/);
console.log('PASS histórico Rightmove: duplicação impedida mesmo com outra ordem, revisão preservada, último lote selecionado e falha sem alterar registos anteriores.');

const lr=(a,b,t,call,email,dt='2026-10-23')=>[a,b,'','Rightmove',t,'','','',dt,'',call,email];
let ml=c.leadsMensaisRightmove_([lr('2026-07-01','2026-07-31',0,0,0),lr('2026-09-01','2026-09-30',1,0,1),lr('2026-10-01','2026-10-20',1,1,0),lr('2026-10-01','2026-10-23',2,1,1),lr('2026-10-01','2026-10-23',2,1,1)],'UTC');assert.equal(ml.length,3);assert.equal(ml[0].total,0);assert.equal(ml[2].total,2);assert.equal(ml[2].parcial,true);assert.equal(ml[1].parcial,false);assert.equal(c.leadsMensaisRightmove_([lr('2026-10-01','2026-10-23',3,1,1)],'UTC').length,0);assert.equal(c.leadsMensaisRightmove_([lr('2026-10-01','2026-10-23',0,'','')],'UTC').length,0);console.log('PASS leads Rightmove: meses parciais, zero real, revisão e repetição não somadas, totais incoerentes e canais desconhecidos rejeitados.');

// Abertura: reutilização, alteração de valores, falha e alteração concorrente.
const props=new Map();c.PropertiesService={getDocumentProperties:()=>({getProperty:k=>props.get(k),setProperty:(k,v)=>props.set(k,v),deleteProperty:k=>props.delete(k)})};
let released=0,builds=0,sourceValue=1,failBuild=false,concurrent=false;
c.LockService={getDocumentLock:()=>({tryLock:()=>true,releaseLock:()=>released++})};
const ds={getSheetId:()=>1,getLastRow:()=>2,getLastColumn:()=>1,getRange:()=>({getValues:()=>[[sourceValue]],getValue:()=> 'Resultados dos portais'}),getCharts:()=>[]};
c.SpreadsheetApp={getActive:()=>({getSheetByName:()=>ds,getSpreadsheetTimeZone:()=> 'UTC'})};
c.atualizarDashboardVisual_=()=>{builds++;if(failBuild)throw Error('falha');if(concurrent)sourceValue++;return{graficos:3};};
c.atualizarDashboardSeNecessario();assert.equal(builds,1);assert.equal(c.atualizarDashboardSeNecessario().reutilizado,true);assert.equal(builds,1);
sourceValue=2;c.atualizarDashboardSeNecessario();assert.equal(builds,2);
sourceValue=3;failBuild=true;assert.throws(()=>c.atualizarDashboardSeNecessario(),/falha/);failBuild=false;c.atualizarDashboardSeNecessario();assert.equal(builds,4);
sourceValue=4;concurrent=true;c.atualizarDashboardSeNecessario();concurrent=false;c.atualizarDashboardSeNecessario();assert.equal(builds,6);assert.equal(c.atualizarDashboardSeNecessario().reutilizado,true);assert.equal(released,8);
console.log('PASS abertura dashboard: reutiliza sem mudanças, deteta valor alterado, repete após falha e não oculta alteração concorrente.');

// Importações de detalhe não devem invalidar uma vista com os mesmos indicadores.
let perfRows=[];const mkPerf=(janela,media,hash)=>['2026-10-25','2026-10-23',janela,'101','12345_101','Local',100000,12,1,2,media,'New entry','-20%',5,hash,'https://example.invalid'];
const sigSheet=(name)=>({getSheetId:()=>name==='Rightmove - desempenho'?1:2,getLastRow:()=>perfRows.length+1,getLastColumn:()=>16,getRange:()=>({getValues:()=>perfRows,getValue:()=> 'Resultados dos portais'}),getCharts:()=>[]});
const sigSS={getSpreadsheetTimeZone:()=> 'UTC',getSheetByName:name=>['Rightmove - desempenho','Dashboard','Clara - dashboard'].includes(name)?sigSheet(name):null};
perfRows=[mkPerf(30,4,'a')];const sig1=c.assinaturaDashboard_(sigSS);perfRows.push(mkPerf(60,9,'b'),mkPerf(90,10,'c'));assert.equal(c.assinaturaDashboard_(sigSS),sig1);perfRows.push(mkPerf(30,4,'novo-lote'));assert.equal(c.assinaturaDashboard_(sigSS),sig1);perfRows.push(mkPerf(30,5,'correcao'));assert.notEqual(c.assinaturaDashboard_(sigSS),sig1);
const range={getSheet:()=>({getSheetId:()=>1}),getA1Notation:()=> 'A1:B3',getValues:()=>[['Dia','Total'],['2026-10-23',3]]};const chartSig=c.assinaturaGraficoDashboard_('Leads',range,19,1,'COLUMN',{colors:['blue']});
assert.equal(c.podeReutilizarGraficoDashboard_(JSON.stringify({assinatura:chartSig,id:10}),chartSig,{getChartId:()=>10}),true);assert.equal(c.podeReutilizarGraficoDashboard_(JSON.stringify({assinatura:chartSig,id:10}),chartSig,{getChartId:()=>11}),false);assert.notEqual(c.assinaturaGraficoDashboard_('Leads',range,19,1,'COLUMN',{colors:['green']}),chartSig);assert.equal(c.podeReutilizarGraficoDashboard_('corrompido',chartSig,{getChartId:()=>10}),false);
console.log('PASS desempenho dashboard: 60/90 e lotes equivalentes não reconstruem vista de 30 dias; correções reais invalidam; identidade, dados e opções protegem reutilização dos gráficos.');

{
 const r=(hash,id,key,val)=>['2026-10-25','carteira_ativa','','','',id?'TESTE-001':'',id||'carteira',key,val,'',hash,'https://www.idealista.pt/tools/publicacion/idealista?ScopeId=1',''];
 const first=[r('a','101','ativo',1),r('a','102','ativo',1),r('a','','totalAtivos',2)],second=[r('b','101','ativo',1),r('b','103','ativo',1),r('b','','totalAtivos',2)];
 const code=(fs.readFileSync(new URL('../apps-script/clara/GreenAcres.gs',import.meta.url),'utf8')+'\n'+fs.readFileSync(new URL('../apps-script/clara/DashboardVisual.gs',import.meta.url),'utf8')),test={};vm.createContext(test);vm.runInContext(code,test);
 assert.equal(test.carteiraAtivaDashboardIdealista_(first).primeira,true);const result=test.carteiraAtivaDashboardIdealista_(first.concat(second));assert.equal(result.total,2);assert.equal(result.entradas,1);assert.equal(result.saidas,1);assert.equal(test.carteiraAtivaDashboardIdealista_([r('bad','','totalAtivos',2)]),null);
 console.log('PASS dashboard carteira: primeira recolha, entradas/saídas e carteira incompleta excluída.');
}

const tagged=(a,b,label)=>{const x=r('novo',a,b,54);x[4]=JSON.stringify([label,'Venda e arrendamento']);return x;};
assert.equal(c.periodo30Dashboard_([r('antigo','2026-09-22','2026-10-21',61),tagged('2026-09-27','2026-10-27','30 dias')],'UTC').dias,31);
assert.equal(c.periodo30Dashboard_([tagged('2026-09-27','2026-10-27','30 dias')],'UTC').metricas.contactos,54);
assert.equal(c.periodo30Dashboard_([tagged('2026-09-27','2026-10-27','90 dias')],'UTC'),null);
assert.equal(c.periodo30Dashboard_([tagged('2026-09-26','2026-10-27','30 dias')],'UTC'),null);
assert.equal(c.periodo30Dashboard_([r('semEtiqueta','2026-09-27','2026-10-27',54)],'UTC'),null);
const fontePeriodo=fs.readFileSync(new URL('../apps-script/clara/DashboardVisual.gs',import.meta.url),'utf8');assert.match(fontePeriodo,/v.getRange\(1,1,daily.length\+1,4\)/);assert.match(fontePeriodo,/String\(r\[10\]\)===p.id/);
console.log('PASS Idealista: etiqueta oficial 30 dias com 31 datas, datas reais preservadas, 90 dias e intervalos estranhos recusados, série ligada à mesma recolha e intervalo dinâmico.');

