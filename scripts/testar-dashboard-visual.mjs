import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';
const c={console,Utilities:{formatDate:d=>d.toISOString().slice(0,10)}};vm.createContext(c);vm.runInContext(fs.readFileSync(new URL('../apps-script/clara/DashboardVisual.gs',import.meta.url),'utf8'),c);
const r=(id,a,b,val,k='contactos')=>['2026-10-23','geral',a,b,'["Venda e arrendamento"]','','',k,val,'',id];
assert.equal(c.periodo30Dashboard_([r('a','2026-07-25','2026-10-22',246),r('b','2026-09-22','2026-10-21',61)],'UTC').metricas.contactos,61);
assert.equal(c.periodo30Dashboard_([r('a','2026-09-22','2026-10-21',61),r('b','2026-09-22','2026-10-21',0)],'UTC').metricas.contactos,0);
assert.equal(c.periodo30Dashboard_([r('a','2026-07-25','2026-10-22',246)],'UTC'),null);
assert.equal(c.periodo30Dashboard_([r('a','2026-02-01','2026-03-02',1)],'UTC').metricas.contactos,1);
assert.equal(c.periodo30Dashboard_([r('a','2026-09-22','2026-10-21',1),r('b','2026-09-23','2026-10-22',2)],'UTC').metricas.contactos,2);
console.log('PASS dashboard visual: janela de 30 dias, data mais recente, repetição não somada, zero preservado, ausência distinta de zero e passagem de mês.');
