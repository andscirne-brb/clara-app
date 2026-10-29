/* Gerado por scripts/construir-coletor-portais.py. */
/* Exportações oficiais Green-Acres: só indicadores agregados, nunca contactos individuais. */
function linhasCSVGreen(text){
 if(typeof text!=='string'||text.length>2000000)throw Error('CSV demasiado grande.');let cell='',row=[],rows=[],quoted=false,closed=false;const s=text.replace(/^\uFEFF/,'');
 for(let i=0;i<s.length;i++){const x=s[i];if(quoted){if(x==='"'){if(s[i+1]==='"'){cell+='"';i++;}else{quoted=false;closed=true;}}else cell+=x;continue;}if(x==='"'){if(cell||closed)throw Error('CSV com aspas inválidas.');quoted=true;}else if(x===';'){row.push(cell);cell='';closed=false;}else if(x==='\r'||x==='\n'){if(x==='\r'&&s[i+1]==='\n')i++;row.push(cell);if(row.some(v=>v.trim()))rows.push(row);cell='';row=[];closed=false;}else{if(closed)throw Error('CSV mal formado.');cell+=x;}}
 if(quoted)throw Error('CSV incompleto.');row.push(cell);if(row.some(v=>v.trim()))rows.push(row);return rows;
}
function dataCSVGreen(s,mensal=false){
 const months={jan:1,fev:2,mar:3,abr:4,mai:5,jun:6,jul:7,ago:8,set:9,out:10,nov:11,dez:12};let a=/^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s.trim()),day,month,year;
 if(a){day=Number(a[1]);month=Number(a[2]);year=Number(a[3]);}else{a=/^(\d{2})\s+(jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)\s+(\d{4})$/i.exec(s.trim());if(!a)throw Error('Data Green-Acres não reconhecida.');day=Number(a[1]);month=months[a[2].toLowerCase()];year=Number(a[3]);}
 const date=new Date(Date.UTC(year,month-1,day)),iso=date.toISOString().slice(0,10);if(date.getUTCFullYear()!==year||date.getUTCMonth()!==month-1||date.getUTCDate()!==day||mensal&&day!==1)throw Error('Data inválida no CSV.');return iso;
}
function converterCSVGreen(text,codigo){
 const schemas={visitas:['Date','Visiteurs uniques quotidiens'],emails:['Date','Emails'],listas:['Date','Affichages en liste'],anuncios:['Date','Annonces sur Green-acres','Annonces sur Vizzit'],mensal:['Mois','Nb visites','Nb contacts']},schema=schemas[codigo],rows=linhasCSVGreen(text),headers=rows.shift();
 if(!schema||!headers||JSON.stringify(headers.map(x=>x.trim()))!==JSON.stringify(schema))throw Error('As colunas do CSV '+codigo+' mudaram.');
 const num=s=>{const n=s.replace(/\s/g,'');if(!/^\d+$/.test(n)||!Number.isSafeInteger(Number(n)))throw Error('Valor inválido no CSV '+codigo);return Number(n);},seen=new Set();let total=null;
 const linhas=[];for(const row of rows){if(row.length!==schema.length)throw Error('Linha incompleta no CSV '+codigo);if(row[0].trim()==='Total'){if(codigo!=='mensal'||total)throw Error('Total inesperado.');total=row.slice(1).map(num);continue;}const data=dataCSVGreen(row[0],codigo==='mensal');if(seen.has(data))throw Error('Data repetida no CSV '+codigo);seen.add(data);linhas.push({data,valores:row.slice(1).map(num)});}
 if(!linhas.length||linhas.length>4000)throw Error('CSV sem dados ou demasiado extenso.');linhas.sort((a,b)=>a.data.localeCompare(b.data));if(codigo==='mensal'&&(!total||total.some((v,i)=>linhas.reduce((n,r)=>n+r.valores[i],0)!==v)))throw Error('As somas não coincidem com o total do CSV mensal.');
 let faltam=0;if(codigo!=='mensal')for(let i=1;i<linhas.length;i++)faltam+=Math.round((Date.parse(linhas[i].data)-Date.parse(linhas[i-1].data))/86400000)-1;
 return{codigo,inicio:linhas[0].data,fim:linhas[linhas.length-1].data,faltamDias:faltam,linhas};
}
function parametrosExportacaoGreen(href,base){
 const u=new URL(href,base);if(u.origin!=='https://back.green-acres.com'||!/^\/pt\/Report\/Viewer\/ExportTableCsv\/\d+$/.test(u.pathname))throw Error('Exportação Green-Acres não reconhecida.');const params={};for(const [k,v]of u.searchParams){const m=/^reportParameters\[(\d+)\]\.Name$/.exec(k);if(m)params[v]=u.searchParams.get('reportParameters['+m[1]+'].Value');}if(!/^\d+$/.test(params.companyId||''))throw Error('Conta da exportação não identificada.');return{url:u.href,conta:params.companyId,sites:params.siteId||'relatorio_mensal'};
}
/* Endereço observado no botão CSV do relatório mensal oficial (View/1792).
   A conta vem da exportação visível atual; não depende do HTML ainda sem renderização. */
