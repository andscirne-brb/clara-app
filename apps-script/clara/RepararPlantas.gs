/* Reparação dirigida e auditada. Não faz varrimento nem apaga histórico. */
function planoRepararPlantas_(s){
 const rows=s.pv.map(r=>r.slice()),atual=s.values[s.c.col('Planta')-1];
 const originais=rows.map((r,i)=>({r,i})).filter(x=>x.r[1]===s.ref&&x.r[2]==='Plantas'&&x.r[3]==='Planta'&&!edPendenciaSubstituida_(x.r));
 if(originais.length!==1)throw Error('É necessária uma única pendência original de planta.');
 const original=originais[0],estado=edEstadoCompativel_(original.r[8]);
 if(!['Falta no eGO > ver dossiê','No dossiê > digitalizar','Digitalizado','Falta no eGO + dossiê','Categoria errada','Formato errado'].includes(estado))throw Error('O estado original exige revisão manual.');
 const duplas=rows.map((r,i)=>({r,i})).filter(x=>x.r[1]===s.ref&&x.r[2]==='Plantas'&&x.r[3]==='Imóvel sem planta'&&!edPendenciaSubstituida_(x.r));
 if(!duplas.length){if(atual===estado)return[];throw Error('Não há duplicado reconhecido; não alterar automaticamente.');}
 if(atual!=='Em falta'&&atual!==estado)throw Error('A planta foi alterada entretanto; não restaurar automaticamente.');
 duplas.forEach(x=>{if(x.r[8]!=='Por tratar'||x.r[11]||x.r[12]||x.r[17]||!String(x.r[4]||'').startsWith('O site não mostra planta')||x.r[5]!=='Carregar a planta em imagem (JPG) no eGO.')throw Error('A pendência adicional tem alterações ou respostas; rever manualmente.');});
 const changes=[],add=(folha,linha,col,valor)=>changes.push({folha,linha,col,valor});
 add(LEV.nome,s.row,s.c.col('Planta'),estado);
 const nota=String(s.nota||'').split(/\r?\n/).filter(l=>l&&!l.startsWith('Planta: ')).concat('Planta: '+estado+'.').join('\n');
 add(LEV.nome,s.row,s.c.col('Observações / justificação N/A'),nota);
 duplas.forEach(x=>{const motivo='Duplicada: acompanhamento na pendência '+original.r[0]+'. Encerrada na reparação de leitura pública; evidência e responsável preservados.';
   [[9,'Não aplicável'],[11,dataHoje_()],[12,motivo],[15,'Confirmado'],[17,'']].forEach(v=>{rows[x.i][v[0]-1]=v[1];add(PEND.nome,x.i+6,v[0],v[1]);});
 });
 const abertas=rows.filter(r=>r[1]===s.ref&&!['Concluído','Não aplicável'].includes(r[8]));
 add(LEV.nome,s.row,s.c.col('Resumo para a equipa'),abertas.map(r=>(r[6]||'Por atribuir')+': '+r[3]+' — '+r[8]+'.').join('\n')||'Sem pendências abertas.');
 return changes;
}
function repararSeguimentoPlantas(){
 const ui=SpreadsheetApp.getUi(),r=ui.prompt('Reparar seguimento das plantas','Indica apenas as referências a reparar, separadas por vírgula (máximo duas). A operação preserva as linhas e regista as alterações.',ui.ButtonSet.OK_CANCEL);
 if(r.getSelectedButton()!==ui.Button.OK)return;
 const refs=Array.from(new Set(r.getResponseText().split(',').map(x=>x.trim().toUpperCase()).filter(Boolean)));
 if(!refs.length||refs.length>2||refs.some(x=>!/^\w{2,5}\d+$/.test(x)))throw Error('Indica uma ou duas referências válidas.');
 const lock=LockService.getDocumentLock();if(!lock.tryLock(5000))throw Error('Outra gravação está em curso.');
 const resultados=[];try{
   // Preflight de todos os alvos antes de qualquer alteração.
   const planos=refs.map(ref=>{const s=edSnapshot_(ref);return{s,mudancas:planoRepararPlantas_(s)};});
   planos.forEach(p=>{if(!p.mudancas.length){resultados.push({ref:p.s.ref,alteracoes:0});return;}p.s.websiteMudancas=p.mudancas;resultados.push(edAplicar_(p.s,{},'reparação dirigida de plantas após leitura pública'));});
 }catch(e){throw Error('Reparação interrompida. Referências já processadas: '+resultados.map(x=>x.ref).join(', ')+'. '+e.message);}finally{lock.releaseLock();}
 console.log(JSON.stringify({reparacao:'plantas',referencias:resultados.length,alteracoes:resultados.map(x=>x.alteracoes)}));
 ui.alert('Reparação concluída. '+resultados.length+' referências conferidas. Linhas e histórico preservados.');
}
