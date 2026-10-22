/** Manutenção única, sob revisão humana. Não contém dados de clientes. */
function planoPerfis_(rows) {
  const grupos = {};
  rows.forEach(function(r) {
    if (!r[0] || !r[1] || /^(Fonte|Concluído)$/.test(r[3])) return;
    if (/^(Origem da consulta|Texto do perfil)$/.test(r[1])) return;
    if (r[1] === 'Próxima ação' && !/valida/i.test(r[2])) return;
    const assunto = /^(Nome e dados da empresa|Logótipo e imagens|Pontos para a Sara)$/.test(r[1]) ? 'Nome público, logótipo e materiais da marca' : r[1] === 'Próxima ação' ? 'Validação das alterações do perfil' : r[1];
    const key = r[0] + '|' + assunto;
    const g = grupos[key] || (grupos[key] = { portal:r[0], assunto:assunto, notas:[], sara:false, data:r[5], url:r[6] });
    const nota=String(r[2] || '').replace(/^Preciso de /,'').replace(/^Ainda preciso de /,'');
    if (nota && g.notas.indexOf(nota)<0) g.notas.push(nota);
    if (r[4] === 'Sara') g.sara=true;
    if (!g.data || String(r[5])>String(g.data)) g.data=r[5];
  });
  return Object.keys(grupos).map(function(k){return grupos[k];});
}

function conferenciaTarefaPortal_(r) {
  return '=IF(B'+r+'="";"";IF(COUNTIFS(A$6:A$305;A'+r+')>1;"ID repetido";IF(IF(C'+r+'="Perfil do portal";AND(B'+r+'<>"idealista";B'+r+'<>"green-acres";B'+r+'<>"rightmove");COUNTIFS(Levantamento!A$10:A$1009;B'+r+')<>1);"Rever referência";IF(AND(I'+r+'="Concluído";OR(M'+r+'="";L'+r+'="";O'+r+'<>"Confirmado"));"Validar conclusão";IF(AND(I'+r+'="Não aplicável";L'+r+'="");"Justificar N/A";"")))))';
}

function organizarPerfisDosPortais() {
  const lock=LockService.getDocumentLock();
  if (!lock.tryLock(30000)) throw new Error('Outra operação em curso.');
  try {
    const ss=SpreadsheetApp.getActive(), pf=ss.getSheetByName('Perfis dos portais'), ps=ss.getSheetByName(PEND.nome);
    const marca='Perfis - registos anteriores';
    if (ss.getSheetByName(marca)) throw new Error('Organização já iniciada ou concluída. Conferir antes de repetir.');
    if (pf.getRange(1,2).getValue()!=='Assunto') throw new Error('Estrutura dos perfis mudou.');
    const raw=pf.getDataRange().getValues(), displayed=pf.getDataRange().getDisplayValues();
    const tarefas=planoPerfis_(displayed.slice(1));
    const n=ps.getMaxRows()-PEND.titulos, vals=ps.getRange(6,1,n,17).getValues(), forms=ps.getRange(6,1,n,17).getFormulas();
    const livres=[]; let maxId=0;
    vals.forEach(function(r,i){maxId=Math.max(maxId,parseInt(String(r[0]).replace(/^P/,''),10)||0); if(r.every(function(v,j){return v==='' || (j===15 && forms[i][j]);}) && forms[i].every(function(v,j){return !v||j===15;})) livres.push(i+6);});
    if(livres.length<tarefas.length) throw new Error('Sem linhas livres nas pendências.');
    const arquivo=pf.copyTo(ss).setName(marca); arquivo.hideSheet();
    const backup=ps.copyTo(ss).setName('Pendências - antes dos perfis'); backup.hideSheet();
    const tz=ss.getSpreadsheetTimeZone(), hoje=dataHoje_(ss);
    const escritos=[];
    try {
      tarefas.forEach(function(t,i){
        const linha=livres[i], data=dataTexto_(t.data,tz)||hoje;
        const r=['P'+String(++maxId).padStart(4,'0'),t.portal,'Perfil do portal',t.assunto,t.url,t.notas.join(' '),'Andreia','Normal',t.sara?'A aguardar esclarecimento':'Por tratar',data,hoje,'','','Perfil '+t.portal,'Por verificar','',t.sara?'Sara':''];
        for(let j=0;j<17;j++) {if(j===15 && forms[linha-6][j]) continue;const c=ps.getRange(linha,j+1);if(c.getFormula()||c.getValue()!=='')throw new Error('Uma linha mudou entretanto.'); c.setValue(r[j]);escritos.push(c);}
        ps.getRange(linha,16).setFormula(conferenciaTarefaPortal_(linha));
      });
      SpreadsheetApp.flush();
      // Mantém o separador original e o seu gid: substitui apenas o conteúdo após cópia integral.
      pf.clearContents(); pf.getDataRange().clearDataValidations(); pf.showColumns(1,9);
      const headers=['Portal','Estado do perfil','Última revisão','Score oficial','Data do score','Pendências abertas','Próximo passo','Ligação','Informação disponível'];
      pf.getRange(1,1,1,headers.length).setValues([headers]);
      ['idealista','green-acres','rightmove'].forEach(function(portal,i){
        const rr=displayed.slice(1).filter(function(r){return r[0]===portal;}), ds=rr.map(function(r){return r[5];}).filter(String).sort();
        const link=rr.length?rr[0][6]:'';
        pf.getRange(i+2,1,1,9).setValues([[portal,rr.length?'Por rever':'Por levantar',ds.length?(dataTexto_(ds[ds.length-1],tz)||''):'','Não recolhido','',0,'Consultar pendências da equipa',link,rr.length?'Consulta anterior preservada no arquivo; publicação e alterações por confirmar.':'Perfil ainda por levantar.']]);
        pf.getRange(i+2,6).setFormula('=COUNTIFS(\'Pendências da equipa\'!B6:B;A'+(i+2)+';\'Pendências da equipa\'!C6:C;"Perfil do portal";\'Pendências da equipa\'!I6:I;"<>Concluído";\'Pendências da equipa\'!I6:I;"<>Não aplicável")');
      });
      pf.getRange('C2:C4').setNumberFormat('yyyy-mm-dd'); pf.getRange('E2:E4').setNumberFormat('yyyy-mm-dd');
      pf.getRange('F2:F4').setNumberFormat('0'); pf.setRowHeights(2,3,72);
      pf.setFrozenRows(1); pf.getRange('A1:I1').setFontWeight('bold').setBackground('#155c53').setFontColor('#ffffff');
      pf.getRange('A1:I4').setWrap(true); pf.setColumnWidths(1,6,145); pf.setColumnWidths(7,3,280);
      SpreadsheetApp.flush();
      if(pf.getRange('A2:A4').getValues().flat().join('|')!=='idealista|green-acres|rightmove')throw new Error('Conferência do resumo falhou.');
      console.log(JSON.stringify({concluido:true,tarefas:tarefas.length,arquivo:marca}));
    } catch(e) {
      escritos.forEach(function(c){c.clearContent();});
      livres.slice(0,tarefas.length).forEach(function(l){const c=ps.getRange(l,16),antiga=forms[l-6][15];if(antiga)c.setFormula(antiga);else c.clearContent();});
      pf.clearContents(); pf.getRange(1,1,raw.length,raw[0].length).setValues(raw);
      throw new Error('Organização revertida; cópias de segurança preservadas. '+e.message);
    }
  } finally {lock.releaseLock();}
}