function exportacaoMensalGreen(conta){
 if(!/^\d{1,20}$/.test(String(conta)))throw Error('Conta da exportação mensal inválida.');
 const u=new URL('https://back.green-acres.com/pt/Report/Viewer/ExportTableCsv/4726');
 u.searchParams.set('reportParameters[0].Name','companyId');u.searchParams.set('reportParameters[0].Value',String(conta));u.searchParams.set('reportParameters[1].Name','groupBy');u.searchParams.set('reportParameters[1].Value','MONTH');return parametrosExportacaoGreen(u.href,u.href);
}
async function recolherGreenAcres(doc,ui){
 if(location.pathname==='/pt/Agent/Advert/List')return recolherAnunciosGreen(doc,ui);
 if(location.hostname!=='back.green-acres.com'||!/^\/pt\/Agent\/?$/.test(location.pathname))throw Error('Abre «Resumo da conta» no Green-Acres e volta a clicar na Clara.');
 const get=async url=>{const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);try{const res=await fetch(url,{credentials:'same-origin',cache:'no-store',signal:controller.signal});if(!res.ok||new URL(res.url).origin!=='https://back.green-acres.com')throw Error('A exportação Green-Acres falhou. Confirma a sessão.');return await res.text();}finally{clearTimeout(timer);}};
 const original=doc.querySelector('[role="tab"][aria-selected="true"][id^="visibility-tab-"]'),email=doc.querySelector('#visibility-tab-emails');
 try{
 if(!email)throw Error('As estatísticas não terminaram de carregar.');email.click();for(let i=0;i<50&&!doc.querySelector('a[href*="ExportTableCsv/195?"]');i++)await new Promise(r=>setTimeout(r,100));
 const ids={visitas:206,emails:195,listas:6026,anuncios:208},exports=[];
 for(const [codigo,id]of Object.entries(ids)){const a=doc.querySelector('a[href*="ExportTableCsv/'+id+'?"]');if(!a)throw Error('CSV '+codigo+' indisponível; não substituí por uma leitura parcial.');exports.push({codigo,...parametrosExportacaoGreen(a.getAttribute('href'),location.href)});}
 exports.push({codigo:'mensal',...exportacaoMensalGreen(exports[0].conta)});
 const conta=exports[0].conta;if(exports.some(x=>x.conta!==conta)||exports.filter(x=>x.codigo!=='mensal').some(x=>x.sites!=='all'))throw Error('Os relatórios pertencem a contas ou seleções diferentes.');
 ui.estado('A recolher cinco CSV oficiais…');const relatorios=await Promise.all(exports.map(async x=>converterCSVGreen(await get(x.url),x.codigo)));
 const current=doc.querySelector('a[href*="ExportTableCsv/206?"]');if(!current||parametrosExportacaoGreen(current.getAttribute('href'),location.href).conta!==conta)throw Error('A conta mudou durante a recolha.');
 return{v:4,origem:'green-acres',marcadorVersao:'20261026.2',lido:new Date().toISOString(),url:'https://back.green-acres.com/pt/Agent',conta,sites:'all',fonte:'CSV oficial Green-Acres',relatorios};
 }finally{if(original&&!original.matches('[aria-selected="true"]'))original.click();}
}

