import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';
const c={console,Utilities:{formatDate:d=>d.toISOString().slice(0,10)}};vm.createContext(c);vm.runInContext(fs.readFileSync(new URL('../apps-script/clara/DashboardVisual.gs',import.meta.url),'utf8'),c);
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
