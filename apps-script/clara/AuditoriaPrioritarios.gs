/* Vista derivada, apenas de leitura. Estado registado não comprova qualidade nem publicação atual. */
const AP_VERSAO='20261028.1';
const AP_CAMPOS=['Imagens','Alt-text','Descrição PT','Descrição EN','Descrição FR','Descrição DE','Descrição ES','Características','Vídeo','Planta','Caderneta Predial (anexo)','Certificado Energético (anexo)','Contrato Mediação (anexo)','Licença Habitação (anexo)','Folheto'];
function apClassificar_(v){
  if(v==='Preenchido')return 'registado';
  if(v==='Não aplicável')return 'na';
  if(!v||v==='Por verificar')return 'desconhecido';
  if(['Em falta','Em falta no eGO · verificar dossier','No dossier · por digitalizar','Digitalizado','Em falta no eGO e no dossier','Categoria errada','Formato errado'].includes(v))return 'acao';
  return 'desconhecido';
}
function apModelo_(h,rows,ligacoes){
  ['Referência EGO','Prioridade','Estado da verificação','Data da verificação',...AP_CAMPOS].forEach(n=>{if(h.indexOf(n)<0)throw Error('Falta a coluna '+n+'. A auditoria não foi preparada.');});
  const get=(r,n)=>String(r[h.indexOf(n)]||''),refs={};rows.forEach(r=>{const ref=get(r,'Referência EGO').trim().toUpperCase();if(ref)refs[ref]=(refs[ref]||0)+1;});
  const imoveis=rows.map((r,i)=>({r,linha:i+10})).filter(x=>get(x.r,'Prioridade')==='Prioritária').map(x=>{
    const r=x.r,ref=get(r,'Referência EGO').trim().toUpperCase(),duplicada=refs[ref]!==1,notas=get(r,'Observações / justificação N/A');
    const criterios=AP_CAMPOS.map(nome=>{let valor=get(r,nome);const doc=typeof ED_CAMPOS!=='undefined'&&ED_CAMPOS.find(c=>c[1]===nome);if(doc&&typeof edEstado_==='function')valor=edEstado_(valor,notas,doc[2]);return{nome,valor:valor||'Por verificar',classe:apClassificar_(valor),fonte:'Levantamento · linha '+x.linha};});
    const portais=['Idealista','Green-Acres','Rightmove'].map(portal=>{const ls=ligacoes.filter(l=>l[0]===portal&&String(l[3]||'').trim().toUpperCase()===ref),ok=duplicada?[]:ls.filter(l=>l[4]==='Confirmada');return{portal,confirmadas:ok.length,porRever:ls.length-ok.length,estado:duplicada?'Referência duplicada no levantamento':ok.length?'Ligação confirmada; publicação atual por verificar':'Sem ligação confirmada; publicação por verificar'};});
    return{ref,linha:x.linha,duplicada,natureza:get(r,'Natureza'),concelho:get(r,'Concelho'),estado:get(r,'Estado da verificação'),data:get(r,'Data da verificação'),website:typeof edWebsite_==='function'?edWebsite_(notas):'Por verificar',criterios,portais,resumo:get(r,'Resumo para a equipa'),contagens:{registados:criterios.filter(c=>c.classe==='registado').length,acoes:criterios.filter(c=>c.classe==='acao').length,desconhecidos:criterios.filter(c=>c.classe==='desconhecido').length,na:criterios.filter(c=>c.classe==='na').length}};
  });
  return{versao:AP_VERSAO,quantidade:imoveis.length,referenciasUnicas:new Set(imoveis.map(x=>x.ref)).size,imoveis,limites:['Preço, áreas e tipologia: comparação eGO–portal ainda não avaliada nesta vista.','Descrições preenchidas não significam SEO, qualidade ou tradução validados.','Imagens presentes não significam qualidade visual ou ausência de duplicados.','Ligação confirmada não prova publicação atual. Sem ligação não significa anúncio ausente.','Estados são os últimos registados no levantamento; esta consulta não reconfirma os anúncios nem altera pendências.']};
}
function consultarAuditoriaPrioritarios(){
  const ss=SpreadsheetApp.getActive(),s=ss.getSheetByName(LEV.nome);if(!s)throw Error('Levantamento não encontrado.');
  const h=s.getRange(9,1,1,s.getLastColumn()).getDisplayValues()[0],rows=s.getLastRow()>9?s.getRange(10,1,s.getLastRow()-9,h.length).getDisplayValues():[],lig=ipTabela_(ss,'Ligações dos portais',9,IP_LIGACOES),m=apModelo_(h,rows,lig);
  m.atualizado=Utilities.formatDate(new Date(),ss.getSpreadsheetTimeZone(),'yyyy-MM-dd HH:mm');m.url=ss.getUrl().split('#')[0].split('?')[0];m.levantamentoId=s.getSheetId();return m;
}
function abrirAuditoriaPrioritarios(){SpreadsheetApp.getUi().showModalDialog(HtmlService.createHtmlOutput(AUDITORIA_PRIORITARIOS_HTML.replace('/*AP_INICIAL*/null',JSON.stringify(consultarAuditoriaPrioritarios()).replace(/</g,'\\u003c').replace(/\u2028/g,'\\u2028').replace(/\u2029/g,'\\u2029'))).setWidth(1000).setHeight(720),'Portais: auditoria');}
function verificarAuditoriaPrioritarios(){const m=consultarAuditoriaPrioritarios(),r={versao:m.versao,prioritarios:m.quantidade,referenciasUnicas:m.referenciasUnicas,duplicados:m.imoveis.filter(x=>x.duplicada).length,portais:['Idealista','Green-Acres','Rightmove'].map(portal=>({portal,imoveisComLigacao:m.imoveis.filter(x=>x.portais.some(p=>p.portal===portal&&p.confirmadas>0)).length})),somenteLeitura:true};console.log(JSON.stringify(r));return r;}
