import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';import crypto from 'node:crypto';
const source=fs.readFileSync(new URL('../apps-script/clara/Codigo.gs',import.meta.url),'utf8')+'\n'+fs.readFileSync(new URL('../apps-script/clara/Idealista.gs',import.meta.url),'utf8')+'\n'+fs.readFileSync(new URL('../apps-script/clara/ContactosIdealista.gs',import.meta.url),'utf8');
class Sheet{constructor(){this.rows=[];this.fail=false;}getLastRow(){return this.rows.length}getMaxRows(){return 1000}setFrozenRows(){}getRange(r,c,n=1,m=1){const s=this;return {getDisplayValues(){return this.getValues().map(r=>r.map(String))},getValues(){return Array.from({length:n},(_,i)=>Array.from({length:m},(_,j)=>s.rows[r+i-1]?.[c+j-1]??''))},setValues(v){if(s.fail){s.fail=false;throw Error('Falha simulada')}v.forEach((a,i)=>{s.rows[r+i-1]??=[];a.forEach((v,j)=>s.rows[r+i-1][c+j-1]=v)});return this},clearContent(){for(let i=0;i<n;i++)for(let j=0;j<m;j++)if(s.rows[r+i-1])s.rows[r+i-1][c+j-1]='';return this},setNumberFormat(){return this},setFontWeight(){return this},setBackground(){return this},setFontColor(){return this}}}}
let sh=null;const ss={getSheetByName(){return sh},insertSheet(){sh=new Sheet;return sh},getSpreadsheetTimeZone(){return 'Europe/Lisbon'}};
const ctx={console,Date,Number,JSON,SpreadsheetApp:{getActive:()=>ss,flush(){}},LockService:{getDocumentLock:()=>({tryLock:()=>true,releaseLock(){}})},Utilities:{DigestAlgorithm:{SHA_256:'sha256'},computeDigest:(_,s)=>Array.from(crypto.createHash('sha256').update(s).digest()),parseDate:s=>new Date(s+'T00:00:00Z'),formatDate:d=>d.toISOString().slice(0,10)}};vm.createContext(ctx);vm.runInContext(source,ctx);
const p={v:2,origem:'idealista',tipo:'lista',lido:'2026-10-22T12:00:00Z',url:'https://www.idealista.pt/tools/listadostarter',periodo:{inicio:null,fim:null},filtros:[],cobertura:'Parcial: página aberta',registos:[{id:'123',ref:'TESTE-001',metricas:{qualidade:75},publicacao:'idealista',rendimento:'alto'}]};
const enc=x=>'CLARA2:'+JSON.stringify(x);
let a=ctx.analisar(enc(p),{});assert.equal(a.quantidade,1);assert.equal(sh,null,'pré-visualização não cria tabelas');
let r=ctx.gravar(enc(p),{});assert.equal(r.escritos,3);assert.equal(ctx.gravar(enc(p),{}).duplicada,true);assert.equal(sh.getLastRow(),4);
let next=structuredClone(p);next.registos[0].metricas.qualidade=80;assert.equal(ctx.gravar(enc(next),{}).duplicada,false);assert.equal(sh.rows[1][8],75,'histórico preservado');
let nulls=structuredClone(p);nulls.registos[0].metricas.qualidade=null;nulls.registos[0].ref='=UNSAFE()';let nr=ctx.gravar(enc(nulls),{});assert.equal(nr.escritos,2);assert.ok(sh.rows.some(r=>r[5]==="'=UNSAFE()"));
let bad=structuredClone(p);bad.tipo='ranking';assert.throws(()=>ctx.analisar(enc(bad),{}),/período/);bad.periodo={inicio:'2026-99-99',fim:'2026-10-22'};assert.throws(()=>ctx.analisar(enc(bad),{}),/período/);
bad=structuredClone(p);bad.registos[0].metricas.qualidade=101;assert.throws(()=>ctx.analisar(enc(bad),{}),/escala/);
bad=structuredClone(p);bad.url='https://www.idealista.pt.evil.invalid/';assert.throws(()=>ctx.analisar(enc(bad),{}),/inválida/);
next.registos[0].metricas.qualidade=85;sh.fail=true;assert.throws(()=>ctx.gravar(enc(next),{}),/Falha simulada/);assert.ok(!sh.rows.some(r=>r[8]===85));
console.log('PASS Idealista: pré-visualização sem escrita, histórico, duplicação, desconhecido sem zero, texto literal, validação de período/host/escala e falha de gravação.');
const cc={URL};vm.createContext(cc);vm.runInContext(fs.readFileSync(new URL('../apps-script/clara/idealista.js',import.meta.url),'utf8'),cc);
const el=t=>({textContent:t,innerText:t});const doc={body:{innerText:'de 01/10/2026 até 21/10/2026'},querySelector(){return null},querySelectorAll(){return []}};
const row={children:Array.from({length:11},()=>el('')),getAttribute:()=> '123',querySelector:s=>s==='.exteral-ref'?el('Ref TESTE-001'):s==='.quality-info-col svg text'?el('75%'):null,querySelectorAll:()=>[]};row.children[8]=el('idealista');row.children[10]=el('alto');
doc.querySelectorAll=s=>s==='ul.row[data-key]'?[row]:[];
const lista=cc.recolherIdealista(doc,{url:p.url,lido:p.lido});assert.equal(lista.registos[0].metricas.qualidade,75);assert.match(lista.cobertura,/Parcial/);
row.querySelector=s=>s==='.exteral-ref'?el('Ref TESTE-001'):null;assert.equal(cc.recolherIdealista(doc,{url:p.url,lido:p.lido}).registos[0].metricas.qualidade,null,'não inventa zero');
const tr={querySelectorAll:()=>['1','Imóvel fictício','1.234','12','0','35','3','0','2'].map(el),querySelector:()=>({getAttribute:()=>'/tools/propiedad/123/estadisticas'})};
doc.querySelectorAll=s=>s==='table tr'?[tr]:s==='h2'?[el('ranking 30 dias')]:[];
const ranking=cc.recolherIdealista(doc,{url:'https://www.idealista.pt/webtool/stats/loadImpactStats',lido:p.lido});assert.equal(ranking.registos[0].metricas.visitasListas,1234);assert.equal(ranking.registos[0].metricas.chamadas,0);assert.equal(ranking.periodo.inicio,'2026-10-01');
const zona=cc.recolherIdealista(doc,{url:'https://www.idealista.pt/webtool/stats/rank/neighborhood',lido:p.lido});assert.equal(zona.tipo,'zona');assert.match(zona.cobertura,/não é a carteira/);
doc.body.innerText='de 01/10/2026 até 21/10/2026\n1 000 impactos (Soma\n5 contactos recebidos\n50 anúncios ativos hoje';doc.querySelectorAll=s=>s==='td'?[el('900 visitas nas listas'),el('5 de cliente'),el('0 de angariação'),el('3 emails e/ou mensagens'),el('2 chamadas')]:[];
const geral=cc.recolherIdealista(doc,{url:'https://www.idealista.pt/webtool/stats/loadImpactStats',lido:p.lido});assert.equal(geral.registos[0].metricas.contactos,5);assert.equal(geral.registos[0].metricas.angariacao,0);assert.equal(geral.registos[0].metricas.visitasListas,900);
console.log('PASS coletor: score SVG, desconhecido sem zero, números portugueses, período, ranking, comparativo e contactos separados de impactos.');
let relative=structuredClone(p);relative.tipo='zona';relative.periodo={inicio:null,fim:null,etiqueta:'30 dias'};assert.equal(ctx.analisar(enc(relative),{}).periodo.etiqueta,'30 dias');relative.tipo='ranking';assert.throws(()=>ctx.analisar(enc(relative),{}),/período/);
const history=(page,ids,total=4,filter='[]',batch='p'+page)=>ids.map(id=>['2026-10-22','lista','','',filter,'TESTE',id,'qualidade','75','',batch,`https://www.idealista.pt/tools/listadostarter?CurrentPage=${page}&ItemsPerPage=2&OrderedBy=date&OrderedType=DESC`,total?'PAGINACAO:'+JSON.stringify({pagina:page,porPagina:2,totalAtivos:total}):'']);
const summary=x=>ctx.resumoPaginasIdealista_(x);
assert.match(summary([...history(1,['a','b']),...history(2,['c','d'])]),/Recolha completa confirmada/);
assert.match(summary(history(2,['c','d'])),/Páginas em falta: 1/);
assert.match(summary([...history(1,['a','b']),...history(2,['b','d'])]),/repetidos entre páginas/);
assert.doesNotMatch(summary([...history(1,['a','b']),...history(2,['c','d'],4,'["Venda"]')]),/completa confirmada/);
assert.match(summary([...history(1,['a','b']),...history(1,['a','x'],4,'[]','p1b'),...history(2,['c','d'])]),/Conteúdo diferente/);
assert.match(summary([...history(1,['a','b']),...history(1,['a','b'],4,'[]','p1b'),...history(2,['c','d'])]),/Imóveis únicos: 4/);
assert.match(summary([...history(1,['a','b'],null),...history(2,['c','d'],null)]),/não guardou o total/);
assert.doesNotMatch(summary([...history(1,['a','b']),...history(2,['c'],4)]),/completa confirmada/);
assert.match(summary([...history(1,['a','b']),...history(2,['c','d'],5)]),/total de ativos mudou/);
console.log('PASS cobertura: páginas em falta, duplicados, sobreposição, alterações, filtros, total desconhecido e tamanho da última página.');
doc.body.innerText='496\u00a0409  impactos \u00a0(Soma das visitas)\n61  contactos recebidos\n50 anúncios ativos hoje\nde 22/09/2026 até 21/10/2026';
doc.querySelectorAll=s=>s==='td'?[el('448\u00a0953 visitas totais'),el('47\u00a0456 ações em anúncios'),el('0 enviado aos amigos')]:[];
const spacing=cc.recolherIdealista(doc,{url:'https://www.idealista.pt/webtool/stats/loadImpactStats',lido:p.lido});
assert.equal(spacing.registos[0].metricas.impactos,496409);assert.equal(spacing.registos[0].metricas.visitasTotais,448953);assert.equal(spacing.registos[0].metricas.acoes,47456);
const preview=ctx.analisarIdealista(enc(spacing));assert.equal(preview.estatisticas.length,15);assert.equal(preview.estatisticas.find(x=>x.nome==='Favoritos').valor,null);
const review=ctx.resumoEstatisticasIdealista_(preview);assert.match(review,/Impactos: 496 409/);assert.match(review,/Favoritos: Não recolhido/);assert.match(review,/Envios a amigos: 0/);assert.match(review,/Gráfico diário não recolhido/);
console.log('PASS estatísticas: espaços duplicados e não separáveis, totais de visitas e ações, revisão legível e ausentes distintos de zero.');

