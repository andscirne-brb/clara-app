/* Pós-gravação independente: nunca transforma uma importação guardada em falha. */
function respostaAutomacaoPortais_(r,texto){
 const d=JSON.parse(String(texto).trim().slice(7));
 r.automacaoPortais=!!(!r.duplicada&&((d.origem==='green-acres'&&d.tipo==='anuncios')||(d.origem==='rightmove'&&['performance','performance_csv'].includes(d.tipo))||(d.v===2&&(['lista','ranking','carteira_ativa'].includes(d.tipo)||d.carteiraAtiva))));
 return r;
}
function continuarAutomacaoPortais(iniciar){
 if(iniciar===true)atualizarImoveisPortais();
 const r=identificarProximosImoveisPortais(),ss=SpreadsheetApp.getActive(),rows=ipTabela_(ss,'Ligações dos portais',9,IP_LIGACOES);
 return {processados:r.processados||0,restantes:rows.filter(x=>x[4]==='Por identificar'&&!x[8]).length,confirmadas:rows.filter(x=>x[4]==='Confirmada').length,porRever:rows.filter(x=>x[4]!=='Confirmada'&&(x[4]!=='Por identificar'||x[8])).length};
}
function conferirAnalisePortal_(a,texto){
 const d=JSON.parse(String(texto).trim().slice(7)),avisos=[],notas=[],hoje=Utilities.formatDate(new Date(),SpreadsheetApp.getActive().getSpreadsheetTimeZone(),'yyyy-MM-dd'),lido=String(d.lido||'').slice(0,10);
 if(lido&&lido<hoje)avisos.push('Leitura recolhida em '+lido+'. Confirma se pretendes importar este histórico.');
 if(a.duplicada)notas.push('Já guardada: não será duplicada.');
 if(a.relatorios){a.relatorios.forEach(r=>{if(r.faltamDias)avisos.push(r.codigo+': '+r.faltamDias+' dias em falta; não são zeros.');});notas.push('Cada CSV mantém o seu período. O mês corrente é parcial.');}
 if(a.origem==='idealista'){
  if(d.tipo==='lista')avisos.push('Página isolada: a lista completa deve ser conferida em Idealista: ranking dos anúncios.');
  if(d.tipo==='ranking'&&d.fonte!=='Excel oficial Idealista')avisos.push('Ranking sem exportação completa confirmada.');
  if(d.tipo==='geral'&&!d.diarios)avisos.push('Sem série diária de contactos. Os totais não permitem reconstruir o gráfico.');
  if(d.tipo==='geral'&&!d.carteiraAtiva)avisos.push('Carteira ativa não recolhida.');
 }
 if(a.avisoFonte)avisos.push(a.avisoFonte);
 if(a.origem==='rightmove'&&a.tipo!=='leads')notas.push('Visitas diárias médias: não são contactos nem totais do período.');
 notas.push('Períodos diferentes não são somados nem comparados automaticamente.');
 a.conferencia={estado:avisos.length?'Rever avisos':'Validações da leitura concluídas',avisos,notas};return a;
}
function acaoRevisaoLigacao_(r){
 if(r[4]==='Referência ausente no levantamento')return 'Confirmar a referência original e se o imóvel existe no levantamento. Não criar correspondência aproximada.';
 if(r[4]==='Referência duplicada no levantamento')return 'Resolver a referência repetida no levantamento antes de associar.';
 if(r[4]==='Conflito de referências')return 'Comparar a referência da ficha pública com a ligação anterior; requer revisão humana.';
 return 'Abrir a ficha pública e usar o marcador Clara para confirmar a referência explícita. Se não existir, manter por rever.';
}
function abrirConferenciaPortais(){
 const ss=SpreadsheetApp.getActive(),rows=ipTabela_(ss,'Ligações dos portais',9,IP_LIGACOES),pend=rows.filter(r=>r[4]!=='Confirmada'),headers=['Portal','ID do anúncio','Referência encontrada','Estado','Próximo passo','Evidência','Página pública'];
 const sh=ipEscrever_(ss,'Portais - por rever',headers,pend.map(r=>[r[0],r[1],r[3],r[4],r[4]==='Por identificar'&&!r[8]?'Aguarda identificação automática em lote.':acaoRevisaoLigacao_(r),r[8],r[6]]));
 sh.showSheet();sh.activate();sh.setColumnWidth(5,360);sh.setColumnWidth(6,300);ss.toast(pend.length+' ligações por verificar. Nenhuma tarefa da equipa foi criada.','Clara',8);
}
