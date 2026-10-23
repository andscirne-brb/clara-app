/** Dashboard de consulta: resultados primeiro; origens e histórico preservados. */
function periodo30Dashboard_(linhas,tz){
 const lotes={};const iso=v=>v instanceof Date?Utilities.formatDate(v,tz,'yyyy-MM-dd'):String(v);
 linhas.forEach((r,i)=>{if(r[1]!=='geral'||!r[10])return;const id=String(r[10]),b=lotes[id]||(lotes[id]={inicio:iso(r[2]),fim:iso(r[3]),filtros:String(r[4]),recolha:iso(r[0]),ultima:i,metricas:{}});b.ultima=i;if(typeof r[8]==='number')b.metricas[r[7]]=r[8];});
 return Object.values(lotes).filter(b=>Math.round((Date.parse(b.fim)-Date.parse(b.inicio))/86400000)+1===30).sort((a,b)=>b.fim.localeCompare(a.fim)||b.ultima-a.ultima)[0]||null;
}
function atualizarDashboardVisual(){const lock=LockService.getDocumentLock();if(!lock.tryLock(1000))return;try{const r=atualizarDashboardVisual_(SpreadsheetApp.getActive());console.log(JSON.stringify(r));return r;}finally{lock.releaseLock();}}
function prepararDashboardVisual(){
 const ss=SpreadsheetApp.getActive(),s=ss.getSheetByName('Dashboard');if(!s)throw Error('Dashboard não encontrado.');
 if(s.getRange('A2').getValue()!=='Resultados dos portais'){
 const stamp=Utilities.formatDate(new Date(),ss.getSpreadsheetTimeZone(),'yyyyMMdd-HHmmss'),b=s.copyTo(ss);b.setName('Dashboard antes '+stamp);b.hideSheet();
 s.getCharts().forEach(c=>s.removeChart(c));s.getRange(1,1,s.getMaxRows(),s.getMaxColumns()).breakApart();s.clear();s.clearConditionalFormatRules();
 }
 return atualizarDashboardVisual_(ss);
}
function atualizarDashboardVisual_(ss){
 const s=ss.getSheetByName('Dashboard');if(!s)return;
 prepararEspacoProgressao_(ss,s);
 const tz=ss.getSpreadsheetTimeZone(),rows=(name,start,width)=>{const sh=ss.getSheetByName(name);return sh&&sh.getLastRow()>=start?sh.getRange(start,1,sh.getLastRow()-start+1,Math.min(width,sh.getLastColumn())).getValues():[];};
 const raw=rows('Idealista - recolhas',2,13),p=periodo30Dashboard_(raw,tz),allDaily=dadosGraficoContactosIdealista_(raw,tz);
 const green=rows('Leads por período',6,10).filter(r=>String(r[3]).toLowerCase()==='green-acres'&&typeof r[4]==='number');
 const iso=v=>v instanceof Date?Utilities.formatDate(v,tz,'yyyy-MM-dd'):String(v||'');green.sort((a,b)=>iso(a[1]).localeCompare(iso(b[1])));
 const lastGreen=green.length?green[green.length-1]:null,rm=rows('Rightmove - anúncios',6,22).filter(r=>r[2]),activeRM=rm.filter(r=>String(r[7]).match(/Disponível|Available/i)),views=rm.filter(r=>typeof r[17]==='number').map(r=>r[17]);
 const bg='#f3f6fa',ink='#183746',muted='#607786',teal='#087f8c',blue='#239bc1',purple='#8170bc';
 s.getRange('A1:L88').setBackground(bg).setFontFamily('Arial').setFontSize(10).setFontColor(ink).setVerticalAlignment('middle').setNumberFormat('General');s.setHiddenGridlines(true);s.setFrozenRows(0);s.setFrozenColumns(0);s.setColumnWidths(1,12,92);s.setRowHeights(1,88,22);s.setRowHeight(1,12);
 function block(row,col,n,height,text,size,color,bold,back){const r=s.getRange(row,col,height,n);r.breakApart();r.merge();r.setValue(text===null?'—':text).setBackground(back||bg).setFontSize(size||10).setFontColor(color||ink).setFontWeight(bold?'bold':'normal').setWrap(true).setHorizontalAlignment('left');return r;}
 function section(row,title){block(row,1,12,1,title,13,ink,true);s.setRowHeight(row,32);}
 function card(col,name,value,label,period,detail,footer,color){block(6,col,4,1,name,12,color,true,'#ffffff');block(7,col,4,2,value,32,ink,true,'#ffffff');block(9,col,4,1,label,11,muted,false,'#ffffff');block(10,col,4,2,period,10,muted,false,'#ffffff');block(12,col,4,2,detail,11,ink,true,'#ffffff');block(14,col,4,2,footer,9,muted,false,'#ffffff');}
 block(2,1,12,2,'Resultados dos portais',23,ink,true);block(4,1,12,1,'Últimos 30 dias disponíveis · períodos identificados em cada portal',11,muted);
 const fmt=v=>typeof v==='number'?v.toLocaleString('pt-PT'):'Não recolhido';
 card(1,'IDEALISTA',p?fmt(p.metricas.contactos):'Sem dados','contactos recebidos',p?p.inicio+' a '+p.fim+'\n'+(()=>{try{return JSON.parse(p.filtros).join(' · ');}catch(e){return p.filtros;}})():'Falta recolha de 30 dias',p?fmt(p.metricas.visitasDetalhes)+' visitas aos anúncios\n'+fmt(p.metricas.anunciosAtivosHoje)+' anúncios ativos na recolha':'Registar estatísticas no menu Clara',p?'Recolha: '+p.recolha+' · '+fmt(p.metricas.mensagens)+' mensagens / '+fmt(p.metricas.chamadas)+' chamadas':'',teal);
 card(5,'GREEN-ACRES',lastGreen?fmt(lastGreen[4]):'Sem dados','contactos únicos · último dado disponível',lastGreen?iso(lastGreen[0])+' a '+iso(lastGreen[1]):'Sem recolha',lastGreen?'Sem janela de 30 dias recolhida':'Falta relatório de contactos','O gráfico mensal mantém o histórico. Período distinto do Idealista.',blue);
 card(9,'RIGHTMOVE',rm.length?activeRM.length:'Sem dados','anúncios disponíveis',rm.length?'Relatório: '+iso(rm[0][0]):'Sem relatório',views.length?(views.reduce((a,b)=>a+b,0)/views.length).toFixed(2).replace('.',',')+' visitas / dia por anúncio\nMédia do relatório de 30 dias':'Desempenho por recolher','Contactos não incluídos no CSV. Datas exatas da janela não indicadas.',purple);
 [['A6','IDEALISTA','Idealista - recolhas'],['E6','GREEN-ACRES','Leads por período'],['I6','RIGHTMOVE','Rightmove - anúncios']].forEach(a=>{const t=ss.getSheetByName(a[2]);if(t)s.getRange(a[0]).setRichTextValue(SpreadsheetApp.newRichTextValue().setText(a[1]).setLinkUrl(ss.getUrl()+'#gid='+t.getSheetId()).build());});
 section(17,'Evolução dos contactos');
 let v=ss.getSheetByName('Clara - dashboard');if(!v){v=ss.insertSheet('Clara - dashboard');v.hideSheet();}v.clearContents();
 const daily=allDaily&&p?allDaily.diarios.filter(r=>r.data>=p.inicio&&r.data<=p.fim):[];
 const dailyOk=p&&daily.length===30&&daily.reduce((a,b)=>a+b.contactos,0)===p.metricas.contactos;
 v.getRange('A1:D1').setValues([['Dia','Contactos','Emails e mensagens','Chamadas']]);if(dailyOk)v.getRange(2,1,daily.length,4).setValues(daily.map(r=>[Utilities.parseDate(r.data,tz,'yyyy-MM-dd'),r.contactos,r.mensagens,r.chamadas]));v.getRange('A2:A32').setNumberFormat('dd/MM');
 v.getRange('F1:G1').setValues([['Mês','Contactos únicos']]);if(green.length)v.getRange(2,6,green.length,2).setValues(green.map(r=>[iso(r[0]).slice(0,7)+(/parcial/i.test(String(r[9]))?' *':''),r[4]]));
 SpreadsheetApp.flush();
 function chart(title,range,row,col,type,opts){const own=s.getCharts().filter(c=>String(c.getOptions().get('title')||'')===title);if(own.length>1)throw Error('Gráfico repetido: '+title);let b=s.newChart();b=b.setChartType(type).addRange(range).setNumHeaders(1).setHiddenDimensionStrategy(Charts.ChartHiddenDimensionStrategy.SHOW_BOTH).setPosition(row,col,0,0).setOption('title',title).setOption('width',548).setOption('height',280).setOption('fontName','Arial').setOption('backgroundColor','#ffffff').setOption('titleTextStyle',{fontSize:12,color:ink,bold:true}).setOption('legend',{position:'bottom',textStyle:{fontSize:9}});Object.keys(opts||{}).forEach(k=>b.setOption(k,opts[k]));s.insertChart(b.build());if(own.length)s.removeChart(own[0]);}
 block(19,1,6,12,dailyOk?'':'Falta uma série diária completa para estes 30 dias.',11,muted,false,'#ffffff');block(19,7,6,12,green.length?'':'Falta histórico de contactos.',11,muted,false,'#ffffff');
 if(dailyOk)chart('Idealista · contactos nos 30 dias',v.getRange(1,1,31,4),19,1,Charts.ChartType.COMBO,{seriesType:'bars',series:{0:{type:'line',color:teal,lineWidth:2},1:{color:'#87cbd9'},2:{color:purple}},hAxis:{format:'dd/MM',showTextEvery:5},vAxis:{minValue:0,format:'0'}});
 if(green.length)chart('Green-Acres · contactos únicos por mês',v.getRange(1,6,green.length+1,2),19,7,Charts.ChartType.COLUMN,{colors:[blue],legend:{position:'none'},hAxis:{slantedText:true,slantedTextAngle:45},vAxis:{minValue:0,format:'0'}});
 block(32,1,12,1,'As contagens dos portais têm critérios próprios. * Mês parcial no Green-Acres.',9,muted);
 section(34,'Rightmove e eGO · evolução registada');
 const lc=colunas_(ss.getSheetByName(LEV.nome),LEV.titulos),prior=rows(LEV.nome,10,lc.titulos.length).filter(r=>r[lc.col('Prioridade')-1]==='Prioritária').map(r=>String(r[lc.col('Referência EGO')-1]));
 const ego=serieCompletudeEGO_(rows('Histórico de indicadores',6,11),prior,tz),rmHist=guardarMedicaoRightmove_(ss,rm,tz),right=serieRightmove_(rmHist,rm.map(r=>r[2]),tz);
 v.getRange('J1:K1').setValues([['Data do relatório','Média diária de visitas / anúncio']]);if(right.length)v.getRange(2,10,right.length,2).setValues(right.map(r=>[r.data,r.media]));v.getRange('M1:N1').setValues([['Data da medição','Completude média']]);if(ego.length)v.getRange(2,13,ego.length,2).setValues(ego.map(r=>[r.data,r.media]));v.getRange('N2:N1000').setNumberFormat('0.0%');SpreadsheetApp.flush();
 block(36,1,6,12,right.length?'':'Falta uma medição de desempenho Rightmove.',11,muted,false,'#ffffff');block(36,7,6,12,ego.length?'':'Falta uma medição completa dos imóveis prioritários.',11,muted,false,'#ffffff');
 if(right.length)chart('Rightmove · visitas diárias por anúncio (30 dias)',v.getRange(1,10,right.length+1,2),36,1,Charts.ChartType.LINE,{colors:[purple],pointSize:8,lineWidth:2,legend:{position:'none'},vAxis:{minValue:0,maxValue:Math.max(1,Math.ceil(Math.max.apply(null,right.map(r=>r.media))*1.15)),format:'0.00'}});
 if(ego.length)chart('eGO · completude média dos prioritários',v.getRange(1,13,ego.length+1,2),36,7,Charts.ChartType.LINE,{colors:[teal],pointSize:8,lineWidth:2,legend:{position:'none'},vAxis:{minValue:0,maxValue:1,format:'0%'}});
 block(49,1,6,2,right.length?(right.length===1?'Primeira medição · ':'Última medição · ')+right[right.length-1].media.toFixed(2).replace('.',',')+' visitas/dia/anúncio · '+right[right.length-1].anuncios+' anúncios.\n'+(right.length===1?'Falta novo relatório para avaliar a evolução.':'Comparação entre o mesmo grupo em todas as datas.'):'Sem série comparável.',9,muted);
 block(49,7,6,2,ego.length?(ego.length===1?'Primeira medição · ':'Última medição · ')+(100*ego[ego.length-1].media).toFixed(1).replace('.',',')+'% de completude · '+ego[ego.length-1].imoveis+' imóveis.\nCompletude não confirma qualidade.':'Falta nova medição completa do mesmo grupo.',9,muted);
 section(53,'Progresso do trabalho');
 const f=formulasProgressoDashboard_(ss);
 const indicators=[['Prioritários verificados',f.verificados,teal],['Correções concluídas',f.concluidas,teal],['Pendências abertas',f.abertas,'#bb7543'],['A aguardar Sara',f.sara,purple]];
 indicators.forEach((a,i)=>{const col=i*3+1;block(55,col,3,1,a[0],10,muted,false,'#ffffff');block(56,col,3,2,'',28,a[2],true,'#ffffff').setFormula(a[1]).setNumberFormat('0');block(58,col,3,1,i===0?'de '+prior.length+' imóveis prioritários':'',9,muted,false,'#ffffff');});
 section(61,'Prioridades e pendências da equipa');
 block(63,1,6,2,'Pendências operacionais',12,ink,true,'#ffffff');block(65,1,6,2,'',26,teal,true,'#ffffff').setFormula(f.andreia).setNumberFormat('0');block(67,1,6,2,'Assuntos atribuídos à Andreia. Consultar a lista para saber o que falta fazer.',10,muted,false,'#ffffff');
 block(63,7,6,2,'Imóveis com pendências',12,ink,true,'#ffffff');block(65,7,6,2,'',26,purple,true,'#ffffff').setFormula(f.imoveis).setNumberFormat('0');block(67,7,6,2,'A conclusão de uma recolha não significa que todas as correções estejam concluídas.',10,muted,false,'#ffffff');
 section(71,'Consultar o detalhe');
 [['Levantamento','eGO · estado dos imóveis',1],['Pendências da equipa','Equipa · tarefas e bloqueios',5],['Perfis dos portais','Portais · perfis e pendências',9]].forEach(a=>{const target=ss.getSheetByName(a[0]);if(target)block(73,a[2],4,2,'',11,teal,true,'#e6f0f2').setRichTextValue(SpreadsheetApp.newRichTextValue().setText(a[1]).setLinkUrl(ss.getUrl()+'#gid='+target.getSheetId()).build());});
 block(77,1,12,2,'Últimos 30 dias disponíveis por fonte. Sem dados = não recolhido, não zero. Uma medição isolada é o ponto inicial; não prova melhoria.',10,muted);
 block(80,1,12,1,'Dashboard atualizado em '+Utilities.formatDate(new Date(),tz,'yyyy-MM-dd HH:mm')+' · fontes e histórico preservados nas abas de detalhe.',9,muted);
 s.setTabColor(teal);if(!v.isSheetHidden())v.hideSheet();SpreadsheetApp.flush();return{periodo:p?{inicio:p.inicio,fim:p.fim}:null,diarios:dailyOk?30:0,rightmove:rm.length,mediaRightmove:views.length?views.reduce((a,b)=>a+b,0)/views.length:null,graficos:s.getCharts().length,pontosRightmove:right.length,pontosEGO:ego.length};
}


function verificarDashboardVisual(){const ss=SpreadsheetApp.getActive(),s=ss.getSheetByName('Dashboard'),v=ss.getSheetByName('Clara - dashboard');console.log(JSON.stringify({cartoes:s.getRange('A55:L58').getDisplayValues(),fontes:v.getRange('A1:G4').getDisplayValues(),progressao:v.getRange('J1:N3').getDisplayValues(),historicoRightmove:Math.max(0,ss.getSheetByName('Rightmove - histórico').getLastRow()-1),graficos:s.getCharts().map(c=>({titulo:c.getOptions().get('title'),ranges:c.getRanges().map(r=>r.getSheet().getName()+'!'+r.getA1Notation())})),erros:s.getRange('A1:L80').getDisplayValues().flat().filter(x=>/^#(ERROR!|REF!|VALUE!|DIV\/0!|NAME\?|N\/A|NUM!)/.test(x))}));}