vm.runInContext(fs.readFileSync(new URL('../apps-script/clara/DashboardIdealista.gs',import.meta.url),'utf8'),ctx);
const stat=(id,begin,end,key,val,filters='["Venda"]')=>['2026-10-23','geral',begin,end,filters,'','carteira',key,val,'',id,'',''];
const dashboard=ctx.dadosDashboardIdealista_([
 stat('old','2026-09-22','2026-10-21','contactos',10),
 stat('90','2026-07-24','2026-10-21','contactos',50),
 stat('new','2026-09-22','2026-10-21','contactos',12),
 stat('new','2026-09-22','2026-10-21','partilhas',0),
 stat('rent','2026-09-22','2026-10-21','contactos',3,'["Arrendamento"]')]);
assert.equal(dashboard.length,3);assert.equal(dashboard.find(x=>x.filtros==='["Venda"]'&&x.inicio==='2026-09-22').metricas.contactos,12);
assert.equal(dashboard.find(x=>x.inicio==='2026-07-24').metricas.contactos,50);
assert.equal(dashboard.find(x=>x.inicio==='2026-09-22'&&x.filtros==='["Venda"]').metricas.partilhas,0);
assert.equal(dashboard[0].metricas.favoritos,undefined);
console.log('PASS Dashboard: períodos e filtros separados, última recolha do período, zero distinto de ausente e sem somar janelas sobrepostas.');