/* Lista de anúncios: pesquisa oficial sem executar ações de publicação. */
function paginaAnunciosGreen(doc){
 const clean=s=>String(s||'').replace(/\s+/g,' ').trim(),num=s=>{s=clean(s).replace(/[.\s]/g,'');if(!/^\d+$/.test(s)||!Number.isSafeInteger(+s))throw Error('Número inválido na lista Green-Acres.');return +s;};
 const form=doc.querySelector('#SearchForm');if(!form)throw Error('Lista Green-Acres indisponível. Confirma a sessão.');
 const fields=[...form.querySelectorAll('input[name],select[name]')].filter(e=>e.name.startsWith('SearchCriteria.')).map(e=>[e.name,e.value]).sort((a,b)=>a[0].localeCompare(b[0]));
 const periodo=form.querySelector('[name="SearchCriteria.Period"]');if(!periodo||!['yesterday','this_month','last_month','full'].includes(periodo.value))throw Error('Período Green-Acres não reconhecido.');
 const filters=fields.map(([name,value])=>{const e=form.querySelector('[name="'+name+'"]');return[name,e.tagName==='SELECT'?clean(e.options[e.selectedIndex].textContent):value];});
 const table=doc.querySelector('tr[id^="row_"]')?.closest('table');if(!table)throw Error('A lista está vazia ou ainda não carregou.');
 const headers=[...table.querySelectorAll('thead th')].map(e=>clean(e.textContent).toUpperCase());if(headers.length!==14||!headers[8].includes('VISUALIZAÇÕES')||!headers[9].includes('VISITAS')||!headers[10].includes('EMAILS')||!headers[11].includes('FAVORITOS'))throw Error('As colunas da lista Green-Acres mudaram.');
 const paging=clean(form.textContent).match(/(\d+) a (\d+) em (\d+)\s*$/);if(!paging)throw Error('Não identifiquei a cobertura da lista.');
 const start=num(paging[1]),end=num(paging[2]),total=num(paging[3]),page=Math.floor((start-1)/20)+1;
 const totalsRow=[...table.querySelectorAll('tr')].find(r=>clean(r.cells?.[0]?.textContent)==='Todos');if(!totalsRow||totalsRow.cells.length!==8)throw Error('Totais da lista indisponíveis.');const totais=[...totalsRow.cells].slice(2,6).map(e=>num(e.textContent));
 const anuncios=[...table.querySelectorAll('tr[id^="row_"]')].map(r=>{const c=[...r.cells],a=c[1]?.querySelector('a'),url=new URL(a?.getAttribute('href')||'', 'https://www.green-acres.pt');if(c.length!==14||!/^https:\/\/(www\.)?green-acres\.pt\/pt\/properties\/A[a-z0-9]+\.htm$/i.test(url.href)||!/^\d+$/.test(clean(a.textContent)))throw Error('Anúncio Green-Acres inválido.');return{ref:clean(a.textContent),url:url.href,estado:clean(c[2].textContent),difusao:clean(c[3].textContent),criado:dataCSVGreen(clean(c[4].textContent)),preco:num(c[5].textContent.replace('€','')),cidade:clean(c[6].textContent),pais:clean(c[7].textContent),fotos:clean(c[0].textContent)?num(c[0].textContent):null,semPlanta:/Sem planta/i.test(c[2].textContent),valores:c.slice(8,12).map(e=>num(e.textContent))};});
 if(total<1||total>10000||start!==(page-1)*20+1||end!==Math.min(page*20,total)||anuncios.length!==end-start+1)throw Error('Página Green-Acres incompleta.');
 return{page,start,end,total,totais,anuncios,fields,filtros:filters,periodo:periodo.value,periodoNome:clean(periodo.options[periodo.selectedIndex].textContent)};
}
function conferirAnunciosGreen(paginas){
 const first=paginas[0],seen=new Set(),all=[];if(!first||paginas.length!==Math.ceil(first.total/20))throw Error('Faltam páginas Green-Acres.');
 paginas.forEach((p,i)=>{if(p.page!==i+1||p.total!==first.total||JSON.stringify(p.fields)!==JSON.stringify(first.fields)||JSON.stringify(p.totais)!==JSON.stringify(first.totais))throw Error('Páginas ou filtros mudaram durante a recolha.');p.anuncios.forEach(a=>{if(seen.has(a.ref))throw Error('Anúncio repetido entre páginas. Volta a recolher.');seen.add(a.ref);all.push(a);});});
 if(all.length!==first.total||first.totais.some((v,i)=>all.reduce((n,a)=>n+a.valores[i],0)!==v))throw Error('A soma dos anúncios não coincide com os totais da lista.');return all;
}
async function recolherAnunciosGreen(doc,ui){
 const original=paginaAnunciosGreen(doc),form=doc.querySelector('#SearchForm'),action=new URL(form.getAttribute('action'),location.href);if(action.origin!=='https://back.green-acres.com'||action.pathname!=='/pt/Agent/Advert/List')throw Error('Pesquisa Green-Acres não reconhecida.');
 const body=new URLSearchParams();for(const [k,v]of new FormData(form)){if(typeof v==='string')body.append(k,v);}body.set('Action','');body.set('FromFirstPage','false');
 const get=async n=>{const b=new URLSearchParams(body);b.set('Page',String(n));const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),20000);try{const r=await fetch(action.href,{method:'POST',body:b,credentials:'same-origin',cache:'no-store',signal:controller.signal});if(!r.ok||new URL(r.url).pathname!==action.pathname)throw Error('A sessão ou pesquisa Green-Acres mudou.');return paginaAnunciosGreen(new DOMParser().parseFromString(await r.text(),'text/html'));}finally{clearTimeout(timer);}};
 ui.estado('A conferir todas as páginas dos anúncios…');const count=Math.ceil(original.total/20),pages=[];for(let n=1;n<=count;n+=3){const part=await Promise.all(Array.from({length:Math.min(3,count-n+1)},(_,i)=>get(n+i)));pages.push(...part);ui.estado('Anúncios: '+Math.min(n+2,count)+' de '+count+' páginas conferidas…');}
 const anuncios=conferirAnunciosGreen(pages),again=await get(1),now=paginaAnunciosGreen(doc);if(JSON.stringify(again)!==JSON.stringify(pages[0])||JSON.stringify(now)!==JSON.stringify(original)||JSON.stringify(pages[original.page-1])!==JSON.stringify(original))throw Error('A lista mudou durante a recolha. Não copiei dados parciais.');
 return{v:4,origem:'green-acres',tipo:'anuncios',marcadorVersao:'20261026.2',lido:new Date().toISOString(),url:'https://back.green-acres.com/pt/Agent/Advert/List',periodo:original.periodo,periodoNome:original.periodoNome,filtros:original.filtros,total:original.total,paginas:count,totais:original.totais,anuncios,fonte:'Lista oficial Green-Acres; sem CSV/Excel disponível'};
}

/* Piloto: uma leitura no Resumo Green-Acres, mantendo fontes e falhas separadas. */
async function recolherConjuntoGreen(doc,ui){
 if(location.hostname!=='back.green-acres.com'||!/^\/pt\/Agent\/?$/.test(location.pathname))throw Error('Abre o Resumo da conta Green-Acres para a recolha conjunta.');
 const hrefs=Array.from(doc.querySelectorAll('a[href]')).map(a=>new URL(a.getAttribute('href'),location.href)).filter(u=>u.origin===location.origin&&u.pathname==='/pt/Agent/Advert/List'),blocos=[],faltas=[];
 try{ui.estado('1 de 2 · A recolher cinco CSV oficiais…');const d=await recolherGreenAcres(doc,ui);blocos.push({nome:'estatisticas',texto:'CLARA4:'+JSON.stringify(d)});}catch(e){faltas.push({nome:'estatisticas',erro:String(e.message||e).slice(0,600)});}
 try{
  if(!hrefs.length)throw Error('Não encontrei a ligação oficial para a lista dos anúncios. Não usei um endereço alternativo.');
  ui.estado('2 de 2 · A abrir a lista sem mudar esta página…');const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),20000);let page;
  try{const r=await fetch(hrefs[0].href,{credentials:'same-origin',cache:'no-store',signal:controller.signal});if(!r.ok||new URL(r.url).origin!==location.origin||new URL(r.url).pathname!=='/pt/Agent/Advert/List')throw Error('A lista não respondeu com a sessão atual.');page=new DOMParser().parseFromString(await r.text(),'text/html');}finally{clearTimeout(timer);}
  const d=await recolherAnunciosGreen(page,ui);blocos.push({nome:'anuncios',texto:'CLARA4:'+JSON.stringify(d)});
 }catch(e){faltas.push({nome:'anuncios',erro:String(e.name==='AbortError'?'A lista demorou demasiado.':e.message||e).slice(0,600)});}
 if(!blocos.length)throw Error(faltas.map(f=>f.nome+': '+f.erro).join(' · '));
 return{v:6,origem:'green-acres',tipo:'conjunta',marcadorVersao:'20261028.2',lido:new Date().toISOString(),blocos,faltas};
}

