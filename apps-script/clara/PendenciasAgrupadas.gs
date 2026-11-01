/* Pendências por tema para imóveis não prioritários (decisão da Andreia, 01/11/2026).
   Os imóveis com Prioridade «Prioritária» (etiqueta «melhora» no eGO) mantêm pendências individuais.
   Para os restantes, o estado de cada imóvel fica no Levantamento e há uma pendência por tema,
   com a contagem e a lista de referências, recalculada a partir do Levantamento. */
const PG_REF = 'Vários imóveis';
const PG_GRUPOS = [
 {chave:'alt',tema:'Imagens',assunto:'Fotos sem texto alternativo (vários imóveis)',sara:false,
  individuais:['Fotos sem texto alternativo'],
  falta:function(g){return g('Alt-text')==='Em falta';},
  acao:'Alt-text e legendas das fotos > eGO. Filtrar o Levantamento por Alt-text = Em falta.'},
 {chave:'video',tema:'Vídeo',assunto:'Vídeo: indicar que imóveis têm vídeo (vários imóveis)',sara:true,
  individuais:['Existe vídeo do imóvel?'],
  falta:function(g){return g('Vídeo')==='Em falta';},
  acao:'Sara: indicar na Resposta quais destes imóveis têm vídeo para carregar e quais não têm. Filtrar o Levantamento por Vídeo = Em falta.'},
 {chave:'planta',tema:'Plantas',assunto:'Plantas em falta ou só em PDF (vários imóveis)',sara:false,
  individuais:['Imóvel sem planta','Planta só em PDF','Planta'],
  falta:function(g){return g('Planta')==='Em falta'||g('Planta')==='Formato errado';},
  acao:'Verif. dossiê > planta em JPG > upload eGO. Filtrar o Levantamento por Planta = Em falta ou Formato errado.'},
 {chave:'textos',tema:'Textos',assunto:'Títulos e descrições noutros idiomas (vários imóveis)',sara:false,
  individuais:['Descrição em inglês em falta','Descrição em francês em falta','Descrição em alemão em falta','Descrição em espanhol em falta','Título em francês em falta','Título em alemão em falta','Título em espanhol em falta'],
  falta:function(g){return ['Descrição EN','Descrição FR','Descrição DE','Descrição ES'].some(function(c){return g(c)==='Em falta';});},
  acao:'Preencher títulos e descrições em falta no eGO. Filtrar o Levantamento por Descrição EN/FR/DE/ES = Em falta; títulos em Textos por idioma.'}
];
function grupoPendenciaClara_(assunto){
 const a=textoCurtoClara_(assunto);
 for(let i=0;i<PG_GRUPOS.length;i++)if(PG_GRUPOS[i].individuais.indexOf(a)>=0)return PG_GRUPOS[i].chave;
 return '';
}
/* Contagem por tema a partir do Levantamento: só imóveis não prioritários. */
function pgContagem_(ss){
 const lev=ss.getSheetByName(LEV.nome),c=colunas_(lev,LEV.titulos);
 ['Referência EGO','Prioridade','Alt-text','Vídeo','Planta','Descrição EN','Descrição FR','Descrição DE','Descrição ES'].forEach(function(h){if(!c.col(h))throw Error('Falta a coluna '+h+' no Levantamento.');});
 const n=lev.getLastRow()-LEV.titulos,vs=n>0?lev.getRange(LEV.titulos+1,1,n,c.titulos.length).getDisplayValues():[];
 const out={},prioritarios={};PG_GRUPOS.forEach(function(g){out[g.chave]=[];});
 vs.forEach(function(r){
  const ref=String(r[c.col('Referência EGO')-1]||'').trim();if(!ref)return;
  if(r[c.col('Prioridade')-1]==='Prioritária'){prioritarios[ref.toUpperCase()]=true;return;}
  const g=function(h){return String(r[c.col(h)-1]||'').trim();};
  PG_GRUPOS.forEach(function(gr){if(gr.falta(g))out[gr.chave].push(ref);});
 });
 return {refs:out,prioritarios:prioritarios};
}
function pgEvidencia_(refs,hoje){
 return refs.length+' imóveis não prioritários (Levantamento, '+Utilities.formatDate(hoje,SpreadsheetApp.getActive().getSpreadsheetTimeZone(),'dd/MM/yyyy')+'): '+refs.join(', ')+'.';
}
function pgRegisto_(ss,linhas){
 if(!linhas.length)return;
 const hs=estrutura_(ss,'Registo de alterações',['Data da alteração','Referência EGO','ID da pendência','Autor','Onde foi alterado','Campo / assunto','Antes','Depois / alteração realizada']);
 const largura=hs.sh.getLastColumn(),inicio=Math.max(hs.sh.getLastRow()+1,hs.linha+1),falta=inicio+linhas.length-1-hs.sh.getMaxRows();
 if(falta>0)hs.sh.insertRowsAfter(hs.sh.getMaxRows(),falta);
 const vs=linhas.map(function(l){const r=new Array(largura).fill('');Object.keys(l).forEach(function(k){const i=hs.col(k);if(i)r[i-1]=l[k];});return r;});
 hs.sh.getRange(inicio,1,vs.length,largura).setValues(vs);
}
/* A conferência (coluna P) exige uma referência do Levantamento; nas linhas de tema a referência é «Vários imóveis». */
function pgFormulaConferencia_(f){
 if(!f||f.indexOf(PG_REF)>=0)return f;
 return f.replace(/COUNTIFS\((Levantamento![^;,()]+)([;,])([^;,()]+)\)<>1/,function(_,range,sep,ref){return 'AND('+ref+'<>"'+PG_REF+'"'+sep+'COUNTIFS('+range+sep+ref+')<>1)';});
}
/* A coluna P é uma coluna calculada da tabela: a alteração tem de ser igual em todas as linhas, como no arquivo técnico. */
function pgGarantirConferencia_(ps,linha,modelo){
 const n=ps.getLastRow()-PEND.titulos;if(n<1)return;
 const rg=ps.getRange(PEND.titulos+1,16,n,1),fs=rg.getFormulasR1C1();
 if(linha>=PEND.titulos+1&&linha<=PEND.titulos+n&&!fs[linha-PEND.titulos-1][0]&&modelo)fs[linha-PEND.titulos-1][0]=modelo;
 let mudou=false;const novas=fs.map(function(r){const f=pgFormulaConferencia_(r[0]);if(f!==r[0])mudou=true;return [f];});
 if(mudou&&novas.every(function(r){return r[0];}))rg.setFormulasR1C1(novas);
 else if(mudou)novas.forEach(function(r,i){if(r[0]&&r[0]!==fs[i][0])ps.getRange(PEND.titulos+1+i,16).setFormulaR1C1(r[0]);});
}
/* Cria ou atualiza as pendências de grupo. Não altera respostas nem notas da equipa. */
function atualizarPendenciasAgrupadas(){
 const lock=LockService.getDocumentLock();if(!lock.tryLock(30000))throw Error('Há outra gravação da Clara em curso. Tenta novamente.');
 try{
  const ss=SpreadsheetApp.getActive(),ps=ss.getSheetByName(PEND.nome),hoje=dataHoje_(),cont=pgContagem_(ss);
  const n=Math.max(1,ps.getLastRow()-PEND.titulos),rg=ps.getRange(PEND.titulos+1,1,n,17),vs=rg.getValues(),fs=rg.getFormulas();
  let maxId=0;vs.forEach(function(r){const m=/^P(\d+)$/.exec(r[0]);if(m)maxId=Math.max(maxId,+m[1]);});
  const livres=[];vs.forEach(function(r,i){if(r.every(function(v,j){return celVazia_(v)||j===15;}))livres.push(i);});
  const formulaP=(fs.find(function(f){return f[15];})||[])[15]?ps.getRange(PEND.titulos+1+fs.findIndex(function(f){return f[15];}),16).getFormulaR1C1():'';
  const log=[],res={};
  PG_GRUPOS.forEach(function(g){
   const refs=cont.refs[g.chave],ev=pgEvidencia_(refs,hoje);
   const i=vs.findIndex(function(r){return r[1]===PG_REF&&r[3]===g.assunto&&r[8]!=='Arquivado';});
   if(i>=0){
    const r=vs[i],linha=PEND.titulos+1+i,aberta=r[8]!=='Concluído'&&r[8]!=='Não aplicável';
    if(!refs.length&&aberta){
     ps.getRange(linha,9).setValue('Concluído');ps.getRange(linha,11).setValue(hoje);ps.getRange(linha,12).setValue('Concluído: nenhum imóvel não prioritário com este tema em falta no Levantamento.');ps.getRange(linha,13).setValue(hoje);
     log.push({'Data da alteração':hoje,'Referência EGO':PG_REF,'ID da pendência':r[0],'Autor':'Clara','Onde foi alterado':PEND.nome,'Campo / assunto':g.assunto+' · Estado','Antes':r[8],'Depois / alteração realizada':'Concluído'});
    }else if(refs.length&&String(r[4])!==ev){
     ps.getRange(linha,5).setValue(ev);ps.getRange(linha,11).setValue(hoje);
     if(!aberta){ps.getRange(linha,9).setValue(g.sara?'A aguardar esclarecimento':'Por tratar');ps.getRange(linha,12).setValue('');ps.getRange(linha,13).setValue('');}
     log.push({'Data da alteração':hoje,'Referência EGO':PG_REF,'ID da pendência':r[0],'Autor':'Clara','Onde foi alterado':PEND.nome,'Campo / assunto':g.assunto+' · Evidência','Antes':String(r[4]).slice(0,200),'Depois / alteração realizada':ev.slice(0,200)});
    }
    pgGarantirConferencia_(ps,linha,formulaP);
    res[g.chave]={id:r[0],imoveis:refs.length};
   }else if(refs.length){
    const k=livres.shift();if(k===undefined)throw Error('Sem linhas livres nas Pendências da equipa.');
    const linha=PEND.titulos+1+k,id='P'+String(++maxId).padStart(4,'0');
    ps.getRange(linha,1,1,15).setValues([[id,PG_REF,g.tema,g.assunto,ev,g.acao,g.sara?'Sara':'Andreia','Normal',g.sara?'A aguardar esclarecimento':'Por tratar',hoje,hoje,'','','eGO','Por verificar']]);
    ps.getRange(linha,17).setValue(g.sara?'Sara':'');
    pgGarantirConferencia_(ps,linha,formulaP);
    log.push({'Data da alteração':hoje,'Referência EGO':PG_REF,'ID da pendência':id,'Autor':'Clara','Onde foi alterado':PEND.nome,'Campo / assunto':g.assunto+' · criada','Antes':'','Depois / alteração realizada':ev.slice(0,200)});
    res[g.chave]={id:id,imoveis:refs.length};
   }else res[g.chave]={id:'',imoveis:0};
  });
  SpreadsheetApp.flush();pgRegisto_(ss,log);
  return res;
 }finally{lock.releaseLock();}
}
/* Migração única: arquiva as pendências individuais abertas dos imóveis não prioritários nos temas agrupados.
   Só arquiva linhas criadas pela Clara sem trabalho humano registado (sem resposta da Sara nem resolução). */