const chartPayload=structuredClone(p);chartPayload.tipo='geral';chartPayload.periodo={inicio:'2026-10-01',fim:'2026-10-02'};chartPayload.registos=[{id:'carteira',metricas:{contactos:3,mensagens:2,chamadas:1}}];chartPayload.diarios=[{data:'2026-10-01',contactos:1,mensagens:1,chamadas:0},{data:'2026-10-02',contactos:2,mensagens:1,chamadas:1}];
assert.doesNotThrow(()=>ctx.validarContactosDiariosIdealista_(chartPayload));
let broken=structuredClone(chartPayload);broken.diarios[1].data='2026-10-01';assert.throws(()=>ctx.validarContactosDiariosIdealista_(broken),/Dias/);
broken=structuredClone(chartPayload);broken.registos[0].metricas.contactos=99;assert.throws(()=>ctx.validarContactosDiariosIdealista_(broken),/soma diária/);
const raw={ticks:[{valor:0,y:100},{valor:2,y:0}],total:[{x:0,y:50},{x:10,y:0}],opt:[{x:0,y:50},{x:10,y:50}]};
const decoded=cc.descodificarContactosSVGIdealista(raw,'2026-10-01','2026-10-02',3,2);assert.equal(decoded[1].data,'2026-10-02');assert.equal(decoded[1].contactos,2);
assert.throws(()=>cc.descodificarContactosSVGIdealista(raw,'2026-10-01','2026-10-03',3,2),/todos os dias/);
assert.throws(()=>cc.descodificarContactosSVGIdealista(raw,'2026-10-01','2026-10-02',9,2),/soma diária/);
const fractional=structuredClone(raw);fractional.total[0].y=49;assert.throws(()=>cc.descodificarContactosSVGIdealista(fractional,'2026-10-01','2026-10-02',3,2),/inteiro/);
const dailyRow=(hash,date,key,value)=>['2026-10-23','contactos_diarios','2026-10-01','2026-10-02','[]','',date,key,value,'',hash,'',''];
const dailyHistory=chartPayload.diarios.flatMap(x=>['contactos','mensagens','chamadas'].map(k=>dailyRow('one',x.data,k,x[k])));
const grouped=ctx.dadosGraficoContactosIdealista_(dailyHistory.concat(dailyHistory.map(x=>{const r=[...x];r[10]='two';return r;})),'Europe/Lisbon');assert.equal(grouped.diarios.length,2);assert.equal(grouped.diarios[1].chamadas,1);
console.log('PASS contactos diários: escala SVG, datas completas, soma igual ao portal, frações rejeitadas, dias repetidos rejeitados e recolhas sobrepostas não somadas.');
const markerSource=fs.readFileSync(new URL('../apps-script/clara/marcador.js',import.meta.url),'utf8').replace('/* CLARA_UI */',fs.readFileSync(new URL('../apps-script/clara/marcador-ui.js',import.meta.url),'utf8')).replace('/* IDEALISTA_COLLECTOR */',fs.readFileSync(new URL('../apps-script/clara/idealista.js',import.meta.url),'utf8')).split(/\r?\n/).map(x=>x.trim()).filter(Boolean).join(' ');
assert.doesNotThrow(()=>new vm.Script(markerSource),'marcador compacto continua válido');
console.log('PASS sintaxe do marcador compacto com leitura diária assíncrona.');

