import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const code=fs.readFileSync(new URL('../apps-script/clara/EstadoDocumental.gs',import.meta.url),'utf8');
const c=vm.createContext({LEV:{nome:'Levantamento'},PEND:{nome:'Pendências da equipa'}});vm.runInContext(code,c);
const heads=['Referência EGO','Caderneta Predial (anexo)','Certificado Energético (anexo)','Contrato Mediação (anexo)','Licença Habitação (anexo)','Planta','Observações / justificação N/A','Resumo para a equipa','Vídeo','Imagens','Alt-text'];
const fixture=()=>({ref:'TESTE',row:10,c:{col:n=>heads.indexOf(n)+1},values:['TESTE','Em falta','Em falta','Em falta','Em falta','Em falta','','Resumo antigo','Preenchido'],nota:'Nota manual a conservar',estados:{caderneta:'Digitalizado',certificado:'Falta no eGO + dossier',contrato:'Por verificar',licenca:'Por verificar',planta:'Digitalizado'},pv:[['P0001','TESTE','Documentos','Documentos obrigatórios sem ficheiro no eGO','Caderneta Predial, Certificado Energético','','Andreia','Normal','Digitalizado'],['P0002','TESTE','Plantas','Imóvel sem planta','','','Andreia','Normal','Digitalizado'],['P0003','TESTE','Vídeo','Existe vídeo do imóvel?','','','Sara','Normal','A aguardar esclarecimento']]});
let s=fixture(),p=c.edPlano_(s,{},'migração');const value=(sheet,row,col)=>p.find(x=>x.folha===sheet&&x.linha===row&&x.col===col)?.valor;
assert.equal(value('Levantamento',10,2),'Digitalizado');assert.equal(value('Levantamento',10,6),'Digitalizado');assert.match(value('Levantamento',10,7),/Nota manual a conservar/);
const cert=p.find(x=>x.col===4&&x.valor==='Certificado Energético').linha;
assert.equal(value('Pendências da equipa',cert,7),'Sara');assert.equal(value('Pendências da equipa',cert,9),'A aguardar esclarecimento');
assert.equal(value('Pendências da equipa',6,9),'Não aplicável');assert.equal(value('Pendências da equipa',8,9),'Concluído');
assert.doesNotMatch(value('Levantamento',10,8),/Existe vídeo|Resumo antigo/);
// Replaying a plan must not create new IDs; manual work stays in progress.
for(const x of p){if(x.folha==='Levantamento')s.values[x.col-1]=x.valor;else{while(s.pv.length<=x.linha-6)s.pv.push(Array(17).fill(''));s.pv[x.linha-6][x.col-1]=x.valor;}}
s.nota=s.values[6];const existingIds=s.pv.map(r=>r[0]);p=c.edPlano_(s,{},'painel');assert(!p.some(x=>x.col===1&&!existingIds.includes(x.valor)));
const cad=s.pv.find(r=>r[3]==='Caderneta Predial');cad[8]='Em correção';s.estados.caderneta='No dossier > digitalizar';p=c.edPlano_(s,{},'painel');assert.equal(value('Pendências da equipa',s.pv.indexOf(cad)+6,9),'Em correção');
assert.equal(c.edEstado_('Em falta','Planta: em falta no eGO e no dossier; aguarda análise da Sara.','Planta'),'Falta no eGO + dossier');
assert.equal(c.edEstado_('Preenchido','Planta: em falta no eGO e no dossier.','Planta'),'Preenchido');
assert.throws(()=>c.edPlano_(fixture(),{planta:'inventado'},'painel'),/Estado não reconhecido/);
const f='=IF(A10="","",COUNTIFS(N10:S10,"Em falta"))';assert.match(c.edFormula_(f),/Digitalizado/);assert.equal(c.edFormula_(c.edFormula_(f)),c.edFormula_(f));
new vm.Script(fs.readFileSync(new URL('../apps-script/clara/EstadoDocumental.html',import.meta.url),'utf8').match(/<script>([\s\S]*)<\/script>/)[1]);
console.log('PASS seguimento: Digitalizado preservado, Sara por documento, notas conservadas, agrupamentos arquivados, resumo atualizado, repetição sem duplicados, estado em correção preservado, fórmulas idempotentes.');

const pt='=IF(A10="";"";COUNTIFS(N10:S10;"Em falta"))';const ptFixed=c.edFormula_(pt);assert.match(ptFixed,/COUNTIF\(N10:S10;"Digitalizado"\)/);assert.equal(c.edFormula_(ptFixed),ptFixed);
const mix='=IF(A10="";"";IF(COUNTIFS(PendenciasEquipe[Referência EGO],A10,PendenciasEquipe[Estado],"Digitalizado")>0,"Digitalizado","Rever estado"))';const fixed=c.edFormula_(mix);assert(!fixed.replace(/"[^"]*"/g,'').includes(','));
assert.equal(c.edCampoPendencia_(['','','Documentos','Contrato de mediação sem anexo visível'])[0],'contrato');
assert.equal(c.edCampoPendencia_(['','','Documentos','Duplicados em Outros documentos']),null);
const calls=[];c.edSheets_=(_,suffix,payload)=>{calls.push({suffix,payload});return{ sheets:[{properties:{title:'Levantamento'},tables:[{tableId:'T',range:{startColumnIndex:2,endColumnIndex:5},columnProperties:[{columnIndex:0,columnName:'Preservar',columnType:'TEXT'},{columnIndex:1,columnName:'Documento',columnType:'DROPDOWN',dataValidationRule:{condition:{type:'ONE_OF_LIST',values:[{userEnteredValue:'Estado antigo'}]}}},{columnIndex:2,columnName:'Data',columnType:'DATE'}]}]}]};};
c.edConfigurarDropdowns_({},[{nome:'Levantamento',col:4,opcoes:['Digitalizado']}]);const update=calls[1].payload.requests[0].updateTable;assert.equal(update.fields,'columnProperties');assert.equal(update.table.columnProperties[2].columnType,'DATE');assert.deepEqual(Array.from(update.table.columnProperties[1].dataValidationRule.condition.values,v=>v.userEnteredValue),['Estado antigo','Digitalizado']);
console.log('PASS tabelas e fórmulas PT: índices relativos, opções antigas e tipos não afetados preservados; separadores mistos corrigidos sem alterar texto.');

s=fixture();s.values[8]='Em falta';s.pv.push(['P0004','TESTE','Vídeo','Vídeo em falta','','','Sara','Normal','A aguardar esclarecimento','','','','','','','','','Resposta existente']);p=c.edPlano_(s,{},'painel');assert.equal(p.filter(x=>x.col===12&&String(x.valor).startsWith('Duplicada:')).length,1);assert.match(value('Levantamento',10,8),/Vídeo em falta/);
assert.equal(c.edCampoSimples_('Alt-text em falta'),'Alt-text');
console.log('PASS tarefas antigas: vídeo duplicado consolidado na linha com resposta, sem apagar a resposta, e alt-text antigo reconhecido.');