function pgArquivarIndividuais_(simular){
 const grupos=atualizarPendenciasAgrupadas();
 const lock=LockService.getDocumentLock();if(!lock.tryLock(30000))throw Error('Há outra gravação da Clara em curso.');
 try{
  const ss=SpreadsheetApp.getActive(),ps=ss.getSheetByName(PEND.nome),hoje=dataHoje_(),prior=pgContagem_(ss).prioritarios;
  const titulos=ps.getRange(PEND.titulos,1,1,ps.getLastColumn()).getDisplayValues()[0],iResp=titulos.findIndex(function(t){return norm_(t)===norm_('Resposta Sara');});
  const n=ps.getLastRow()-PEND.titulos,vs=ps.getRange(PEND.titulos+1,1,n,Math.max(17,iResp+1)).getValues();
  const alvo=[],log=[];
  vs.forEach(function(r,i){
   const ref=String(r[1]||''),chave=grupoPendenciaClara_(r[3]);
   if(!chave||!ref||ref===PG_REF||prior[ref.toUpperCase()])return;
   /* Plantas usam o fluxo curto: «Em falta» e «Formato errado» são os estados iniciais automáticos; Digitalizado e afins são trabalho em curso. */
   if(['Por tratar','A aguardar esclarecimento'].concat(chave==='planta'?['Em falta','Formato errado']:[]).indexOf(r[8])<0)return;
   if(String(r[11]||'').trim()||(iResp>=0&&String(r[iResp]||'').trim()))return;
   const g=grupos[chave];if(!g||!g.id)return;
   alvo.push({linha:PEND.titulos+1+i,id:r[0],ref:ref,assunto:r[3],estado:r[8],grupo:g.id});
  });
  if(simular)return {arquivar:alvo.length,porTema:alvo.reduce(function(o,a){o[a.assunto]=(o[a.assunto]||0)+1;return o;},{}),grupos:grupos};
  /* Escrita por colunas: Estado (I), Última atualização (K), Motivo (L). */
  const I=ps.getRange(PEND.titulos+1,9,n,1).getValues(),K=ps.getRange(PEND.titulos+1,11,n,1).getValues(),L=ps.getRange(PEND.titulos+1,12,n,1).getValues();
  alvo.forEach(function(a){const k=a.linha-PEND.titulos-1;
   if(I[k][0]!==a.estado||String(L[k][0]||'').trim())throw Error('A pendência '+a.id+' mudou durante a migração. Nada foi arquivado.');
   I[k][0]='Arquivado';K[k][0]=hoje;L[k][0]='Agrupada em '+a.grupo+': acompanhamento por tema; estado do imóvel no Levantamento.';
   log.push({'Data da alteração':hoje,'Referência EGO':a.ref,'ID da pendência':a.id,'Autor':'Clara','Onde foi alterado':PEND.nome,'Campo / assunto':a.assunto+' · Estado','Antes':a.estado,'Depois / alteração realizada':'Arquivado (agrupada em '+a.grupo+')'});
  });
  ps.getRange(PEND.titulos+1,9,n,1).setValues(I);ps.getRange(PEND.titulos+1,11,n,1).setValues(K);ps.getRange(PEND.titulos+1,12,n,1).setValues(L);
  SpreadsheetApp.flush();pgRegisto_(ss,log);
  return {arquivadas:alvo.length,grupos:grupos};
 }finally{lock.releaseLock();}
}