cc.setTimeout=fn=>{fn();return 0;};
let selected='email',enabled=false;
const emailRadio={get checked(){return selected==='email'},click(){selected='email'}},callRadio={get checked(){return selected==='call'},click(){selected='call'}},totalBox={get checked(){return enabled},click(){enabled=!enabled}};
const svgMock={querySelector:q=>q==='#HISTOEMAIL'?emailRadio:q==='#HISTOCALL'?callRadio:totalBox,querySelectorAll:q=>q.includes('.tick')?raw.ticks.map(t=>({textContent:String(t.valor),getAttribute:()=>`translate(0,${t.y})`})):(q.includes('target-total')?raw.total:selected==='email'?raw.opt:[{x:0,y:100},{x:10,y:50}]).map(t=>({getAttribute:k=>String(k==='cx'?t.x:t.y)}))};
const automatic=structuredClone(chartPayload);delete automatic.diarios;await cc.recolherDiariosIdealista(svgMock,automatic);
assert.equal(automatic.diarios.length,2);assert.equal(automatic.diarios[1].chamadas,1);assert.equal(selected,'email');assert.equal(enabled,false);
const failedAuto=structuredClone(automatic);failedAuto.registos[0].metricas.contactos=99;delete failedAuto.diarios;await assert.rejects(()=>cc.recolherDiariosIdealista(svgMock,failedAuto),/soma diária/);assert.equal(selected,'email');assert.equal(enabled,false);
console.log('PASS marcador: recolhe as duas séries, espera estabilização e repõe rádios/checkbox após sucesso ou falha.');

