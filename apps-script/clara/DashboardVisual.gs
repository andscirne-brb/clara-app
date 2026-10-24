/** Dashboard de consulta: resultados primeiro; origens e histórico preservados. */
function periodo30Dashboard_(linhas,tz){
 const lotes={};const iso=v=>v instanceof Date?Utilities.formatDate(v,tz,'yyyy-MM-dd'):String(v);
 linhas.forEach((r,i)=>{if(r[1]!=='geral'||!r[10])return;const id=String(r[10]),b=lotes[id]||(lotes[id]={inicio:iso(r[2]),fim:iso(r[3]),filtros:String(r[4]),recolha:iso(r[0]),ultima:i,metricas:{}});b.ultima=i;if(typeof r[8]==='number')b.metricas[r[7]]=r[8];});
 return Object.values(lotes).filter(b=>Math.round((Date.parse(b.fim)-Date.parse(b.inicio))/86400000)+1===30).sort((a,b)=>b.fim.localeCompare(a.fim)||b.ultima-a.ultima)[0]||null;
}
function leadsMensaisRightmove_(linhas,tz){
 const iso=v=>v instanceof Date?Utilities.formatDate(v,tz,'yyyy-MM-dd'):String(v||''),meses={};
 linhas.forEach((r,i)=>{if(String(r[3]).toLowerCase()!=='rightmove')return;const a=iso(r[0]),b=iso(r[1]),k=a.slice(0,7),n=[r[4],r[10],r[11]];
   if(!/^\d{4}-\d{2}-01$/.test(a)||b.slice(0,7)!==k||b<a||n.some(x=>typeof x!=='number'||!Number.isInteger(x)||x<0)||n[0]!==n[1]+n[2])return;
   const m={inicio:a,fim:b,total:n[0],chamadas:n[1],emails:n[2],recolha:iso(r[8]),ordem:i},old=meses[k];if(!old||b>old.fim||b===old.fim&&(m.recolha>old.recolha||m.recolha===old.recolha&&i>old.ordem))meses[k]=m;
 });
 return Object.keys(meses).sort().map(k=>{const m=meses[k],day=Number(m.fim.slice(-2)),last=new Date(Date.UTC(Number(k.slice(0,4)),Number(k.slice(5,7)),0)).getUTCDate();m.parcial=day<last;m.mes=k;return m;});
}
/** A assinatura inclui valores, não apenas contagens: alterações manuais também invalidam a vista. */
function assinaturaDashboard_(ss){
 const fontes=[['Idealista - recolhas',2,13],['Leads por período',6,12],['Rightmove - anúncios',6,22],['Levantamento',9,100],['Histórico de indicadores',6,11],['Rightmove - histórico',1,22],['Pendências da equipa',5,17]];
 const dados=fontes.map(([nome,inicio,largura])=>{const sh=ss.getSheetByName(nome);return[nome,sh?sh.getSheetId():null,sh&&sh.getLastRow()>=inicio?sh.getRange(inicio,1,sh.getLastRow()-inicio+1,Math.min(largura,sh.getLastColumn())).getValues():[]];});
 const d=ss.getSheetByName('Dashboard'),v=ss.getSheetByName('Clara - dashboard');
 const estado=[d?d.getRange('A2').getValue():null,v?v.getSheetId():null,d?d.getCharts().map(c=>String(c.getOptions().get('title')||'')).sort():[]];
 return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,JSON.stringify(['dashboard-v3',ss.getSpreadsheetTimeZone(),dados,estado]),Utilities.Charset.UTF_8).map(b=>('0'+((b+256)%256).toString(16)).slice(-2)).join('');
}
function atualizarDashboardSeNecessario(){
 const lock=LockService.getDocumentLock();if(!lock.tryLock(1000))return{adiado:true};
 try{
  const ss=SpreadsheetApp.getActive(),props=PropertiesService.getDocumentProperties(),key='clara.dashboard.assinatura.v3',assinatura=assinaturaDashboard_(ss);
  if(props.getProperty(key)===assinatura)return{reutilizado:true};
  // Não marcar como atualizada se os dados mudaram durante a construção.
  const r=atualizarDashboardVisual_(ss);if(r){const depois=assinaturaDashboard_(ss);if(depois===assinatura)props.setProperty(key,depois);else props.deleteProperty(key);}return r;
 }finally{lock.releaseLock();}
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
 const leads=rows('Leads por período',6,12),rmLeads=leadsMensaisRightmove_(leads,tz),rmUltimo=rmLeads.length?rmLeads[rmLeads.length-1]:null;
 const green=leads.filter(r=>String(r[3]).toLowerCase()==='green-acres'&&typeof r[4]==='number');
 const iso=v=>v instanceof Date?Utilities.formatDate(v,tz,'yyyy-MM-dd'):String(v||'');green.sort((a,b)=>iso(a[1]).localeCompare(iso(b[1])));
 const lastGreen=green.length?green[green.length-1]:null,rm=rows('Rightmove - anúncios',6,22).filter(r=>r[2]),activeRM=rm.filter(r=>String(r[7]).match(/Disponível|Available/i)),views=rm.filter(r=>typeof r[17]==='number').map(r=>r[17]);
 const bg='#f3f6fa',ink='#183746',muted='#607786',teal='#087f8c',blue='#239bc1',purple='#8170bc';
 s.getRange('A1:L102').setBackground(bg).setFontFamily('Arial').setFontSize(10).setFontColor(ink).setVerticalAlignment('middle').setNumberFormat('General');s.setHiddenGridlines(true);s.setFrozenRows(0);s.setFrozenColumns(0);s.setColumnWidths(1,12,92);s.setRowHeights(1,102,22);s.setRowHeight(1,12);
 function block(row,col,n,height,text,size,color,bold,back){const r=s.getRange(row,col,height,n);r.breakApart();r.merge();r.setValue(text===null?'—':text).setBackground(back||bg).setFontSize(size||10).setFontColor(color||ink).setFontWeight(bold?'bold':'normal').setWrap(true).setHorizontalAlignment('left').setFontLine('none');return r;}
 function section(row,title){block(row,1,12,1,title,13,ink,true);s.setRowHeight(row,32);}
 function card(col,name,value,label,period,detail,footer,color){block(6,col,4,1,name,12,color,true,'#ffffff');block(7,col,4,2,value,32,ink,true,'#ffffff');block(9,col,4,1,label,11,muted,false,'#ffffff');block(10,col,4,2,period,10,muted,false,'#ffffff');block(12,col,4,2,detail,11,ink,true,'#ffffff');block(14,col,4,2,footer,9,muted,false,'#ffffff');}
 block(2,1,12,2,'Resultados dos portais',23,ink,true);block(4,1,12,1,'Dados por portal · consultar as datas de cada fonte antes de comparar',11,muted);
 const fmt=v=>typeof v==='number'?v.toLocaleString('pt-PT'):'Não recolhido';
 card(1,'IDEALISTA',p?fmt(p.metricas.contactos):'Sem dados','contactos recebidos',p?p.inicio+' a '+p.fim+'\n'+(()=>{try{return JSON.parse(p.filtros).join(' · ');}catch(e){return p.filtros;}})():'Falta recolha de 30 dias',p?fmt(p.metricas.visitasDetalhes)+' visitas aos anúncios\n'+fmt(p.metricas.anunciosAtivosHoje)+' anúncios ativos na recolha':'Registar estatísticas no menu Clara',p?'Recolha: '+p.recolha+' · '+fmt(p.metricas.mensagens)+' mensagens / '+fmt(p.metricas.chamadas)+' chamadas':'',teal);
 card(5,'GREEN-ACRES',lastGreen?fmt(lastGreen[4]):'Sem dados','contactos únicos · último dado disponível',lastGreen?iso(lastGreen[0])+' a '+iso(lastGreen[1]):'Sem recolha',lastGreen?'Sem janela de 30 dias recolhida':'Falta relatório de contactos','O gráfico mensal mantém o histórico. Período distinto do Idealista.',blue);
 card(9,'RIGHTMOVE',rmLeads.length?fmt(rmLeads.reduce((n,x)=>n+x.total,0)):'Sem dados','leads · meses registados',rmUltimo?rmLeads[0].inicio+' a '+rmUltimo.fim+(rmUltimo.parcial?' · mês final parcial':''):'Sem relatório de leads',fmt(activeRM.length)+' anúncios · '+(views.length?(views.reduce((a,b)=>a+b,0)/views.length).toFixed(2).replace('.',','):'—')+' visitas/dia/anúncio (30 dias)',rmUltimo?rmLeads.reduce((n,x)=>n+x.chamadas,0)+' chamadas · '+rmLeads.reduce((n,x)=>n+x.emails,0)+' emails. Sem janela de 30 dias de leads.':'Contactos por recolher.',purple);
 [['A6','IDEALISTA','Idealista - recolhas'],['E6','GREEN-ACRES','Leads por período'],['I6','RIGHTMOVE','Rightmove - anúncios']].forEach(a=>{const t=ss.getSheetByName(a[2]);if(t)s.getRange(a[0]).setRichTextValue(SpreadsheetApp.newRichTextValue().setText(a[1]).setLinkUrl(ss.getUrl()+'#gid='+t.getSheetId()).build());});
 s.getRange('A17:L102').breakApart().clearContent();
 section(17,'Evolução das Leads');
 let v=ss.getSheetByName('Clara - dashboard');if(!v){v=ss.insertSheet('Clara - dashboard');v.hideSheet();}v.clearContents();
 const daily=allDaily&&p?allDaily.diarios.filter(r=>r.data>=p.inicio&&r.data<=p.fim):[];
 const dailyOk=p&&daily.length===30&&daily.reduce((a,b)=>a+b.contactos,0)===p.metricas.contactos;
 v.getRange('A1:D1').setValues([['Dia','Contactos','Emails e mensagens','Chamadas']]);if(dailyOk)v.getRange(2,1,daily.length,4).setValues(daily.map(r=>[Utilities.parseDate(r.data,tz,'yyyy-MM-dd'),r.contactos,r.mensagens,r.chamadas]));v.getRange('A2:A32').setNumberFormat('dd/MM');
 v.getRange('F1:G1').setValues([['Mês','Contactos únicos']]);if(green.length)v.getRange(2,6,green.length,2).setValues(green.map(r=>[iso(r[0]).slice(0,7)+(/parcial/i.test(String(r[9]))?' *':''),r[4]]));
 SpreadsheetApp.flush();
 function chart(title,range,row,col,type,opts){const own=s.getCharts().filter(c=>String(c.getOptions().get('title')||'')===title);if(own.length>1)throw Error('Gráfico repetido: '+title);let b=s.newChart();b=b.setChartType(type).addRange(range).setNumHeaders(1).setHiddenDimensionStrategy(Charts.ChartHiddenDimensionStrategy.SHOW_BOTH).setPosition(row,col,0,0).setOption('title',title).setOption('width',col===1&&row===36?1100:364).setOption('height',280).setOption('fontName','Arial').setOption('backgroundColor','#ffffff').setOption('titleTextStyle',{fontSize:12,color:ink,bold:true}).setOption('legend',{position:'bottom',textStyle:{fontSize:9}});Object.keys(opts||{}).forEach(k=>b.setOption(k,opts[k]));s.insertChart(b.build());if(own.length)s.removeChart(own[0]);}
 block(19,1,4,12,dailyOk?'':'Falta uma série diária completa para estes 30 dias.',11,muted,false,'#ffffff');block(19,5,4,12,green.length?'':'Falta histórico de contactos.',11,muted,false,'#ffffff');block(19,9,4,12,rmLeads.length?'':'Falta histórico mensal Rightmove.',11,muted,false,'#ffffff');
 if(dailyOk)chart('Idealista · contactos nos 30 dias',v.getRange(1,1,31,4),19,1,Charts.ChartType.COMBO,{seriesType:'bars',series:{0:{type:'line',color:teal,lineWidth:2},1:{color:'#87cbd9'},2:{color:purple}},hAxis:{format:'dd/MM',showTextEvery:5},vAxis:{minValue:0,format:'0'}});
 if(green.length)chart('Green-Acres · contactos únicos por mês',v.getRange(1,6,green.length+1,2),19,5,Charts.ChartType.COLUMN,{colors:[blue],legend:{position:'none'},hAxis:{slantedText:true,slantedTextAngle:45},vAxis:{minValue:0,format:'0'}});
 v.getRange('P1:R1').setValues([['Mês','Chamadas','Emails']]);if(rmLeads.length)v.getRange(2,16,rmLeads.length,3).setValues(rmLeads.map(x=>[x.mes+(x.parcial?' *':''),x.chamadas,x.emails]));SpreadsheetApp.flush();
 if(rmLeads.length)chart('Rightmove · leads por mês',v.getRange(1,16,rmLeads.length+1,3),19,9,Charts.ChartType.COLUMN,{isStacked:true,colors:[teal,'#4678ec'],vAxis:{minValue:0,format:'0'},hAxis:{slantedText:true,slantedTextAngle:30}});
 block(32,1,12,1,'Períodos e critérios próprios por portal: Idealista diário; Green-Acres e Rightmove mensais. * Mês parcial.',9,muted);
 section(34,'eGO · evolução das leads');
 const lc=colunas_(ss.getSheetByName(LEV.nome),LEV.titulos),prior=rows(LEV.nome,10,lc.titulos.length).filter(r=>r[lc.col('Prioridade')-1]==='Prioritária').map(r=>String(r[lc.col('Referência EGO')-1]));
 const ego=serieCompletudeEGO_(rows('Histórico de indicadores',6,11),prior,tz),rmHist=guardarMedicaoRightmove_(ss,rm,tz),right=serieRightmove_(rmHist,rm.map(r=>r[2]),tz);
 v.getRange('J1:K1').setValues([['Data do relatório','Média diária de visitas / anúncio']]);if(right.length)v.getRange(2,10,right.length,2).setValues(right.map(r=>[r.data,r.media]));v.getRange('M1:N1').setValues([['Data da medição','Completude média']]);if(ego.length)v.getRange(2,13,ego.length,2).setValues(ego.map(r=>[r.data,r.media]));v.getRange('N2:N1000').setNumberFormat('0.0%');SpreadsheetApp.flush();
 s.getCharts().filter(c=>['Rightmove · visitas diárias por anúncio (30 dias)','eGO · completude média dos prioritários'].indexOf(String(c.getOptions().get('title')||''))>=0).forEach(c=>s.removeChart(c));
 block(36,1,12,12,'A aguardar dados de leads do eGO.\nO gráfico será apresentado quando existir um relatório com datas e contagens de contactos.',13,muted,false,'#ffffff');
 block(49,1,12,2,'eGO é o sistema principal. O progresso do preenchimento dos imóveis continua nos indicadores de trabalho abaixo.',10,muted);
 section(53,'Progresso do trabalho');
 const f=formulasProgressoDashboard_(ss);
 const indicators=[['Prioritários verificados',f.verificados,teal],['Correções concluídas',f.concluidas,teal],['Pendências abertas',f.abertas,'#bb7543'],['A aguardar Sara',f.sara,purple]];
 indicators.forEach((a,i)=>{const col=i*3+1;block(55,col,3,1,a[0],10,muted,false,'#ffffff');block(56,col,3,2,'',28,a[2],true,'#ffffff').setFormula(a[1]).setNumberFormat('0');block(58,col,3,1,i===0?'de '+prior.length+' imóveis prioritários':'',9,muted,false,'#ffffff');});
 section(61,'Prioridades e pendências da equipa');
 block(63,1,6,2,'Pendências operacionais',12,ink,true,'#ffffff');block(65,1,6,2,'',26,teal,true,'#ffffff').setFormula(f.andreia).setNumberFormat('0');block(67,1,6,2,'Assuntos atribuídos à Andreia. Consultar a lista para saber o que falta fazer.',10,muted,false,'#ffffff');
 block(63,7,6,2,'Imóveis com pendências',12,ink,true,'#ffffff');block(65,7,6,2,'',26,purple,true,'#ffffff').setFormula(f.imoveis).setNumberFormat('0');block(67,7,6,2,'A conclusão de uma recolha não significa que todas as correções estejam concluídas.',10,muted,false,'#ffffff');
 section(71,'Consultar o detalhe');
 [['Levantamento','eGO · estado dos imóveis',1],['Pendências da equipa','Equipa · tarefas e bloqueios',5],['Perfis dos portais','Portais · perfis e pendências',9]].forEach(a=>{const target=ss.getSheetByName(a[0]);if(target)block(73,a[2],4,2,'',11,teal,true,'#e6f0f2').setRichTextValue(SpreadsheetApp.newRichTextValue().setText(a[1]).setLinkUrl(ss.getUrl()+'#gid='+target.getSheetId()).build());});
 block(77,1,12,2,'Datas dos dados: Idealista '+(p?p.fim:'sem recolha')+' · Green-Acres '+(lastGreen?iso(lastGreen[1]):'sem recolha')+' · Rightmove '+(rm.length?iso(rm[0][0]):'sem recolha')+'. Sem dados não significa zero.',10,muted);
 block(80,1,12,1,'Vista atualizada em '+Utilities.formatDate(new Date(),tz,'yyyy-MM-dd HH:mm')+' · atualizar a vista não recolhe novos dados dos portais.',9,muted);
 s.setTabColor(teal);if(!v.isSheetHidden())v.hideSheet();SpreadsheetApp.flush();return{periodo:p?{inicio:p.inicio,fim:p.fim}:null,diarios:dailyOk?30:0,rightmove:rm.length,mediaRightmove:views.length?views.reduce((a,b)=>a+b,0)/views.length:null,graficos:s.getCharts().length,pontosRightmove:right.length,pontosEGO:ego.length,mesesLeadsRightmove:rmLeads.length,totalLeadsRightmove:rmLeads.reduce((n,x)=>n+x.total,0)};
}


function verificarDashboardVisual(){const ss=SpreadsheetApp.getActive(),s=ss.getSheetByName('Dashboard'),v=ss.getSheetByName('Clara - dashboard');console.log(JSON.stringify({cartoes:s.getRange('A55:L58').getDisplayValues(),fontes:v.getRange('A1:G4').getDisplayValues(),progressao:v.getRange('J1:N3').getDisplayValues(),historicoRightmove:Math.max(0,ss.getSheetByName('Rightmove - histórico').getLastRow()-1),graficos:s.getCharts().map(c=>({titulo:c.getOptions().get('title'),ranges:c.getRanges().map(r=>r.getSheet().getName()+'!'+r.getA1Notation())})),erros:s.getRange('A1:L80').getDisplayValues().flat().filter(x=>/^#(ERROR!|REF!|VALUE!|DIV\/0!|NAME\?|N\/A|NUM!)/.test(x))}));}

