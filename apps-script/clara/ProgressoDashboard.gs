/** Só compara o mesmo grupo completo; 30/60/90 dias não são datas sucessivas. */
function dataISOProgresso_(v,tz){return v instanceof Date?Utilities.formatDate(v,tz,'yyyy-MM-dd'):String(v||'');}
function serieCompletudeEGO_(linhas,refs,tz){
 const ids=Array.from(new Set(refs.map(String))).sort(),dias={};if(!ids.length)return[];
 linhas.forEach(r=>{if(String(r[2]).toLowerCase()!=='ego'||ids.indexOf(String(r[1]))<0)return;const d=dataISOProgresso_(r[0],tz);let x=r[4];if(typeof x==='string'){if(!x.trim())return;const pct=x.indexOf('%')>=0;x=Number(x.replace('%','').replace(',','.'));if(pct){if(x<0||x>100)return;x/=100;}}else if(typeof x!=='number')return;if(x>1)x/=100;if(!/^\d{4}-\d{2}-\d{2}$/.test(d)||!Number.isFinite(x)||x<0||x>1)return;(dias[d]||(dias[d]={}))[String(r[1])]=x;});
 return Object.keys(dias).sort().filter(d=>ids.every(id=>Object.prototype.hasOwnProperty.call(dias[d],id))).map(d=>({data:d,media:ids.reduce((s,id)=>s+dias[d][id],0)/ids.length,imoveis:ids.length}));
}
function serieRightmove_(linhas,refs,tz){
 const ids=Array.from(new Set(refs.map(String))).sort(),lotes={};if(!ids.length)return[];
 linhas.forEach((r,i)=>{if(!r[1])return;const k=String(r[1]),g=lotes[k]||(lotes[k]={data:dataISOProgresso_(r[0],tz),ultima:i,ids:{}});g.ultima=i;g.ids[String(r[2])]=r[3];});
 const datas={};Object.values(lotes).forEach(g=>{if(JSON.stringify(Object.keys(g.ids).sort())!==JSON.stringify(ids)||!ids.every(id=>typeof g.ids[id]==='number'&&Number.isFinite(g.ids[id])&&g.ids[id]>=0))return;if(!datas[g.data]||datas[g.data].ultima<g.ultima)datas[g.data]=g;});
 return Object.keys(datas).sort().map(d=>({data:d,media:ids.reduce((s,id)=>s+datas[d].ids[id],0)/ids.length,anuncios:ids.length}));
}
function guardarMedicaoRightmove_(ss,rm,tz){
 if(!rm.length)return[];const ids=rm.map(r=>String(r[2]));if(ids.some(x=>!/^\d+$/.test(x))||new Set(ids).size!==ids.length)throw Error('IDs Rightmove repetidos; histórico não alterado.');
 const datas=Array.from(new Set(rm.map(r=>dataISOProgresso_(r[0],tz))));if(datas.length!==1||!/^\d{4}-\d{2}-\d{2}$/.test(datas[0]))throw Error('A recolha Rightmove tem datas incompatíveis.');
 const dados=rm.map(r=>[String(r[2]),typeof r[17]==='number'?r[17]:'',r[5],r[6],String(r[7])]).sort((a,b)=>a[0].localeCompare(b[0]));if(dados.some(r=>typeof r[1]!=='number'||!Number.isFinite(r[1])||r[1]<0))return[];
 const hash=Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,JSON.stringify([datas[0],dados]),Utilities.Charset.UTF_8).map(x=>('0'+((x+256)%256).toString(16)).slice(-2)).join('');
 let sh=ss.getSheetByName('Rightmove - histórico');const headers=['Data do relatório','ID da recolha','ID Rightmove','Média diária (30 dias)','Fotografias','Plantas','Estado','Data do registo'];
 if(!sh){sh=ss.insertSheet('Rightmove - histórico');sh.getRange(1,1,1,8).setValues([headers]).setBackground('#183746').setFontColor('#ffffff').setFontWeight('bold');sh.setFrozenRows(1);sh.setColumnWidths(1,8,145);}
 if(sh.getRange(1,1,1,8).getDisplayValues()[0].join('|')!==headers.join('|'))throw Error('Estrutura do histórico Rightmove alterada.');
 const anterior=sh.getLastRow()>1?sh.getRange(2,1,sh.getLastRow()-1,8).getValues():[];if(anterior.some(r=>r[1]===hash))return anterior;
 const linha=sh.getLastRow()+1,hoje=Utilities.parseDate(Utilities.formatDate(new Date(),tz,'yyyy-MM-dd'),tz,'yyyy-MM-dd'),date=Utilities.parseDate(datas[0],tz,'yyyy-MM-dd'),out=dados.map(r=>[date,hash,r[0],r[1],r[2],r[3],r[4],hoje]);
 if(sh.getMaxRows()<linha+out.length-1)sh.insertRowsAfter(sh.getMaxRows(),linha+out.length-1-sh.getMaxRows());
 try{sh.getRange(linha,1,out.length,8).setValues(out);sh.getRange(linha,1,out.length,1).setNumberFormat('yyyy-mm-dd');sh.getRange(linha,8,out.length,1).setNumberFormat('yyyy-mm-dd');SpreadsheetApp.flush();if(sh.getRange(linha,2,out.length,1).getValues().some(r=>r[0]!==hash))throw Error('Conferência do histórico Rightmove falhou.');}catch(e){sh.getRange(linha,1,out.length,8).clearContent();throw e;}return anterior.concat(out);
}
function prepararEspacoProgressao_(ss,s){
 const prop=PropertiesService.getDocumentProperties(),key='clara.dashboard.progressao.v2';if(prop.getProperty(key)==='1')return;
 const copy=s.copyTo(ss);copy.setName('Dashboard - antes progressão '+Utilities.formatDate(new Date(),ss.getSpreadsheetTimeZone(),'MMdd-HHmmss'));copy.hideSheet();s.getRange('A32:L88').breakApart().clearContent();prop.setProperty(key,'1');
}
function formulasProgressoDashboard_(ss){
 const c=colunas_(ss.getSheetByName(LEV.nome),LEV.titulos),col=n=>{let x=c.col(n),s='';while(x){s=String.fromCharCode(65+(x-1)%26)+s;x=Math.floor((x-1)/26);}return "'Levantamento'!"+s+'10:'+s;};
 const pri=col('Prioridade'),est=col('Estado da verificação'),ids="'Pendências da equipa'!A6:A",status="'Pendências da equipa'!I6:I",owner="'Pendências da equipa'!G6:G",sara="'Pendências da equipa'!Q6:Q",refs="'Pendências da equipa'!B6:B",tema="'Pendências da equipa'!C6:C",open=ids+';"<>";'+status+';"<>Concluído";'+status+';"<>Não aplicável"';
 return{verificados:'=COUNTIFS('+pri+';"Prioritária";'+est+';"Verificado")',total:'=COUNTIF('+pri+';"Prioritária")',concluidas:'=COUNTIFS('+ids+';"<>";'+status+';"Concluído")',abertas:'=COUNTIFS('+open+')',sara:'=COUNTIFS('+open+';'+sara+';"Sara")',andreia:'=COUNTIFS('+open+';'+owner+';"Andreia")',imoveis:'=IFERROR(ROWS(UNIQUE(FILTER('+refs+';'+ids+'<>"";'+refs+'<>"";'+status+'<>"Concluído";'+status+'<>"Não aplicável";'+tema+'<>"Perfil do portal")));0)'};
}