function recolherIdealista(doc, contexto) {
  const txt = e => e ? e.textContent.replace(/\s+/g, ' ').trim() : '';
  const numero = s => /^\d[\d .]*%?$/.test(String(s).trim()) ? Number(String(s).replace(/[ .%]/g, '')) : null;
  const visivel = e => !!e && !e.hidden && (!e.getClientRects || e.getClientRects().length > 0);
  const body = (doc.body.innerText || doc.body.textContent).replace(/\s+/g, ' ').trim();
  const data = s => { const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s || ''); return m ? m[3]+'-'+m[2]+'-'+m[1] : null; };
  const out = {v:2,origem:'idealista',tipo:'',lido:contexto.lido,url:contexto.url,periodo:{inicio:null,fim:null},filtros:[],cobertura:'Parcial: apenas a página aberta',registos:[]};
  out.filtros = Array.from(doc.querySelectorAll('a.actived, a.active, button.dropdown-wrapper .placeholder')).filter(visivel).map(txt).filter(s=>s && s.length<80 && !/[-錄]/.test(s)).filter((s,i,a)=>a.indexOf(s)===i);
  const relativo=out.filtros.find(s=>/^(Hoje|7 dias|30 dias|90 dias)$/.test(s));
  if(relativo)out.periodo.etiqueta=relativo;
  const dates = /de (\d{2}\/\d{2}\/\d{4}) até (\d{2}\/\d{2}\/\d{4})/.exec(body);
  if (dates) Object.assign(out.periodo,{inicio:data(dates[1]),fim:data(dates[2])});
  const contact = doc.querySelector('a[href*="fromDate="][href*="toDate="]');
  if(contact){const u=new URL(contact.getAttribute('href'),contexto.url);Object.assign(out.periodo,{inicio:data(u.searchParams.get('fromDate')),fim:data(u.searchParams.get('toDate'))});}
  if (/\/tools\/listadostarter/.test(contexto.url)) {
    out.tipo='lista';
    out.filtros=Array.from(doc.querySelectorAll('a.icon-arrow-dropdown')).filter(visivel).map(txt).filter(Boolean);
    const pesquisa=doc.querySelector('input[placeholder="Referência, rua, localidade, etc..."]');if(pesquisa&&pesquisa.value.trim())out.filtros.push('Pesquisa: '+pesquisa.value.trim());
    if(!out.filtros.length)out.filtros=['Filtros da lista não identificados'];
    const params=new URL(contexto.url).searchParams;
    const pagina=params.get('CurrentPage');
    const total=/Imóveis ativos\s*\(([\d .]+)\)/i.exec(body);
    out.paginacao={pagina:Number(pagina)||1,porPagina:Number(params.get('ItemsPerPage'))||20,totalAtivos:total?numero(total[1]):null,ordem:(params.get('OrderedBy')||'')+' '+(params.get('OrderedType')||'')};if(pagina&&/^\d+$/.test(pagina))out.cobertura+=' · página '+pagina;
    out.registos=Array.from(doc.querySelectorAll('ul.row[data-key]')).filter(visivel).map(r=>{
      const cols=Array.from(r.children), ref=txt(r.querySelector('.exteral-ref')).replace(/^Ref\s+/,'');
      return {id:r.getAttribute('data-key'),ref:ref,metricas:{qualidade:numero(txt(r.querySelector('.quality-info-col svg text')))},publicacao:cols[8]?cols[8].innerText.trim():'',rendimento:cols[10]?cols[10].innerText.trim():'',aviso:Array.from(r.querySelectorAll('[title]')).some(e=>e.getAttribute('title')==='Validação pendente')?'Validação pendente':''};
    });
  } else if (/\/stats\/rank\/neighborhood/.test(contexto.url) || Array.from(doc.querySelectorAll('h2')).filter(visivel).some(e=>/^ranking\s/i.test(txt(e)))) {
    out.tipo=/\/stats\/rank\/neighborhood/.test(contexto.url)?'zona':'ranking';
    out.registos=Array.from(doc.querySelectorAll('table tr')).filter(visivel).map(r=>{
      const c=Array.from(r.querySelectorAll('td')); if(c.length!==9)return null;
      const a=r.querySelector('a[href*="/tools/propiedad/"],a[href*="/imovel/"]'), m=a&&/\/(?:propiedad|imovel)\/(\d+)/.exec(a.getAttribute('href'));
      const n=c.slice(2).map(e=>numero(txt(e)));if(n.some(x=>x===null))return null;
      return {id:m?m[1]:'',ref:'',posicao:numero(txt(c[0])),metricas:{visitasListas:n[0],visitasDetalhes:n[1],partilhas:n[2],alertas:n[3],favoritos:n[4],chamadas:n[5],mensagens:n[6]}};
    }).filter(Boolean);
    if(out.tipo==='zona')out.cobertura='Comparativo da zona: apenas os resultados visíveis; não é a carteira da agência';
  } else if (/\/stats\/loadImpactStats/.test(contexto.url)) {
    out.tipo='geral';out.cobertura='Totais visíveis da carteira no período e filtros selecionados';
    const metricas={}, labels={visitasTotais:'visitas totais',acoes:'ações em anúncios',visitasListas:'visitas nas listas',visitasDetalhes:'visitas em detalhes',agenciaOnline:'agência online',partilhas:'enviado aos amigos',alertas:'envios em alertas',favoritos:'favoritos',clientes:'de cliente',angariacao:'de angariação',mensagens:'emails e/ou mensagens',chamadas:'chamadas'};
    Object.keys(labels).forEach(k=>{for(const e of doc.querySelectorAll('td')){const t=txt(e),m=new RegExp('^([0-9][0-9 .]*) '+labels[k].replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'(?: |$)').exec(t);if(m){metricas[k]=numero(m[1]);break;}}});
    const total=/([\d .]+) impactos \(Soma/.exec(body), contactos=/([\d .]+) contactos recebidos/.exec(body), ativos=/([\d .]+) anúncios ativos hoje/.exec(body);
    if(total)metricas.impactos=numero(total[1].trim());if(contactos)metricas.contactos=numero(contactos[1].trim());if(ativos)metricas.anunciosAtivosHoje=numero(ativos[1].trim());
    if(Object.keys(metricas).length)out.registos=[{id:'carteira',ref:'',metricas:metricas}];
  }
  if(!out.tipo || !out.registos.length)throw new Error('Abre a lista de imóveis, o gráfico ou o ranking do Idealista e espera que os dados terminem de carregar.');
  if(out.tipo!=='lista' && (!out.periodo.inicio||!out.periodo.fim))out.cobertura+=out.tipo==='zona'&&relativo?' · '+relativo+'; datas exatas não indicadas nesta página':' · Período por confirmar antes de guardar';
  return out;
}
/* Leitura apenas dos pontos vetoriais visíveis; rejeita zoom parcial. */
function descodificarContactosSVGIdealista(raw,inicio,fim,totalEsperado,optEsperado){
  const a=Date.parse(inicio+'T00:00:00Z'),b=Date.parse(fim+'T00:00:00Z'),dias=Math.round((b-a)/86400000)+1;
  if(!Number.isFinite(a)||!Number.isFinite(b)||dias<1||dias>3660||raw.total.length!==dias||raw.opt.length!==dias)throw Error('O gráfico não mostra todos os dias do período. Repõe a vista completa e recolhe novamente.');
  const ticks=raw.ticks.filter(t=>Number.isFinite(t.valor)&&Number.isFinite(t.y)).sort((x,y)=>x.valor-y.valor);
  if(ticks.length<2)throw Error('A escala do gráfico não ficou identificada.');
  const z=ticks[0],u=ticks[ticks.length-1],escala=(u.y-z.y)/(u.valor-z.valor);
  if(!Number.isFinite(escala)||escala>=0||ticks.some(t=>Math.abs(t.y-(z.y+(t.valor-z.valor)*escala))>0.001))throw Error('Escala diária não reconhecida.');
  const valor=p=>{const n=z.valor+(p.y-z.y)/escala,v=Math.round(n);if(!Number.isFinite(n)||v<0||Math.abs(n-v)>0.0001)throw Error('Um ponto do gráfico não corresponde a um valor inteiro seguro.');return v;};
  const passo=dias>1?(raw.total[dias-1].x-raw.total[0].x)/(dias-1):0;
  if(dias>1&&passo<=0)throw Error('Ordem diária não reconhecida.');
  const out=raw.total.map((p,i)=>{if(Math.abs(p.x-raw.opt[i].x)>0.001||Math.abs(p.x-(raw.total[0].x+passo*i))>0.001)throw Error('Os pontos do gráfico não estão alinhados por dia.');return{data:new Date(a+i*86400000).toISOString().slice(0,10),contactos:valor(p),opt:valor(raw.opt[i])};});
  if(out.reduce((n,x)=>n+x.contactos,0)!==totalEsperado||out.reduce((n,x)=>n+x.opt,0)!==optEsperado)throw Error('A soma diária não coincide com os totais do Idealista. Espera o gráfico terminar de carregar e recolhe novamente.');
  return out;
}
function pontosContactosSVGIdealista(doc){
  const xy=e=>({x:Number(e.getAttribute('cx')),y:Number(e.getAttribute('cy'))});
  return{ticks:Array.from(doc.querySelectorAll('#contactsGraph .y.axis .tick')).map(e=>({valor:Number(e.textContent.replace(/\s/g,'').replace(',','.')),y:Number((/translate\([^,]+,\s*([\d.-]+)/.exec(e.getAttribute('transform')||'')||[])[1])})),total:Array.from(doc.querySelectorAll('#contactsGraph .chart-line.target-total .-circles-total circle')).map(xy),opt:Array.from(doc.querySelectorAll('#contactsGraph .chart-line.target-opt .-circles-opt circle')).map(xy)};
}
async function recolherDiariosIdealista(doc,d){
  const radioEmail=doc.querySelector('#HISTOEMAIL'),radioCall=doc.querySelector('#HISTOCALL'),total=doc.querySelector('#CONTACTS_TOTAL');
  if(!radioEmail||!radioCall||!total)throw Error('O gráfico de contactos não ficou disponível nesta página.');
  const original=radioCall.checked?radioCall:radioEmail,estado=total.checked,m=d.registos[0].metricas;
  const pausa=ms=>new Promise(r=>setTimeout(r,ms));
  async function ler(radio,esperado){
    radio.click();await pausa(1000);let prev='',repeticoes=0,ultimo;
    for(let i=0;i<18;i++){try{const raw=pontosContactosSVGIdealista(doc),sig=JSON.stringify(raw);repeticoes=sig===prev?repeticoes+1:0;prev=sig;if(repeticoes>=2&&radio.checked)return descodificarContactosSVGIdealista(raw,d.periodo.inicio,d.periodo.fim,m.contactos,esperado);}catch(e){ultimo=e;}await pausa(150);}
    throw ultimo||Error('O gráfico ainda está a atualizar. Recolhe novamente.');
  }
  try{if(!total.checked)total.click();const emails=await ler(radioEmail,m.mensagens),calls=await ler(radioCall,m.chamadas);const diarios=emails.map((x,i)=>{const c=calls[i];if(x.data!==c.data||x.contactos!==c.contactos||x.opt+c.opt!==x.contactos)throw Error('Os contactos diários não coincidem com mensagens e chamadas.');return{data:x.data,contactos:x.contactos,mensagens:x.opt,chamadas:c.opt};});d.diarios=diarios;}
  finally{if(!original.checked)original.click();if(total.checked!==estado)total.click();}
}

/* Leitor restrito CFB/BIFF8: apenas células de dados, nunca macros ou fórmulas. */
function lerXLSIdealista(buffer){
 const b=new Uint8Array(buffer),v=new DataView(b.buffer,b.byteOffset,b.byteLength),fail=()=>{throw Error('Formato Excel não reconhecido com segurança.');};
 if(b.length<512||b.length>4000000||v.getUint32(0,true)!==0xe011cfd0||v.getUint32(4,true)!==0xe11ab1a1||v.getUint16(30,true)!==9)fail();
 const sector=n=>{if(n<0||(n+2)*512>b.length)fail();return b.subarray((n+1)*512,(n+2)*512);},fat=[];
 if(v.getInt32(68,true)!==-2)fail();
 for(let i=0;i<109;i++){const n=v.getInt32(76+i*4,true);if(n>=0){const q=new DataView(sector(n).buffer,sector(n).byteOffset,512);for(let j=0;j<128;j++)fat.push(q.getInt32(j*4,true));}}
 const chain=(start,table,read,max)=>{let n=start,out=[],seen=new Set();while(n!==-2){if(n<0||seen.has(n)||seen.size>max)fail();seen.add(n);out.push(read(n));n=table[n];}return Uint8Array.from(out.flatMap(x=>Array.from(x)));};
 const dirs=chain(v.getInt32(48,true),fat,sector,100),dv=new DataView(dirs.buffer),entries=[];
 for(let i=0;i+128<=dirs.length;i+=128){let name='';for(let j=0;j<dv.getUint16(i+64,true)-2;j+=2)name+=String.fromCharCode(dv.getUint16(i+j,true));entries.push({name,type:dirs[i+66],start:dv.getInt32(i+116,true),size:dv.getUint32(i+120,true)});}
 const book=entries.find(e=>/^(Workbook|Book)$/.test(e.name)),root=entries.find(e=>e.type===5);if(!book||book.size>4000000)fail();let raw;
 if(book.size<4096){if(!root)fail();const mini=chain(root.start,fat,sector,8000),mf=chain(v.getInt32(60,true),fat,sector,100),mv=new DataView(mf.buffer),mt=[];for(let i=0;i<mf.length;i+=4)mt.push(mv.getInt32(i,true));raw=chain(book.start,mt,n=>mini.subarray(n*64,n*64+64),1000);}
 else raw=chain(book.start,fat,sector,8000);
 raw=raw.subarray(0,book.size);const r=new DataView(raw.buffer,raw.byteOffset,raw.length),strings=[],cells=[],sheets=[];let sheet=-1;
 const rk=x=>{let n;if(x&2)n=x>>2;else{const z=new DataView(new ArrayBuffer(8));z.setUint32(4,x&0xfffffffc,true);n=z.getFloat64(0,true);}return x&1?n/100:n;};
 for(let pos=0;pos+4<=raw.length;){const t=r.getUint16(pos,true),len=r.getUint16(pos+2,true),a=pos+4,end=a+len;if(end>raw.length)fail();
 if(t===0x2f||t===0x3c)fail();
 if(t===0x85)sheets.push(r.getUint32(a,true));
 if(sheets.includes(pos))sheet++;
 if(t===0xfc){let j=a+8;const count=r.getUint32(a+4,true);if(count>20000)fail();for(let k=0;k<count;k++){if(j+3>end)fail();const n=r.getUint16(j,true),f=raw[j+2];j+=3;let runs=0,ext=0;if(f&8){runs=r.getUint16(j,true);j+=2;}if(f&4){ext=r.getUint32(j,true);j+=4;}let s='';if(j+n*((f&1)?2:1)+runs*4+ext>end)fail();for(let c=0;c<n;c++)s+=String.fromCharCode(f&1?r.getUint16(j+c*2,true):raw[j+c]);j+=n*((f&1)?2:1)+runs*4+ext;strings.push(s);}}
 if(sheet===0){const row=len>=6?r.getUint16(a,true):0,col=len>=6?r.getUint16(a+2,true):0;const put=(c,x)=>{if(row>2000||c>30)fail();(cells[row]||(cells[row]=[]))[c]=x;};
 if(t===0xfd){const x=strings[r.getUint32(a+6,true)];if(x===undefined)fail();put(col,x);}else if(t===0x203)put(col,r.getFloat64(a+6,true));else if(t===0x27e)put(col,rk(r.getInt32(a+6,true)));else if(t===0xbd){const last=r.getUint16(end-2,true);for(let c=col;c<=last;c++)put(c,rk(r.getInt32(a+6+(c-col)*6,true)));}else if(t===6)throw Error('O Excel contém fórmulas; não foi importado.');}
 pos=end;
 }
 if(!cells.length)fail();return cells;
}
function converterRankingExcelIdealista(rows,d){
 const headers=['COD. IDEALISTA','REFERÊNCIA INTERNA','VISITAS NAS LISTAS','VISITAS EM DETALHES','COMPARTILHADO','ENVIOS EM ALERTAS','FAVORITOS','CONTACTOS'];
 if(!rows[0]||headers.some((h,i)=>String(rows[0][i]||'').trim()!==h)||rows[0].length!==8)throw Error('As colunas do Excel Idealista mudaram.');
 const ids=new Set(),records=rows.slice(1).filter(r=>r&&r.some(x=>x!==''&&x!=null)).map((r,i)=>{const id=String(r[0]||''),ref=String(r[1]||'');if(!/^\d+$/.test(id)||ids.has(id)||ref.length>100||r.length!==8||r.slice(2).some(x=>!Number.isSafeInteger(x)||x<0))throw Error('Linha inválida ou repetida no Excel.');ids.add(id);return{id,ref,posicao:i+1,metricas:{visitasListas:r[2],visitasDetalhes:r[3],partilhas:r[4],alertas:r[5],favoritos:r[6],contactos:r[7]}};});
 if(!records.length||records.length>1000||!d.periodo.inicio||!d.periodo.fim)throw Error('Excel sem dados ou período confirmado.');
 for(const visible of d.registos){const x=records.find(r=>r.id===visible.id),m=visible.metricas;if(!x||['visitasListas','visitasDetalhes','partilhas','alertas','favoritos'].some(k=>m[k]!==x.metricas[k])||m.chamadas+m.mensagens!==x.metricas.contactos)throw Error('O Excel não coincide com o ranking aberto. Volta a recolher.');Object.assign(x.metricas,{chamadas:m.chamadas,mensagens:m.mensagens});}
 return Object.assign({},d,{registos:records,cobertura:'Ranking completo exportado para Excel: '+records.length+' imóveis; inclui todas as páginas. Contactos agregados; chamadas e mensagens apenas nas linhas conferidas na página.',fonte:'Excel oficial Idealista'});
}
async function recolherExcelIdealista(doc,d,ui){
 const link=Array.from(doc.querySelectorAll('a')).find(a=>/Exportar para Excel/i.test(a.textContent)&&a.getClientRects().length),form=link&&link.closest('form');if(!form)return d;
 ui.estado('A obter o Excel oficial do ranking completo…');
 const original=form.submit,own=Object.prototype.hasOwnProperty.call(form,'submit');let target;
 const capture=()=>{const url=new URL(form.getAttribute('action'),d.url);if(url.origin!==new URL(d.url).origin||!url.pathname.endsWith('/getXlsAdsRanking')||String(form.method).toLowerCase()!=='get')throw Error('Exportação Idealista não reconhecida.');for(const e of form.querySelectorAll('input[name]'))if(!e.disabled)url.searchParams.append(e.name,e.value);target=url;};
 try{form.submit=capture;link.click();}finally{if(own)form.submit=original;else delete form.submit;}
 if(!target)throw Error('Não consegui iniciar a exportação Excel. Não usei uma leitura parcial.');
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);try{const response=await fetch(target.href,{credentials:'same-origin',cache:'no-store',signal:controller.signal});if(!response.ok||new URL(response.url).origin!==target.origin)throw Error('A exportação Excel falhou. Confirma a sessão no Idealista.');const out=converterRankingExcelIdealista(lerXLSIdealista(await response.arrayBuffer()),d);const after=recolherIdealista(doc,{url:d.url,lido:d.lido});if(JSON.stringify(after)!==JSON.stringify(d))throw Error('O período ou ranking mudou durante a exportação.');return out;}finally{clearTimeout(timer);}
}

