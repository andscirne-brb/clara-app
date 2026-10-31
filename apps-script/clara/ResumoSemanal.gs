/* Relatório derivado: observação, acompanhamento e execução não são equivalentes. */
function rsModelo_(h,lev,pend,hist,inicio,fim){
 ['Referência EGO','Data da verificação','Estado da verificação'].forEach(n=>{if(!h.includes(n))throw Error('Coluna necessária ao resumo: '+n);});
 const norm=v=>String(v||'').trim(),por={},im=ref=>por[ref]||(por[ref]={ref,verificacoes:[],correcoes:[],registos:[],pendente:[],minhas:[],trabalho:[]}),add=(a,t)=>{if(!a.includes(t))a.push(t);},dentro=v=>{const d=dataDe_(v);return d&&d>=inicio&&d<=fim;},col=n=>h.indexOf(n),datas=d=>Utilities.formatDate(d,'Europe/Lisbon','dd/MM/yyyy');
 let novas=0,aSara=0,abertasAndreia=0,confirmadas=0,declaradas=0;const keys=new Set(),campos={},idiomas={},tarefas=new Set();
 function correcao(ref,key,texto,local,validacao,data){if(keys.has(key))return;keys.add(key);im(ref).correcoes.push({texto,local,validacao,data});if(validacao==='Confirmado')confirmadas++;else declaradas++;}
 lev.forEach(r=>{const ref=norm(r[col('Referência EGO')]),data=r[col('Data da verificação')];if(ref&&dentro(data))add(im(ref).verificacoes,(r[col('Estado da verificação')]==='Verificado'?'Ficha conferida no levantamento':'Leitura parcial; faltam verificações')+' · '+data+'.');});
 // Só um local externo explícito e uma realização descrita podem integrar correções.
 hist.forEach((r,i)=>{
  const ref=norm(r[1]);if(!ref||!dentro(r[0]))return;const onde=norm(r[4]),antes=norm(r[6]),depois=norm(r[7]),validacao=norm(r[9]),motivo=norm(r[8]);
  if(/abreviação de estados|simplificação.*pendências|arquivo técnico de pendências/i.test(motivo))return;
  if(['eGO','Idealista','Green-Acres','Rightmove','website','Site da agência'].includes(onde)&&depois&&depois!==antes&&(validacao==='Confirmado'||/^Realizado pela autora/.test(validacao))){
   const campo=norm(r[5]),texto=/descrição|texto|título/i.test(campo)||depois.length>500?'Atualizado: '+(campo||'campo do anúncio')+'.':depois;
   correcao(ref,r[2]?'pend:'+r[2]:'hist:'+i,texto,onde,validacao,r[0]);return;
  }
  const partes=norm(r[5]).split(' · '),folha=partes[0];
  if(folha==='Textos por idioma'&&IDIOMAS[partes[1]]){(idiomas[ref]||(idiomas[ref]=new Set())).add(partes[1]);return;}
  if(onde==='Textos por idioma'){(idiomas[ref]||(idiomas[ref]=new Set())).add('idiomas');return;}
  if(onde===PEND.nome||folha===PEND.nome){tarefas.add(ref);return;}
  if(onde===LEV.nome||folha===LEV.nome){let campo=partes.length>1?partes.slice(1).join(' · '):norm(r[5]);const cel=/^([A-Z]+)\d+$/.exec(campo);if(cel){let c=0;for(const ch of cel[1])c=c*26+ch.charCodeAt(0)-64;campo=h[c-1]||'Estado do levantamento';}(campos[ref]||(campos[ref]=new Set())).add(campo||'Estado do levantamento');}
 });
 pend.forEach(r=>{
  const ref=norm(r[1]);if(!ref)return;const estado=norm(r[8]),assunto=norm(r[3]),responsavel=responsavelPendencia_(r)||'Por atribuir',fechada=['Concluído','Não aplicável','N/A','Arquivado'].includes(estado);
  if(estado==='Concluído'&&dentro(r[12])){
   const resposta=norm(r[11]),explicita=/^Correção realizada(?: (?:no|na) (eGO|Idealista|Green-Acres|Rightmove|website))?:\s*(.+)/i.exec(resposta);
   if(explicita&&r[14]==='Confirmado')correcao(ref,'pend:'+r[0],explicita[2],explicita[1]||'Local não especificado','Declarado pela equipa; sem reverificação independente',r[12]);
   else if(!keys.has('pend:'+r[0]))add(im(ref).verificacoes,'Conclusão registada: '+assunto+'. A alteração concreta no anúncio não está documentada nesta linha.');
   return;
  }
  if(fechada)return;
  const item={id:r[0],assunto,acao:norm(r[5]),responsavel,estado};
  if(responsavel==='Sara'){im(ref).pendente.push(item);aSara++;}else{im(ref).minhas.push(item);if(responsavel==='Andreia')abertasAndreia++;}
  if(responsavel==='Andreia'&&dentro(r[9]))novas++;
 });
 Object.keys(campos).forEach(ref=>add(im(ref).registos,'Registadas alterações no levantamento: '+[...campos[ref]].join(', ')+'.'));
 Object.keys(idiomas).forEach(ref=>add(im(ref).registos,'Registados textos por idioma: '+[...idiomas[ref]].join(', ')+'.'));
 tarefas.forEach(ref=>add(im(ref).registos,'Atualizado o acompanhamento das pendências.'));
 const linhas=Object.values(por).sort((a,b)=>b.pendente.length-a.pendente.length||a.ref.localeCompare(b.ref));
 linhas.forEach(l=>{l.trabalho=l.verificacoes.concat(l.registos);});
 return{de:datas(inicio),ate:datas(fim),linhas,corrigidas:confirmadas+declaradas,correcoesConfirmadas:confirmadas,correcoesDeclaradas:declaradas,verificacoes:linhas.reduce((n,l)=>n+l.verificacoes.length,0),novas,aSara,abertasAndreia};
}
function rsHtml_(r){
 const e=v=>String(v==null?'':v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),td='border:1px solid #d7dde0;padding:8px;vertical-align:top;text-align:left',tabela=(cab,rows,vazio)=>rows.length?'<table style="border-collapse:collapse;width:100%"><thead><tr>'+cab.map(t=>'<th style="'+td+';background:#edf1f2">'+e(t)+'</th>').join('')+'</tr></thead><tbody>'+rows.map(row=>'<tr>'+row.map(t=>'<td style="'+td+'">'+e(t).replace(/\n/g,'<br>')+'</td>').join('')+'</tr>').join('')+'</tbody></table>':'<p>'+e(vazio)+'</p>';
 const correcoes=r.linhas.flatMap(l=>l.correcoes.map(c=>[l.ref,c.texto,c.local+' · '+c.data,c.validacao])),verificacoes=r.linhas.filter(l=>l.verificacoes.length).map(l=>[l.ref,l.verificacoes.join('\n')]),registos=r.linhas.filter(l=>l.registos.length).map(l=>[l.ref,l.registos.join('\n')]);
 const tarefas=prop=>r.linhas.filter(l=>l[prop].length).map(l=>[l.ref,l[prop].map(p=>p.id+' · '+p.assunto+' — '+p.estado+(p.acao?'\n'+p.acao:'')).join('\n\n'),[...new Set(l[prop].map(p=>p.responsavel))].join(', ')]);
 const fim=String(r.ate).split('/').reverse().join('-'),pedido=fim>='2026-10-19'&&fim<='2026-10-25';
 return '<div style="font-family:Arial,sans-serif;font-size:14px;color:#24383f"><p>Olá Sara,</p><p>Ponto de situação de '+e(r.de)+' a '+e(r.ate)+': '+r.corrigidas+' correções com realização documentada, '+r.verificacoes+' registos de verificação/conclusão e '+r.aSara+' pendências para a tua análise.</p>'+
 (r.links?'<p>Consulta o <a href="'+e(r.links.documento)+'">dashboard e os detalhes do documento</a> e as <a href="'+e(r.links.sara)+'">pendências para a Sara'+(r.links.filtrada?' (vista filtrada)':'')+'</a>.</p>':'')+
 '<h3>Correções realizadas — registos do período</h3>'+tabela(['Imóvel','Alteração realizada','Local / data do registo','Validação registada'],correcoes,'Sem correções com realização documentada neste período. Isto não significa que não tenha havido trabalho; as verificações e os registos no Sheets estão separados abaixo.')+
 '<h3>Verificações realizadas</h3>'+tabela(['Imóvel','Verificação ou conclusão registada'],verificacoes,'Sem verificações registadas no período.')+
 '<h3>Pendências para a Sara</h3>'+tabela(['Imóvel','Assunto e próximo passo','Responsável'],tarefas('pendente'),'Sem pendências abertas atribuídas à Sara.')+
 '<h3>Outras pendências da equipa</h3>'+tabela(['Imóvel','Assunto e próximo passo','Responsável'],tarefas('minhas'),'Sem outras pendências abertas.')+
 '<h3>Registos de acompanhamento no Sheets</h3><p>Estes registos não comprovam uma edição no eGO nem uma publicação nos portais.</p>'+tabela(['Imóvel','Registo efetuado'],registos,'Sem atualizações de acompanhamento no período.')+
 '<h3>Seguimento previsto para a próxima semana</h3>'+((r.proximosPassos||[]).length?'<ul>'+r.proximosPassos.map(p=>'<li>'+e(p)+'</li>').join('')+'</ul>':'<p>Planeamento por preencher antes de enviar.</p>')+
 (pedido?'<p><strong>Relatórios de leads do eGO</strong><br>Preciso de acesso aos relatórios com o número de leads diárias e a respetiva origem, sem informação individual de cada lead. Depois de ter acesso, consigo consultá-los autonomamente de quinze em quinze dias.</p>':'')+'<p>Obrigada,<br>Andreia</p></div>';
}
function verificarResumoSemanal(){const r=previewResumo(7,''),v={de:r.de,ate:r.ate,correcoes:r.corrigidas,confirmadas:r.correcoesConfirmadas,declaradas:r.correcoesDeclaradas,verificacoes:r.verificacoes,pendenciasSara:r.aSara,pendenciasAndreia:r.abertasAndreia,vistaSaraFiltrada:r.links.filtrada,somenteLeitura:true,emailEnviado:false};console.log(JSON.stringify(v));return v;}
