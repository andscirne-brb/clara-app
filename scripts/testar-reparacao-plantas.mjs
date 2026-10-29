import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';
const c={LEV:{nome:'Levantamento'},PEND:{nome:'Pendências da equipa'},dataHoje_:()=>new Date('2026-10-29T00:00:00Z')};vm.createContext(c);for(const name of ['EstadoDocumental.gs','RepararPlantas.gs'])vm.runInContext(fs.readFileSync(new URL('../apps-script/clara/'+name,import.meta.url),'utf8'),c);
const heads=['Planta','Observações / justificação N/A','Resumo para a equipa'];
const original=['P0001','TESTE001','Plantas','Planta','Evidência manual','Procurar no dossiê e inserir no eGO.','Sara','Alta','Digitalizado'];
const duplicate=['P0002','TESTE001','Plantas','Imóvel sem planta','O site não mostra planta (fonte sintética).','Carregar a planta em imagem (JPG) no eGO.','Andreia','Normal','Por tratar'];
const fixture=()=>({ref:'TESTE001',row:10,c:{col:n=>heads.indexOf(n)+1},values:['Em falta','Outra nota','Resumo antigo'],nota:'Outra nota',pv:[original.slice(),duplicate.slice()]});
let s=fixture(),plan=c.planoRepararPlantas_(s);assert.equal(plan.find(x=>x.folha==='Levantamento'&&x.col===1).valor,'Digitalizado');assert.ok(!plan.some(x=>x.folha==='Pendências da equipa'&&x.linha===6));assert.ok(!plan.some(x=>[1,2,3,4,5,6,7,8,10,13,18].includes(x.col)&&x.folha==='Pendências da equipa'));
assert.match(plan.find(x=>x.folha==='Pendências da equipa'&&x.col===12).valor,/P0001/);assert.equal(plan.find(x=>x.folha==='Pendências da equipa'&&x.col===9).valor,'Arquivado');
for(const x of plan){if(x.folha==='Levantamento')s.values[x.col-1]=x.valor;else s.pv[x.linha-6][x.col-1]=x.valor;}
s.nota=s.values[1];assert.equal(c.planoRepararPlantas_(s).length,0);assert.equal(c.edPendenciaSubstituida_(s.pv[1]),true);
for(const col of [8,11,12,17]){s=fixture();s.pv[1][col]='Alteração manual';assert.throws(()=>c.planoRepararPlantas_(s),/alterações/);}
s=fixture();s.values[0]='Preenchido';assert.throws(()=>c.planoRepararPlantas_(s),/entretanto/);
console.log('PASS reparação dirigida: estado manual restaurado, original e notas intocados, duplicada encerrada sem apagar, repetição idempotente e edições concorrentes recusadas.');