/* Carteira atual: lista oficial de publicação, nunca o ranking do período. */
function lerPaginaAtivosIdealista(doc){
 const text=doc.body.textContent.replace(/\s+/g,' '),total=/(\d+)\s*\/\s*(?:\d+|ilimitado)\s*em idealista\b/i.exec(text);
 if(!total)throw Error('O total da carteira ativa não ficou identificado.');
 const records=Array.from(doc.querySelectorAll('ul.row')).filter(r=>r.querySelector('a[href*="/tools/propiedad/"]')).map(r=>{const a=r.querySelector('a[href*="/tools/propiedad/"]'),m=/\/tools\/propiedad\/(\d+)\//.exec(a.getAttribute('href')||''),ref=r.querySelector('[title^="Ref."]');if(!m||!ref)throw Error('Uma referência da carteira não ficou identificada.');const value=ref.getAttribute('title').replace(/^Ref\.\s*/,'').trim();if(!value||value.length>100)throw Error('Referência inválida na carteira.');return{id:m[1],ref:value};});
 return{total:Number(total[1]),registos:records};
}
function juntarPaginasAtivosIdealista(pages,expected){
 if(!Number.isInteger(expected)||expected<0||expected>1000||!pages.length||pages.some(p=>p.total!==expected))throw Error('O total dos anúncios ativos mudou durante a leitura.');
 const ids=new Set(),records=[];for(const p of pages)for(const r of p.registos){if(ids.has(r.id))throw Error('Uma página repetiu anúncios. Não confirmei a carteira.');ids.add(r.id);records.push(r);}
 if(records.length!==expected)throw Error('A carteira ficou incompleta: '+records.length+' de '+expected+' anúncios.');
 return records.sort((a,b)=>a.id.localeCompare(b.id));
}
async function recolherAtivosIdealista(doc,d,ui){
 const link=Array.from(doc.querySelectorAll('a[href]')).find(a=>/\d+\s+anúncios ativos hoje/.test(a.textContent));if(!link)throw Error('A ligação para os anúncios ativos não está disponível.');
 const url=new URL(link.getAttribute('href'),d.url),origin=new URL(d.url).origin,expected=d.registos[0].metricas.anunciosAtivosHoje;
 if(url.origin!==origin||url.pathname!=='/tools/publicacion/idealista'||url.searchParams.get('ScopeId')!=='1')throw Error('A ligação da carteira não foi reconhecida.');
 const initial=recolherIdealista(doc,{url:d.url,lido:d.lido});if(JSON.stringify([initial.periodo,initial.filtros,initial.registos])!==JSON.stringify([d.periodo,d.filtros,d.registos]))throw Error('As estatísticas mudaram antes da leitura da carteira.');const start=JSON.stringify(initial);
 const rendered=async(u)=>{const frame=doc.createElement('iframe');frame.setAttribute('aria-hidden','true');frame.tabIndex=-1;frame.style.cssText='position:fixed;left:-10000px;top:0;width:1200px;height:800px;pointer-events:none;';frame.src=u.href;doc.body.appendChild(frame);try{let previous='',stable=0;for(let i=0;i<100;i++){await new Promise(r=>setTimeout(r,120));try{const location=new URL(frame.contentWindow.location.href);if(location.origin!==origin||location.pathname!==url.pathname)continue;const data=lerPaginaAtivosIdealista(frame.contentDocument),sig=JSON.stringify(data);stable=sig===previous?stable+1:0;previous=sig;if((data.registos.length||data.total===0)&&stable>=5)return data;}catch(e){}}throw Error('A lista de ativos não terminou de carregar.');}finally{frame.remove();}};
 const load=async(page)=>{const u=new URL(url);u.searchParams.set('CurrentPage',page);u.searchParams.set('OrderBy','activeAds');u.searchParams.set('OrderedType','desc');const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),12000);try{const res=await fetch(u.href,{credentials:'same-origin',cache:'no-store',signal:controller.signal});if(!res.ok||new URL(res.url).origin!==origin||new URL(res.url).pathname!==url.pathname)throw Error('A sessão ou a lista dos anúncios ativos não está disponível.');const parsed=new DOMParser().parseFromString(await res.text(),'text/html');let result;try{result=lerPaginaAtivosIdealista(parsed);}catch(e){return await rendered(u);}return !result.registos.length&&expected?await rendered(u):result;}finally{clearTimeout(timer);}};
 ui.estado('A recolher a carteira ativa: página 1…');const first=await load(1),pages=[first],size=first.registos.length;
 if(first.total!==expected||(!size&&expected))throw Error('A lista de ativos não coincide com o total das estatísticas.');
 const count=expected?Math.ceil(expected/size):1;if(count>50)throw Error('Demasiadas páginas para conferir a carteira.');
 for(let page=2;page<=count;page++){ui.estado('Carteira ativa: página '+page+' de '+count+'…');pages.push(await load(page));}
 const records=juntarPaginasAtivosIdealista(pages,expected),check=await load(1);
 if(JSON.stringify(check)!==JSON.stringify(first)||start!==JSON.stringify(recolherIdealista(doc,{url:d.url,lido:d.lido})))throw Error('A carteira ou os filtros mudaram durante a leitura.');
 return{total:expected,url:url.href,paginas:count,registos:records};
}

