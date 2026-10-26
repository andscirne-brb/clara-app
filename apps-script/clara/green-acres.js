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
