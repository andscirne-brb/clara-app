function validarContactosDiariosIdealista_(d){
 if(d.diarios===undefined)return;
 if(d.tipo!=='geral'||!Array.isArray(d.diarios)||!d.diarios.length||d.diarios.length>3660)throw Error('Série diária inválida.');
 const primeiro=Date.parse(d.periodo.inicio+'T00:00:00Z'),ultimo=Date.parse(d.periodo.fim+'T00:00:00Z'),n=Math.round((ultimo-primeiro)/86400000)+1;
 if(d.diarios.length!==n)throw Error('A série diária não cobre o período completo.');
 const somas={contactos:0,mensagens:0,chamadas:0},m=d.registos[0].metricas;
 d.diarios.forEach(function(r,i){const data=new Date(primeiro+i*86400000).toISOString().slice(0,10);if(r.data!==data)throw Error('Dias repetidos, em falta ou fora de ordem.');Object.keys(somas).forEach(function(k){if(!Number.isSafeInteger(r[k])||r[k]<0)throw Error('Valor diário inválido.');somas[k]+=r[k];});if(r.mensagens+r.chamadas!==r.contactos)throw Error('Mensagens e chamadas não coincidem com os contactos do dia.');});
 Object.keys(somas).forEach(function(k){if(somas[k]!==m[k])throw Error('A soma diária não coincide com o total de '+k+'.');});
}
function dadosGraficoContactosIdealista_(linhas,tz){
 const fmt=function(v){return v instanceof Date?Utilities.formatDate(v,tz,'yyyy-MM-dd'):String(v);},lotes={};
 linhas.forEach(function(r,i){if(r[1]!=='contactos_diarios'||!r[10])return;const id=String(r[10]),b=lotes[id]||(lotes[id]={ultima:i,inicio:fmt(r[2]),fim:fmt(r[3]),filtros:String(r[4]),dias:{}});b.ultima=i;const data=fmt(r[6]);b.dias[data]=b.dias[data]||{data:data};if(['contactos','mensagens','chamadas'].indexOf(r[7])>=0)b.dias[data][r[7]]=r[8];});
 const ordenados=Object.values(lotes).sort(function(a,b){return b.ultima-a.ultima;});
 for(let i=0;i<ordenados.length;i++){const b=ordenados[i];b.diarios=Object.values(b.dias).sort(function(a,b){return a.data.localeCompare(b.data);});const metricas={};b.diarios.forEach(function(r){['contactos','mensagens','chamadas'].forEach(function(k){metricas[k]=(metricas[k]||0)+r[k];});});try{validarContactosDiariosIdealista_({tipo:'geral',periodo:{inicio:b.inicio,fim:b.fim},registos:[{metricas:metricas}],diarios:b.diarios});return b;}catch(e){}}
 return null;
}
function atualizarGraficoContactosIdealista_(ss){
 const fonte=ss.getSheetByName('Idealista - recolhas'),dash=ss.getSheetByName('Dashboard');if(!fonte||!dash||fonte.getLastRow()<2)return;
 const d=dadosGraficoContactosIdealista_(fonte.getRange(2,1,fonte.getLastRow()-1,13).getValues(),ss.getSpreadsheetTimeZone());if(!d)return;
 const titulo='Idealista: contactos diários',charts=dash.getCharts().filter(function(c){return String(c.getOptions().get('title')||'').indexOf(titulo)===0;});if(charts.length>1)throw Error('Há gráficos de contactos Idealista repetidos.');
 const headers=['Data','Contactos','Emails e mensagens','Chamadas'];let view=ss.getSheetByName('Clara - contactos Idealista');if(!view){view=ss.insertSheet('Clara - contactos Idealista');view.getRange(1,1,1,4).setValues([headers]);view.hideSheet();}
 if(view.getRange(1,1,1,4).getDisplayValues()[0].join('|')!==headers.join('|'))throw Error('A estrutura da vista diária mudou.');
 const linhas=[headers].concat(d.diarios.map(function(r){return[Utilities.parseDate(r.data,ss.getSpreadsheetTimeZone(),'yyyy-MM-dd'),r.contactos,r.mensagens,r.chamadas];}));
 if(view.getMaxRows()<linhas.length)view.insertRowsAfter(view.getMaxRows(),linhas.length-view.getMaxRows());
 view.getRange(1,1,Math.max(view.getLastRow(),linhas.length),4).clearContent();view.getRange(1,1,linhas.length,4).setValues(linhas);view.getRange(2,1,d.diarios.length,1).setNumberFormat('yyyy-mm-dd');
 const nome=titulo+' · '+d.inicio+' a '+d.fim;let builder=charts.length?charts[0].modify().clearRanges():dash.newChart();
 builder=builder.setChartType(Charts.ChartType.COMBO).addRange(view.getRange(1,1,linhas.length,4)).setNumHeaders(1).setHiddenDimensionStrategy(Charts.ChartHiddenDimensionStrategy.SHOW_BOTH).setPosition(124,1,0,0).setOption('title',nome).setOption('width',980).setOption('height',430).setOption('legend',{position:'bottom'}).setOption('seriesType','bars').setOption('series',{0:{type:'line',color:'#ff598d',lineWidth:2},1:{type:'bars',color:'#98ae00'},2:{type:'bars',color:'#a773ff'}}).setOption('hAxis',{title:'Dia',format:'dd/MM'}).setOption('vAxis',{title:'Contactos',minValue:0,format:'0'}).setOption('focusTarget','category');
 if(charts.length)dash.updateChart(builder.build());else dash.insertChart(builder.build());SpreadsheetApp.flush();return{dias:d.diarios.length,inicio:d.inicio,fim:d.fim};
}