/* Usa os separadores oficiais e repõe o gráfico; não inventa ligações de exportação. */
async function recolherConjuntoIdealista(doc,geral,ui){
 const blocos=[],faltas=[],contexto={url:geral.url,lido:geral.lido},base=JSON.stringify(geral);
 const pausa=ms=>new Promise(r=>setTimeout(r,ms));
 const tab=nome=>Array.from(doc.querySelectorAll('a[data-typology]')).find(a=>a.getAttribute('data-typology')===nome);
 async function esperar(tipo){let anterior='',iguais=0,erro;for(let i=0;i<45;i++){try{const d=recolherIdealista(doc,contexto),sig=JSON.stringify(d);iguais=sig===anterior?iguais+1:0;anterior=sig;if(d.tipo===tipo&&iguais>=2)return d;}catch(e){erro=e;}await pausa(200);}throw erro||Error('O separador do Idealista não terminou de carregar.');}
 ui.estado('1 de 2 · Estatísticas, contactos diários e carteira ativa…');
 try{await recolherDiariosIdealista(doc,geral);}catch(e){geral.avisoSerie=String(e.message||e);}
 try{geral.carteiraAtiva=await recolherAtivosIdealista(doc,geral,ui);}catch(e){geral.avisoCarteira=String(e.message||e);}
 geral.marcadorVersao='20261028.2';blocos.push({nome:'estatisticas',texto:'CLARA2:'+JSON.stringify(geral)});
 let restaurado=false;
 try{
  const ranking=tab('ranking'),grafico=tab('graph');if(!ranking||!grafico)throw Error('Não encontrei os separadores oficiais do gráfico e ranking.');
  ui.estado('2 de 2 · A abrir o ranking e obter o Excel oficial…');ranking.click();const d=await esperar('ranking');
  if(d.periodo.inicio!==geral.periodo.inicio||d.periodo.fim!==geral.periodo.fim)throw Error('O ranking apresenta um período diferente das estatísticas.');
  const excel=await recolherExcelIdealista(doc,d,ui);if(excel.fonte!=='Excel oficial Idealista')throw Error('O Excel oficial não ficou disponível. O ranking parcial não foi usado.');
  excel.marcadorVersao='20261028.2';blocos.push({nome:'ranking',texto:'CLARA2:'+JSON.stringify(excel)});
 }catch(e){faltas.push({nome:'ranking',erro:String(e.message||e).slice(0,600)});}
 finally{const grafico=tab('graph');if(grafico){grafico.click();try{const depois=await esperar('geral');restaurado=JSON.stringify(depois)===base;}catch(e){restaurado=false;}}}
 if(!restaurado)throw Error('Não consegui confirmar o gráfico e os filtros iniciais no fim da recolha. Volta ao Gráfico e recolhe novamente.');
 return{v:6,origem:'idealista',tipo:'conjunta',marcadorVersao:'20261028.2',lido:geral.lido,blocos,faltas};
}
