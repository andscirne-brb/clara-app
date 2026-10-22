// Bloco independente: não soma períodos sobrepostos nem altera os filtros existentes.
function dadosDashboardIdealista_(linhas){
  const lotes={};
  linhas.forEach(function(r,i){if(r[1]!=='geral'||!r[10])return;const id=String(r[10]);let b=lotes[id];if(!b)b=lotes[id]={inicio:String(r[2]),fim:String(r[3]),filtros:String(r[4]),data:r[0],ultima:i,metricas:{}};b.ultima=i;if(typeof r[8]==='number'&&Number.isFinite(r[8]))b.metricas[String(r[7])]=r[8];});
  const periodos={};Object.values(lotes).forEach(function(b){const key=JSON.stringify([b.inicio,b.fim,b.filtros]);if(!periodos[key]||periodos[key].ultima<b.ultima)periodos[key]=b;});
  return Object.values(periodos).sort(function(a,b){return b.ultima-a.ultima;}).slice(0,4);
}
function atualizarDashboardIdealista(){return atualizarDashboardIdealista_(SpreadsheetApp.getActive());}
function atualizarDashboardIdealista_(ss){
  const sh=ss.getSheetByName('Dashboard'),origem=ss.getSheetByName('Idealista - recolhas');
  if(!sh||!origem)return;
  const marca='Idealista: estatísticas',ult=sh.getLastRow(),titulos=sh.getRange(1,1,Math.max(1,ult),1).getDisplayValues(),achadas=[];
  titulos.forEach(function(r,i){if(r[0]===marca)achadas.push(i+1);});if(achadas.length>1)throw new Error('Há blocos Idealista repetidos no Dashboard.');
  const inicio=achadas.length?achadas[0]:Math.max(96,ult+3);if(sh.getMaxRows()<inicio+25)sh.insertRowsAfter(sh.getMaxRows(),inicio+25-sh.getMaxRows());
  const rg=sh.getRange(inicio,1,26,5);
  const valores=rg.getValues(),formulas=rg.getFormulas();
  if(valores[0][0]!==marca&&(valores.some(function(r){return r.some(function(v){return v!=='';});})||formulas.some(function(r){return r.some(Boolean);})))throw new Error('O espaço do bloco Idealista está ocupado. Não alterei o Dashboard.');
  const linhas=origem.getLastRow()>1?origem.getRange(2,1,origem.getLastRow()-1,13).getValues():[],periodos=dadosDashboardIdealista_(linhas);
  const out=Array.from({length:26},function(){return Array(5).fill('');});
  out[0][0]=marca;
  out[1][0]='Até 4 períodos mais recentes. Cada coluna é independente; não somar períodos sobrepostos.';
  out[2][0]='Período';out[3][0]='Recolhido em';out[4][0]='Filtros';
  const nomes=estatisticasIdealista_({});nomes.forEach(function(x,i){out[i+6][0]=x.nome;});
  periodos.forEach(function(p,j){const c=j+1;out[2][c]=p.inicio+' a '+p.fim;out[3][c]=p.data;let f=[];try{f=JSON.parse(p.filtros);}catch(e){f=[p.filtros];}out[4][c]=f.join(' · ');estatisticasIdealista_(p.metricas).forEach(function(x,i){out[i+6][c]=x.valor===null?'Não recolhido':x.valor;});});
  if(!periodos.length)out[2][1]='Ainda sem recolhas gerais';
  out[22][0]='Contactos recebidos incluem clientes e angariação. Emails/mensagens e chamadas detalham os contactos de clientes.';
  out[23][0]='Anúncios ativos: valor no momento da leitura. Não é a média do período nem o inventário completo do eGO.';
  out[24][0]='Os últimos 2 dias podem sofrer ajustes. Séries diárias e evolução face a um período anterior ainda não disponíveis.';
  out[25][0]='Histórico: Idealista - recolhas. Uma nova leitura do mesmo período atualiza esta vista e preserva a anterior no histórico.';
  // Só o bloco reservado é atualizado. Valores históricos permanecem intactos.
  rg.setValues(out).setFontFamily('Arial').setFontSize(10).setVerticalAlignment('middle').setWrap(true);
  sh.getRange(inicio+0,1,1,5).setBackground('#155c53').setFontColor('#ffffff').setFontWeight('bold');
  sh.getRange(inicio+2,1,3,5).setBackground('#e9f0ee').setFontWeight('bold');
  sh.getRange(inicio+6,2,15,4).setNumberFormat('#,##0');sh.getRange(inicio+3,2,1,4).setNumberFormat('yyyy-mm-dd');
  sh.getRange(inicio+1,1,1,5).mergeAcross();sh.getRange(inicio+22,1,4,5).mergeAcross();
  sh.setRowHeight(inicio+0,28);sh.setRowHeight(inicio+1,34);sh.setRowHeights(inicio+2,3,42);sh.setRowHeights(inicio+6,15,30);sh.setRowHeights(inicio+22,4,34);
  SpreadsheetApp.flush();if(sh.getRange(inicio+0,1).getValue()!==marca)throw new Error('Não foi possível conferir o bloco Idealista.');
  const atalho=sh.getRange(6,1);if(!atalho.getValue()||atalho.getValue()==='Idealista: estatísticas ↓')atalho.setFormula('=HYPERLINK("#gid='+sh.getSheetId()+'&range=A'+inicio+'","Idealista: estatísticas ↓")');
  return{periodos:periodos.length,linha:inicio};
}
