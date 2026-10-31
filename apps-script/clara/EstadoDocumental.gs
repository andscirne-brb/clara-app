/* Seguimento após o levantamento. As notas de dossiê nunca são inferidas do site. */
const ED_CAMPOS = [
  ['caderneta','Caderneta Predial (anexo)','Caderneta Predial'],
  ['certificado','Certificado Energético (anexo)','Certificado Energético'],
  ['contrato','Contrato Mediação (anexo)','Contrato de Mediação'],
  ['licenca','Licença Habitação (anexo)','Licença de Habitação'],
  ['planta','Planta','Planta']
];
const ED_ESTADOS = ['Por verificar','Falta no eGO > ver dossiê','No dossiê > digitalizar','Digitalizado','Falta no eGO + dossiê','Categoria errada','Formato errado','Preenchido','Não aplicável','Em falta'];
function edMotivoCurto_(motivo){const t=String(motivo||'');if(t.startsWith('Desdobrada em pendências'))return 'Separada por documento > ver pendências do imóvel';const m=t.match(/^Duplicada: acompanhamento na pendência (P\d+)/);return m?'Duplicada > ver '+m[1]:'';}
function edPendenciaSubstituida_(r){return r[8]==='Arquivado'||/^(Desdobrada em pendências|Duplicada: acompanhamento na pendência )/.test(String(r[11]||''));}
function edEstadoCompativel_(v){v=String(v||'').replace(/\bdossier\b/gi,'dossiê');return ({'Em falta no eGO · verificar dossiê':'Falta no eGO > ver dossiê','No dossiê · por digitalizar':'No dossiê > digitalizar','Em falta no eGO e no dossiê':'Falta no eGO + dossiê','N/A':'Não aplicável'})[v]||v;}
function edCampoPendencia_(r){
  if(r[2]==='Plantas'&&['Planta','Imóvel sem planta','Planta só em PDF'].includes(r[3]))return ED_CAMPOS[4];
  if(r[2]!=='Documentos')return null;
  const t=String(r[3]||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  const regras=[/caderneta predial/,/certificado energetico/,/contrato.*mediacao/,/licenca.*habitacao/];
  const hits=regras.map((re,i)=>re.test(t)?i:-1).filter(i=>i>=0);return hits.length===1?ED_CAMPOS[hits[0]]:null;
}
function edCampoSimples_(assunto){return {'Imóvel sem fotos':'Imagens','Imóvel sem fotografias':'Imagens','Fotos sem texto alternativo':'Alt-text','Fotografias sem texto alternativo':'Alt-text','Alt-text em falta':'Alt-text','Existe vídeo do imóvel?':'Vídeo','Vídeo em falta':'Vídeo'}[assunto]||'';}
function edEstado_(valor,nota,nome){
  valor=edEstadoCompativel_(valor);
  const linha=String(nota||'').split(/\r?\n/).find(l=>l.startsWith(nome+': '))||'';
  if(valor==='Preenchido'||valor==='Não aplicável')return valor;
  if(/em falta no eGO e no dossiê|Falta no eGO \+ dossiê/i.test(linha))return 'Falta no eGO + dossiê';
  if(ED_ESTADOS.includes(valor)&&valor!=='Por verificar')return valor;
  if(/digitalizado/i.test(linha))return 'Digitalizado';
  if(/por digitalizar|No dossiê > digitalizar/i.test(linha))return 'No dossiê > digitalizar';
  if(valor==='Em falta'||/dossiê por verificar/i.test(linha))return ED_ESTADOS[1];
  return 'Por verificar';
}
function edAcoesAntigas_(){return ['Verif. dossiê > digitalizar > carregar no eGO.','Digitalizar > carregar no eGO.','Carregar no eGO.','Converter para JPG > carregar no eGO.','Procurar no dossiê e inserir no eGO.','Digitalizar, preparar e inserir no eGO.','Preparar o ficheiro digitalizado e inserir no eGO.','Pedir esclarecimento à Sara.','Esclarecer a ausência e disponibilizar o documento.','Preparar o formato correto e inserir no eGO.'];}
function edAcao_(estado,nome){
  return ({'Em falta':'Verif. dossiê > digitalizar > upload eGO','Por verificar':'Confirmar o estado de '+nome+'.','Falta no eGO > ver dossiê':'Verif. dossiê > digitalizar > upload eGO',
    'No dossiê > digitalizar':'Digitalizar > upload eGO','Digitalizado':'Upload eGO',
    'Falta no eGO + dossiê':nome+': falta no eGO + dossiê. Sara: disponibilizar ou indicar onde obter o ficheiro.',
    'Categoria errada':'Mover para a categoria correta no eGO.','Formato errado':nome==='Planta'?'Converter para JPG > upload eGO':'Corrigir formato > carregar no eGO.'})[estado]||'';
}
function edSnapshot_(ref){
  ref=String(ref||'').trim().toUpperCase();if(!ref)throw Error('Indica a referência do imóvel.');
  const ss=SpreadsheetApp.getActive(),sh=ss.getSheetByName(LEV.nome),c=colunas_(sh,LEV.titulos);
  const refs=sh.getRange(LEV.titulos+1,c.col('Referência EGO'),sh.getLastRow()-LEV.titulos,1).getDisplayValues();
  const rows=[];refs.forEach((r,i)=>{if(r[0].trim().toUpperCase()===ref)rows.push(LEV.titulos+1+i);});
  if(rows.length!==1)throw Error(rows.length?'Referência repetida; corrige antes de editar.':'Referência não encontrada no Levantamento.');
  const row=rows[0],values=sh.getRange(row,1,1,c.titulos.length).getDisplayValues()[0];
  const ps=ss.getSheetByName(PEND.nome),pv=ps.getRange(6,1,Math.max(1,ps.getLastRow()-5),ps.getLastColumn()).getDisplayValues();
  const nota=values[c.col('Observações / justificação N/A')-1]||'';
  const estados={};ED_CAMPOS.forEach(x=>{estados[x[0]]=edEstado_(values[c.col(x[1])-1],nota,x[2]);});
  // Um Digitalizado existente tem prioridade sobre a antiga falta genérica.
  pv.filter(r=>r[1]===ref).forEach(r=>{const campo=edCampoPendencia_(r);
    ED_CAMPOS.forEach(x=>{
      if(campo===x&&!edPendenciaSubstituida_(r)&&['Concluído','Não aplicável','Arquivado'].includes(r[8]))estados[x[0]]=r[8]==='Concluído'?'Preenchido':'Não aplicável';
      if(r[8]==='Digitalizado'&&(campo===x||r[2]==='Documentos'&&r[3]==='Documentos obrigatórios sem ficheiro no eGO'&&r[4].includes(x[2]))&&!['Preenchido','Não aplicável'].includes(estados[x[0]]))estados[x[0]]='Digitalizado';
      if(campo===x&&r[6]==='Sara'&&/^(?:O documento|A planta) não está no dossiê\.?$/i.test(String(r[5]||'').trim())&&estados[x[0]]===ED_ESTADOS[1])estados[x[0]]='Falta no eGO + dossiê';
    });
  });
  const assinatura=JSON.stringify([values,pv.filter(r=>r[1]===ref)]);
  return {ss,sh,ps,c,row,values,pv,ref,nota,estados,assinatura};
}
function pesquisarEstadoDocumental(ref){
  const s=edSnapshot_(ref);return{ref:s.ref,linha:s.row,estados:s.estados,assinatura:s.assinatura,website:edWebsite_(s.nota),opcoesWebsite:ED_WEBSITE,campos:ED_CAMPOS.map(x=>({id:x[0],nome:x[2]})),opcoes:ED_ESTADOS};
}
const ED_WEBSITE=['Por verificar','Visível no website','No eGO · não visível no website'];
function edWebsite_(nota){const linha=String(nota||'').split(/\r?\n/).find(l=>l.startsWith('Website: '))||'';return ED_WEBSITE.find(v=>linha.startsWith('Website: '+v+' |'))||'Por verificar';}
function edNotaWebsite_(nota,estado,data){if(!ED_WEBSITE.includes(estado))throw Error('Estado do website não reconhecido.');return String(nota||'').split(/\r?\n/).filter(l=>l&&!l.startsWith('Website: ')).concat('Website: '+estado+' | confirmação manual da equipa em '+data+'.').join('\n');}
function guardarVisibilidadeWebsite(ref,estado,assinatura){
  const lock=LockService.getDocumentLock();if(!lock.tryLock(5000))throw Error('Outra gravação em curso. Tenta novamente.');
  try{const s=edSnapshot_(ref);if(s.assinatura!==assinatura)throw Error('O imóvel foi alterado entretanto. Pesquisa novamente.');if(!ED_WEBSITE.includes(estado))throw Error('Estado do website não reconhecido.');
    if(edWebsite_(s.nota)===estado)return{ref:s.ref,alteracoes:0};
    const data=Utilities.formatDate(new Date(),s.ss.getSpreadsheetTimeZone(),'yyyy-MM-dd');s.websiteMudancas=[{folha:LEV.nome,linha:s.row,col:s.c.col('Observações / justificação N/A'),valor:edNotaWebsite_(s.nota,estado,data)}];
    return edAplicar_(s,{},'visibilidade do website · confirmação manual');
  }finally{lock.releaseLock();}
}
function abrirEstadoDocumental(){SpreadsheetApp.getUi().showSidebar(HtmlService.createHtmlOutput(ESTADO_DOCUMENTAL_HTML).setTitle('Clara · eGO: estado'));}
function edPlano_(s,alteracoes,origem){
  const cambios=[],pend=s.pv.map(r=>r.slice()),estados=Object.assign({},s.estados,alteracoes||{});
  const add=(folha,linha,col,valor)=>{const key=folha+'|'+linha+'|'+col,ex=cambios.find(x=>x.key===key);if(ex)ex.valor=valor;else cambios.push({key,folha,linha,col,valor});};
  Object.keys(s.simples||{}).forEach(campo=>{const col=s.c.col(campo);if(col){add(LEV.nome,s.row,col,s.simples[campo]);s.values[col-1]=s.simples[campo];}});
  let max=pend.reduce((m,r)=>Math.max(m,/^P\d+$/.test(r[0])?+r[0].slice(1):0),0);
  function livre(){let i=pend.findIndex(r=>r.every((v,j)=>!v||j===15));if(i<0){i=pend.length;pend.push(Array(17).fill(''));}return i;}
  function set(i,col,value){pend[i][col-1]=value;add(PEND.nome,i+6,col,value);}
  const fechar=(i,motivo)=>{set(i,9,'Arquivado');set(i,6,edMotivoCurto_(motivo)||pend[i][5]);set(i,12,motivo);set(i,15,'Confirmado');set(i,17,'');};
  let notas=s.nota.split(/\r?\n/);
  ED_CAMPOS.forEach(x=>{
    const estado=estados[x[0]];if(!ED_ESTADOS.includes(estado))throw Error('Estado não reconhecido: '+x[2]);
    // Por verificar não gera trabalho novo só por abrir o painel.
    if(estado==='Por verificar'&&!Object.prototype.hasOwnProperty.call(alteracoes||{},x[0]))return;
    add(LEV.nome,s.row,s.c.col(x[1]),estado==='Não aplicável'?'N/A':estado);
    notas=notas.filter(l=>!l.startsWith(x[2]+': '));
    if(estado!=='Preenchido')notas.push(x[2]+': '+estado+(estado==='Falta no eGO + dossiê'?'; aguarda análise da Sara.':'.'));
    let indices=[];pend.forEach((r,i)=>{const campo=edCampoPendencia_(r);if(r[1]===s.ref&&campo===x&&!edPendenciaSubstituida_(r))indices.push(i);});
    if(indices.length>1)throw Error('Pendências repetidas para '+x[2]+'. Rever antes de sincronizar.');
    let i=indices[0];const fechado=['Preenchido','Não aplicável'].includes(estado);
    if(i===undefined&&fechado)return;
    if(i===undefined){i=livre();[[1,'P'+String(++max).padStart(4,'0')],[2,s.ref],[3,x[0]==='planta'?'Plantas':'Documentos'],[4,x[2]],[8,'Normal'],[14,'eGO']].forEach(v=>set(i,v[0],v[1]));}
    else set(i,4,x[2]);
    const anterior=pend[i],manual=origem==='pendencia',responsavel=estado==='Falta no eGO + dossiê'?'Sara':x[0]==='planta'&&estado==='Formato errado'?'Andreia':manual?anterior[6]||'Andreia':anterior[6]==='Sara'&&anterior[8]==='A aguardar esclarecimento'?'Andreia':anterior[6]||'Andreia';
    const status=estado==='Preenchido'?'Concluído':estado==='Não aplicável'?'Não aplicável':responsavel==='Sara'?'A aguardar esclarecimento':estado==='Digitalizado'?'Digitalizado':anterior[8]==='Em correção'?'Em correção':estado==='Por verificar'?'Por tratar':estado;
    const automaticas=ED_ESTADOS.map(e=>edAcao_(e,x[2])).concat(edAcoesAntigas_()),acaoAnterior=String(anterior[5]||''),manualNota=acaoAnterior.includes('\nNota da equipa: ')?acaoAnterior.split('\nNota da equipa: ').slice(1).join('\nNota da equipa: '):automaticas.includes(acaoAnterior)?'':acaoAnterior;
    set(i,5,x[2]+': '+estado+'.');const instrucao=edAcao_(estado,x[2])+(manualNota?'\nNota da equipa: '+manualNota:'');set(i,6,typeof simplificarAcaoClara_==='function'?simplificarAcaoClara_(instrucao,x[0]==='planta'?'Plantas':'Documentos'):instrucao);set(i,7,responsavel);set(i,9,status);set(i,17,!fechado&&responsavel==='Sara'?'Sara':'');
    if(fechado){set(i,12,'Estado confirmado: '+estado+'.');set(i,15,'Confirmado');}
    else if(['Concluído','Não aplicável','Arquivado'].includes(s.pv[i]&&s.pv[i][8])){set(i,12,'');set(i,13,'');set(i,15,'Por verificar');}
  });
  // Mantém linhas antigas e notas: encerra apenas os agrupamentos substituídos.
  pend.forEach((r,i)=>{
    if(r[1]!==s.ref||['Concluído','Não aplicável','Arquivado'].includes(r[8]))return;
    const agrupado=['Documentos obrigatórios sem ficheiro no eGO','Documentos na categoria errada no eGO'].includes(r[3]);
    if(agrupado&&ED_CAMPOS.slice(0,4).some(x=>r[4].includes(x[2])))fechar(i,'Desdobrada em pendências por documento/planta. Notas e estado anterior conservados no histórico.');
  });
  add(LEV.nome,s.row,s.c.col('Observações / justificação N/A'),notas.filter(Boolean).join('\n'));
  const grupos={};pend.forEach((r,i)=>{const campo=edCampoSimples_(r[3]);if(r[1]===s.ref&&campo&&!['Concluído','Não aplicável','Arquivado'].includes(r[8]))(grupos[campo]||(grupos[campo]=[])).push(i);});
  Object.keys(grupos).forEach(campo=>{const ids=grupos[campo];if(ids.length<2)return;const principal=ids.find(i=>pend[i][17])??ids[0];ids.filter(i=>i!==principal).forEach(i=>fechar(i,'Duplicada: acompanhamento na pendência '+pend[principal][0]+'. Evidência e respostas preservadas nesta linha.'));});
  pend.forEach((r,i)=>{const campo=edCampoSimples_(r[3]);if(r[1]!==s.ref||!campo||['Concluído','Não aplicável','Arquivado'].includes(r[8]))return;
    if(s.values[s.c.col(campo)-1]==='Preenchido'){set(i,9,'Concluído');set(i,12,'Confirmado no Levantamento: '+campo+' preenchido.');set(i,15,'Confirmado');set(i,17,'');}
  });
  const caracteristicas=pend.filter(r=>r[1]===s.ref&&r[2]==='Características'&&r[8]!=='Arquivado');
  if(caracteristicas.length&&caracteristicas.every(r=>['Concluído','Não aplicável','Arquivado'].includes(r[8]))&&s.values[s.c.col('Características')-1]==='Em falta')add(LEV.nome,s.row,s.c.col('Características'),'Preenchido');
  // Conclusão indicada pela equipa: regista a origem humana, sem inventar uma leitura do site.
  pend.forEach((r,i)=>{if(r[1]===s.ref&&r[8]==='Concluído'&&!r[11]){set(i,12,'Conclusão indicada pela equipa. Ação e respostas preservadas na linha.');set(i,15,'Confirmado');}});
  const abertas=pend.filter(r=>r[1]===s.ref&&!['Concluído','Não aplicável','Arquivado'].includes(r[8]));
  const resumo=abertas.map(r=>(r[6]||'Por atribuir')+': '+r[3]+' — '+r[8]+'.').join('\n')||'Sem pendências abertas.';
  add(LEV.nome,s.row,s.c.col('Resumo para a equipa'),resumo);
  return cambios;
}
function edAplicar_(s,alteracoes,origem){
  const mudancas=s.websiteMudancas||edPlano_(s,alteracoes,origem),plano=[],historico=[],hoje=dataHoje_();
  if(s.edicaoManual)historico.push([LEV.nome,s.edicaoManual.celula,s.edicaoManual.antes,s.edicaoManual.depois]);
  const cache={};function linha(sh,row){const key=sh.getName()+'|'+row;if(!cache[key]){const rg=sh.getRange(row,1,1,sh.getLastColumn());cache[key]={v:rg.getValues()[0],f:rg.getFormulas()[0],m:rg.getNumberFormats()[0]};}return cache[key];}
  function carregar(sh,inicio,n){if(!n)return;const rg=sh.getRange(inicio,1,n,sh.getLastColumn()),v=rg.getValues(),f=rg.getFormulas(),m=rg.getNumberFormats();v.forEach((r,i)=>cache[sh.getName()+'|'+(inicio+i)]={v:r,f:f[i],m:m[i]});}
  const hs=estrutura_(s.ss,'Registo de alterações',['Data da alteração','Referência EGO','Autor','Onde foi alterado','Campo / assunto','Antes','Depois / alteração realizada','Motivo / fonte','Resultado da verificação']);
  const alvoMax=Math.max(s.ps.getLastRow(),...mudancas.filter(x=>x.folha===PEND.nome).map(x=>x.linha));
  if(alvoMax>s.ps.getMaxRows())s.ps.insertRowsAfter(s.ps.getMaxRows(),Math.max(200,alvoMax-s.ps.getMaxRows()));
  carregar(s.sh,s.row,1);carregar(s.ps,6,alvoMax-5);
  function agendar(sh,row,col,value,log){
    if(!col)throw Error('Coluna necessária ausente.');const cel=sh.getRange(row,col),snapshot=linha(sh,row),antes=snapshot.v[col-1];
    if(mesmoValor_(antes,value))return;if(snapshot.f[col-1])throw Error('A célula '+cel.getA1Notation()+' contém uma fórmula.');
    plano.push({sh,linha:row,col,cel,antes,depois:value,antesFormato:snapshot.m[col-1]});
    if(log)historico.push([sh.getName(),cel.getA1Notation(),textoHistorico_(antes),textoHistorico_(value)]);
  }
  mudancas.forEach(x=>agendar(x.folha===LEV.nome?s.sh:s.ps,x.linha,x.col,x.valor,true));
  const rows=s.websiteMudancas?[]:[...new Set(plano.filter(p=>p.sh===s.ps).map(p=>p.linha).concat(s.pv.flatMap((r,i)=>r[1]===s.ref&&r[8]==='Concluído'&&!r[12]?[i+6]:[])))];
  rows.forEach(row=>{agendar(s.ps,row,11,hoje,true);if(!linha(s.ps,row).v[9])agendar(s.ps,row,10,hoje,true);
    const estado=mudancas.find(x=>x.folha===PEND.nome&&x.linha===row&&x.col===9),final=estado?estado.valor:linha(s.ps,row).v[8];if(['Concluído','Não aplicável','Arquivado'].includes(final)&&!linha(s.ps,row).v[12])agendar(s.ps,row,13,hoje,true);
  });
  if(!plano.length&&!historico.length)return{ref:s.ref,alteracoes:0};
  const start=hs.sh.getLastRow()+1;if(start+historico.length>hs.sh.getMaxRows())hs.sh.insertRowsAfter(hs.sh.getMaxRows(),Math.max(200,start+historico.length-hs.sh.getMaxRows()));
  carregar(hs.sh,start,historico.length);
  historico.forEach((h,i)=>{const v={'Data da alteração':hoje,'Referência EGO':s.ref,'Autor':'Equipa','Onde foi alterado':h[0],'Campo / assunto':h[1],'Antes':h[2],'Depois / alteração realizada':h[3],'Motivo / fonte':'Seguimento documental · '+origem,'Resultado da verificação':'Confirmado'};Object.keys(v).forEach(k=>{if(hs.col(k))agendar(hs.sh,start+i,hs.col(k),v[k],false);});});
  const lotes=lotesGravacaoClara_(plano),aplicados=[];conferirLotesClara_(lotes,true);
  try{lotes.forEach(l=>{aplicados.push(l);escreverLoteClara_(l,false);});SpreadsheetApp.flush();conferirLotesClara_(lotes,false);}
  catch(e){let falha=false;aplicados.reverse().forEach(l=>{try{escreverLoteClara_(l,true);}catch(_){falha=true;}});SpreadsheetApp.flush();throw Error((falha?'A recuperação ficou incompleta. Consulta o histórico de versões. ':'Alterações repostas. ')+e.message);}
  return{ref:s.ref,alteracoes:historico.length};
}
function guardarEstadoDocumental(ref,estados,assinatura){
  const lock=LockService.getDocumentLock();if(!lock.tryLock(5000))throw Error('Outra gravação está em curso. Tenta novamente.');
  try{const s=edSnapshot_(ref);if(s.assinatura!==assinatura)throw Error('O imóvel foi alterado entretanto. Pesquisa novamente antes de guardar.');
    const patch={};ED_CAMPOS.forEach(x=>{if(!estados||!ED_ESTADOS.includes(estados[x[0]]))throw Error('Confirma os cinco estados.');if(estados[x[0]]!==s.estados[x[0]])patch[x[0]]=estados[x[0]];});
    return edAplicar_(s,patch,'painel');
  }finally{lock.releaseLock();}
}
function edSincronizarEdicao_(e){
  const r=e.range,nome=r.getSheet().getName();if(![LEV.nome,PEND.nome].includes(nome))return;
  if(PropertiesService.getDocumentProperties().getProperty('CLARA_SEGUIMENTO_DOCUMENTAL')!=='1')return;
  if(nome===LEV.nome&&(r.getLastRow()<10||r.getColumn()>24))return;
  if(nome===PEND.nome&&(r.getLastRow()<6||r.getColumn()>9||r.getLastColumn()<7))return;
  const lock=LockService.getDocumentLock();if(!lock.tryLock(5000))throw Error('Outra gravação está em curso. Volta a guardar pelo painel para sincronizar.');
  try{
    const refs=new Set(),patches={},simples={};
    if(nome===LEV.nome){
      const c=colunas_(r.getSheet(),9);for(let row=Math.max(10,r.getRow());row<=r.getLastRow();row++){
        const ref=r.getSheet().getRange(row,c.col('Referência EGO')).getDisplayValue();if(!ref)continue;refs.add(ref);patches[ref]={};
        ED_CAMPOS.forEach(x=>{const col=c.col(x[1]);if(col>=r.getColumn()&&col<=r.getLastColumn())patches[ref][x[0]]=edEstado_(r.getSheet().getRange(row,col).getDisplayValue(),'',x[2]);});
      }
    }else{
      for(let row=Math.max(6,r.getRow());row<=r.getLastRow();row++){
        const v=r.getSheet().getRange(row,1,1,17).getDisplayValues()[0];if(!v[1])continue;refs.add(v[1]);
        const x=edCampoPendencia_(v);
        if(x&&r.getColumn()<=9&&r.getLastColumn()>=9){const status=v[8],etat=status==='Concluído'?'Preenchido':ED_ESTADOS.includes(status)?status:null;
          if(etat)(patches[v[1]]||(patches[v[1]]={}))[x[0]]=etat;
        }
        const campo=edCampoSimples_(v[3]);
        if(campo&&r.getColumn()<=9&&r.getLastColumn()>=9&&['Concluído','Não aplicável'].includes(v[8]))(simples[v[1]]||(simples[v[1]]={}))[campo]=v[8]==='Concluído'?'Preenchido':'Não aplicável';
      }
    }
    const lev=e.source.getSheetByName(LEV.nome),lc=colunas_(lev,9),conhecidas=new Set(lev.getRange(10,lc.col('Referência EGO'),lev.getLastRow()-9,1).getDisplayValues().flat());
    refs.forEach(ref=>{if(!conhecidas.has(ref))return;const s=edSnapshot_(ref);s.simples=simples[ref];
      if(nome===LEV.nome&&r.getNumRows()===1&&r.getNumColumns()===1&&e.value!==undefined)s.edicaoManual={celula:r.getA1Notation(),antes:e.oldValue===undefined?'':String(e.oldValue),depois:String(e.value)};
      edAplicar_(s,patches[ref]||{},nome===PEND.nome?'pendencia':'levantamento');});
  }finally{lock.releaseLock();}
}
function prepararSeguimentoDocumental(){
  const ss=SpreadsheetApp.getActive(),sh=ss.getSheetByName(LEV.nome),c=colunas_(sh,9);
  const valores=ED_ESTADOS.map(v=>v==='Não aplicável'?'N/A':v),ps=ss.getSheetByName(PEND.nome);
  edConfigurarDropdowns_(ss,ED_CAMPOS.map(x=>({nome:LEV.nome,col:c.col(x[1]),opcoes:valores,substituir:true})).concat([{nome:PEND.nome,col:9,opcoes:[...new Set(['Por tratar','Em correção','A aguardar esclarecimento','Concluído','Arquivado'].concat(ESTADOS_VIDEO_CLARA,ED_ESTADOS.filter(x=>x!=='Preenchido')))]}]));
  PropertiesService.getDocumentProperties().setProperty('CLARA_SEGUIMENTO_DOCUMENTAL','1');
  const refs=ps.getRange(6,2,ps.getLastRow()-5,1).getDisplayValues().flat().filter(Boolean);
  const ls=sh.getRange(10,1,sh.getLastRow()-9,c.titulos.length).getDisplayValues();
  ls.forEach(r=>{if(/dossiê|digitalizado/i.test(r[c.col('Observações / justificação N/A')-1]||''))refs.push(r[c.col('Referência EGO')-1]);});
  const conhecidas=new Set(ls.map(r=>r[c.col('Referência EGO')-1]));
  PropertiesService.getDocumentProperties().setProperty('CLARA_MIGRAR_DOCUMENTOS',JSON.stringify([...new Set(refs)].filter(r=>conhecidas.has(r))));
  console.log('Estados disponíveis; registos existentes preservados.');
}
// A API de tabelas é necessária: Range.setDataValidation recusa colunas tipadas.
// Usa só o documento ativo e a autorização Google já concedida; nunca regista o token.
function edSheets_(ss,sufixo,payload){
  const opt={headers:{Authorization:'Bearer '+ScriptApp.getOAuthToken()},muteHttpExceptions:true};
  if(payload){opt.method='post';opt.contentType='application/json';opt.payload=JSON.stringify(payload);}
  const res=UrlFetchApp.fetch('https://sheets.googleapis.com/v4/spreadsheets/'+ss.getId()+sufixo,opt),data=JSON.parse(res.getContentText());
  if(res.getResponseCode()>=300)throw Error('Configuração das tabelas: '+(data.error&&data.error.message||res.getResponseCode()));return data;
}
function edConfigurarDropdowns_(ss,alvos){
  const meta=edSheets_(ss,'?fields=sheets(properties(sheetId,title),tables)'),requests=[],fora=[];
  const tabelas=new Map();
  alvos.forEach(a=>{const s=meta.sheets.find(s=>s.properties.title===a.nome);if(!s)throw Error('Folha não encontrada.');
    const tab=(s.tables||[]).find(t=>a.col-1>=(t.range.startColumnIndex||0)&&a.col-1<t.range.endColumnIndex);
    if(!tab){fora.push(a);return;}const key=tab.tableId;
    if(!tabelas.has(key))tabelas.set(key,JSON.parse(JSON.stringify(tab)));
    const t=tabelas.get(key),index=a.col-1-(t.range.startColumnIndex||0),cp=t.columnProperties.find(c=>c.columnIndex===index);
    if(!cp)throw Error('Coluna da tabela não encontrada.');
    const old=cp.dataValidationRule&&cp.dataValidationRule.condition&&cp.dataValidationRule.condition.values||[];
    const values=a.substituir?a.opcoes:[...new Set(old.map(v=>v.userEnteredValue).concat(a.opcoes))];
    cp.columnType='DROPDOWN';cp.dataValidationRule={condition:{type:'ONE_OF_LIST',values:values.map(v=>({userEnteredValue:v}))}};
  });
  tabelas.forEach(t=>requests.push({updateTable:{table:{tableId:t.tableId,columnProperties:t.columnProperties},fields:'columnProperties'}}));
  if(requests.length)edSheets_(ss,':batchUpdate',{requests});
  fora.forEach(a=>{const sh=ss.getSheetByName(a.nome),start=a.nome===LEV.nome?10:6;sh.getRange(start,a.col,sh.getMaxRows()-start+1,1).setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(a.opcoes,true).setAllowInvalid(false).build());});
}
function edFormula_(f){
  if(typeof arFormula_==='function')f=arFormula_(f);
  f=f.replace(/"Em falta no eGO · verificar dossiê"/g,'"Falta no eGO > ver dossiê"').replace(/"No dossiê · por digitalizar"/g,'"No dossiê > digitalizar"').replace(/"Em falta no eGO e no dossiê"/g,'"Falta no eGO + dossiê"');
  if(!f.includes('PendenciasEquipe['))f=f.replace(/"Não aplicável"/g,'"N/A"');
  else f=f.replace(/"N\/A"/g,'"Não aplicável"');
  let quoted=false,semi=false,normal='';
  for(let i=0;i<f.length;i++){const ch=f[i];if(ch==='"'){if(quoted&&f[i+1]==='"'){normal+='""';i++;continue;}quoted=!quoted;}if(!quoted&&ch===';')semi=true;normal+=!quoted&&ch===';'?',':ch;}
  f=normal;
  const estados=['Em falta','Digitalizado','No dossiê > digitalizar','Falta no eGO > ver dossiê','Falta no eGO + dossiê','Categoria errada','Formato errado'];
  f=f.replace(/COUNTIFS\((N\d+:S\d+),"Em falta"\)/g,(_,r)=>'('+estados.map(s=>'COUNTIF('+r+',"'+s+'")').join('+')+')');
  f=f.replace(/IF\(([NOPQR]\d+)="Em falta",/g,(_,c)=>'IF(OR('+estados.map(s=>c+'="'+s+'"').join(',')+'),');
  if(f.includes('PendenciasEquipe[Estado]')&&!f.includes('"Digitalizado"')){
    const ref=(f.match(/IF\((A\d+)=""/)||[])[1];
    if(ref){const abertos=estados.filter(x=>x!=='Digitalizado').map(x=>'COUNTIFS(PendenciasEquipe[Referência EGO],'+ref+',PendenciasEquipe[Estado],"'+x+'")').join('+');f=f.replace('"Rever estado"','IF(COUNTIFS(PendenciasEquipe[Referência EGO],'+ref+',PendenciasEquipe[Estado],"Digitalizado")>0,"Digitalizado",IF('+abertos+'>0,"Por tratar","Rever estado"))');}
  }
  if(semi){let q=false,out='';for(let i=0;i<f.length;i++){const ch=f[i];if(ch==='"'){if(q&&f[i+1]==='"'){out+='""';i++;continue;}q=!q;}out+=ch===','&&!q?';':ch;}return out;}
  return f;
}
function atualizarFormulasSeguimento(){
  const sh=SpreadsheetApp.getActive().getSheetByName(LEV.nome),c=colunas_(sh,9),n=sh.getLastRow()-9;
  ['Categorias com faltas','Categorias identificadas','Estado das correções'].forEach(t=>{const col=c.col(t),rg=sh.getRange(10,col,n,1),fs=rg.getFormulas();
    let inicio=-1,bloco=[];function flush(){if(bloco.length)sh.getRange(inicio+10,col,bloco.length,1).setFormulas(bloco);inicio=-1;bloco=[];}
    fs.forEach((r,i)=>{const novo=edFormula_(r[0]);if(r[0]&&novo!==r[0]){if(inicio<0)inicio=i;bloco.push([novo]);}else flush();});flush();
  });
  console.log('Fórmulas de acompanhamento atualizadas.');
}
function migrarSeguimentoDocumental(){
  const lock=LockService.getDocumentLock();if(!lock.tryLock(5000))throw Error('Outra gravação em curso.');
  try{const p=PropertiesService.getDocumentProperties(),refs=JSON.parse(p.getProperty('CLARA_MIGRAR_DOCUMENTOS')||'[]'),done=[];
    for(let i=0;i<4&&refs.length;i++){const ref=refs[0];edAplicar_(edSnapshot_(ref),{},'migração dos estados existentes');refs.shift();done.push(ref);p.setProperty('CLARA_MIGRAR_DOCUMENTOS',JSON.stringify(refs));}
    const r={atualizados:done,restantes:refs.length};console.log(JSON.stringify(r));return r;
  }finally{lock.releaseLock();}
}