{
 const d={v:2,origem:'idealista',tipo:'geral',lido:'2026-10-25T12:00:00Z',url:'https://www.idealista.pt/webtool/stats/loadImpactStats',periodo:{inicio:'2026-09-25',fim:'2026-10-24'},filtros:['30 dias'],cobertura:'Totais',registos:[{id:'carteira',metricas:{anunciosAtivosHoje:2}}],carteiraAtiva:{url:'https://www.idealista.pt/tools/publicacion/idealista?ScopeId=1',total:2,paginas:1,registos:[{id:'101',ref:'TESTE-001'},{id:'102',ref:'TESTE-002'}]}};
 sh=null;let result=ctx.analisarIdealista(enc(d));assert.equal(result.carteira.primeira,true);ctx.gravarIdealista(enc(d));assert.equal(ctx.gravarIdealista(enc(d)).duplicada,true);
 const changed=structuredClone(d);changed.carteiraAtiva.registos[1]={id:'103',ref:'TESTE-003'};result=ctx.analisarIdealista(enc(changed));assert.equal(result.carteira.primeira,false);assert.equal(result.carteira.entradas[0].id,'103');assert.equal(result.carteira.saidas[0].id,'102');
 for(const change of [x=>x.carteiraAtiva.registos.pop(),x=>x.carteiraAtiva.registos[1].id='101',x=>x.carteiraAtiva.url='https://evil.invalid/',x=>x.registos[0].metricas.anunciosAtivosHoje=3]){const bad=structuredClone(d);change(bad);assert.throws(()=>ctx.analisarIdealista(enc(bad)));}
 const empty=structuredClone(d);empty.carteiraAtiva.total=0;empty.carteiraAtiva.registos=[];empty.registos[0].metricas.anunciosAtivosHoje=0;result=ctx.analisarIdealista(enc(empty));assert.equal(result.carteira.total,0);assert.equal(result.carteira.saidas.length,2);
 assert.match(ctx.resumoEstatisticasIdealista_(ctx.analisarIdealista(enc(d))),/Carteira ativa: 2 de 2/);
 console.log('PASS carteira ativa: primeira recolha, entradas/saídas, zero, cobertura, duplicados, validação e histórico separado do ranking.');
}
await import('./testar-idealista-ativos.mjs');

{
 class View extends Sheet{setColumnWidth(){return this}getRange(...args){const g=super.getRange(...args);g.setWrap=()=>g;return g;}}
 let view=null;const target={getSheetByName:()=>view,insertSheet:()=>view=new View};
 const c={primeira:false,total:1,entradas:[{id:'103',ref:'TESTE-003'}],saidas:[{id:'102',ref:'TESTE-002'}],registos:[{id:'103',ref:'TESTE-003'}]};
 ctx.atualizarVistaAtivosIdealista_(target,{lido:'2026-10-25T12:00:00Z'},c);assert.equal(view.rows[1][2],'Entrada');assert.equal(view.rows[2][2],'Saída desde a anterior');assert.equal(view.rows[1][3],'2026-10-25');
 view.rows[0][0]='Cabeçalho manual';assert.throws(()=>ctx.atualizarVistaAtivosIdealista_(target,{lido:'2026-10-25'},c),/cabeçalhos/);
 console.log('PASS vista de ativos: referências, entradas/saídas, datas sem horas e cabeçalhos alterados protegidos.');
}
