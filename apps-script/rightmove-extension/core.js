/* Sem dados pessoais de leads; apenas os resultados agregados dos coletores. */
function fichaUrlPermitido(url){return /^https:\/\/(?:www\.)?janela-imobiliaria\.com\/[^?#]+\/\d+\/?(?:\?[^#]*)?(?:#.*)?$/.test(url||'');}
function resumoFichaClara(d){
 if(!d||d.v!==1||d.origem!=='site'||!fichaUrlPermitido(d.url)||!/^\w{2,5}\d+$/.test(d.ref||''))throw Error('A leitura não corresponde a uma ficha identificada.');
 const confirmados=[],porVerificar=[];
 const numero=(campo,n)=>{if(Number.isInteger(n)&&n>=0)confirmados.push(campo+': '+n);else porVerificar.push(campo);};
 numero('Fotos',d.fotos);
 if((!d.parcial||d.fotosComAltCompletos===true)&&Number.isInteger(d.fotosComAlt)&&Number.isInteger(d.fotos)&&d.fotos>0&&d.fotosComAlt>=0&&d.fotosComAlt<=d.fotos)confirmados.push('Alt texts: '+d.fotosComAlt+' de '+d.fotos);else porVerificar.push('Alt texts');
 for(const idioma of ['PT','EN','FR','DE','ES']){const t=d.textos?.[idioma];if(t&&!t.erro&&typeof t.descricao==='string')confirmados.push('Descrição '+idioma+': '+(t.descricao.trim()?'lida':'vazia'));else porVerificar.push('Descrição '+idioma);}
 if((!d.parcial||d.nomesCaracteristicasCompletos===true)&&Number.isInteger(d.caracteristicas)&&d.caracteristicas>=0)confirmados.push('Características: '+d.caracteristicas);else porVerificar.push('Características');
 numero('Vídeos',d.videos);if(Array.isArray(d.plantas))confirmados.push('Plantas: '+d.plantas.length);else porVerificar.push('Plantas');numero('Folhetos',d.folhetos);
 porVerificar.push('Documentos: confirmar manualmente no Sheets');
 return{ref:d.ref,confirmados,porVerificar};
}
const RM_RELATORIOS={leads:'https://rmplusportal.rightmove.co.uk/customer-reports/lead-reports/summary',performance:'https://admin.rightmove.co.uk/manage/branch/overseas/reports/property-performance-report'};
function rmUrlPermitido(url,tipo){return url===RM_RELATORIOS[tipo]||url===RM_RELATORIOS[tipo]+'/';}
function rmJuntar(resultados){const blocos=[],faltas=[];resultados.forEach((r,i)=>{const nome=['leads','performance'][i];if(r.status==='fulfilled'){const d=r.value;if(!d||d.origem!=='rightmove'||d.v!==3||!rmUrlPermitido(d.url,nome)||(nome==='leads'?d.tipo!=='leads':!['performance_csv','performance'].includes(d.tipo)))throw Error('O resultado não corresponde ao relatório previsto.');blocos.push({nome,texto:'CLARA3:'+JSON.stringify(d)});}else faltas.push({nome,erro:String(r.reason?.message||r.reason||'Relatório indisponível').slice(0,600)});});if(!blocos.length)throw Error('Nenhum relatório foi recolhido. Confirma a sessão nos dois separadores.');return{v:6,origem:'rightmove',tipo:'conjunta',marcadorVersao:'20261028.2',lido:new Date().toISOString(),blocos,faltas};}

function portalUrlPermitido(url,tipo){
 try{const u=new URL(url);if(u.protocol!=='https:'||u.username||u.password)return false;
 if(tipo==='idealista')return ['www.idealista.pt','idealista.pt'].includes(u.hostname)&&u.pathname==='/webtool/stats/loadImpactStats';
 if(tipo==='green-acres')return u.hostname==='back.green-acres.com'&&/^\/pt\/Agent(?:\/Advert\/List)?\/?$/.test(u.pathname);
 return false;}catch(e){return false;}
}
function validarPortalClara(d,tipo){
 if(!d||d.origem!==tipo)throw Error('O resultado não corresponde ao portal escolhido.');
 const prefixo=d.v===6?'CLARA6:':tipo==='idealista'&&d.v===2?'CLARA2:':tipo==='green-acres'&&d.v===4?'CLARA4:':null;
 if(!prefixo)throw Error('Formato de recolha inesperado.');
 if(d.v===6){if(d.tipo!=='conjunta'||!Array.isArray(d.blocos)||!d.blocos.length||!Array.isArray(d.faltas))throw Error('Recolha conjunta incompleta.');
 for(const b of d.blocos){const p=tipo==='idealista'?'CLARA2:':'CLARA4:';if(typeof b.texto!=='string'||!b.texto.startsWith(p))throw Error('Bloco de outro portal.');const x=JSON.parse(b.texto.slice(7));if(x.origem!==tipo||!portalUrlPermitido(x.url,tipo))throw Error('Fonte de bloco inesperada.');}}
 else if(!portalUrlPermitido(d.url,tipo))throw Error('Fonte do relatório inesperada.');
 return prefixo;
}
