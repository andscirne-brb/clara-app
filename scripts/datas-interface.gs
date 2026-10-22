/** Apoio à formatação pela interface, quando as colunas tipadas bloqueiam a API. */
function prepararDatasNaInterface() {
  const ss=SpreadsheetApp.getActive(), props=PropertiesService.getDocumentProperties();
  if(!props.getProperty('claraFolhasOcultasAntesDatas')) props.setProperty('claraFolhasOcultasAntesDatas',JSON.stringify(ss.getSheets().filter(function(s){return s.isSheetHidden();}).map(function(s){return s.getName();})));
  const plano=planoDatas_(ss).filter(function(p){return !/ - antes | - registos anteriores/.test(p.sh.getName());});
  const resultado=plano.map(function(p){p.sh.showSheet(); return {folha:p.sh.getName(),gid:p.sh.getSheetId(),coluna:p.coluna,primeira:p.linha+1,ultima:p.sh.getMaxRows()};});
  console.log(JSON.stringify(resultado));return resultado;
}
function finalizarDatasNaInterface() {
  const ss=SpreadsheetApp.getActive(), resultado=[];
  planoDatas_(ss).filter(function(p){return !/ - antes | - registos anteriores/.test(p.sh.getName());}).forEach(function(p){
    const r=p.sh.getRange(p.linha+1,p.coluna,p.sh.getMaxRows()-p.linha,1);
    try {r.setNumberFormat('yyyy-mm-dd');r.setDataValidation(SpreadsheetApp.newDataValidation().requireDate().setAllowInvalid(false).build());SpreadsheetApp.flush();resultado.push({folha:p.sh.getName(),coluna:p.coluna,ok:true});}
    catch(e){resultado.push({folha:p.sh.getName(),coluna:p.coluna,ok:false,erro:e.message});}
  });
  const props=PropertiesService.getDocumentProperties(), nomes=JSON.parse(props.getProperty('claraFolhasOcultasAntesDatas')||'[]');
  nomes.forEach(function(n){const sh=ss.getSheetByName(n);if(sh)sh.hideSheet();});props.deleteProperty('claraFolhasOcultasAntesDatas');
  console.log(JSON.stringify(resultado));return resultado;
}
function finalizarVistaPerfis() {
  const pf=SpreadsheetApp.getActive().getSheetByName('Perfis dos portais');
  if(pf.getRange(1,2).getValue()!=='Estado do perfil')throw new Error('Reorganização por concluir.');
  pf.getDataRange().clearDataValidations(); pf.showColumns(1,9); pf.setRowHeights(2,3,72);
  pf.getRange('F2:F4').setNumberFormat('0');
  const filtro=pf.getFilter();if(filtro)filtro.remove();
  SpreadsheetApp.flush();console.log('Vista dos perfis conferida.');
}
