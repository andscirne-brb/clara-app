/* Comparação nominal histórica. Não assume mesma operação, preço atual ou erro comercial. */
function cpPreco_(v){return typeof v==='number'&&isFinite(v)&&v>0?v:null;}
function cpPrecoOrigem_(v){if(typeof v==='string'&&/^\d+(?:\.\d{1,2})?$/.test(v.trim()))return cpPreco_(Number(v.trim()));return cpPreco_(v);}
function cpDataFonte_(texto){const iso=String(texto).match(/\b(20\d\d-\d\d-\d\d)\b/);if(iso)return iso[1];const m=String(texto).toLowerCase().match(/(\d{1,2})(jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)(20\d\d)/);return m?m[3]+'-'+String(['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'].indexOf(m[2])+1).padStart(2,'0')+'-'+m[1].padStart(2,'0'):'';}
function cpModelo_(imovel,origem,ligacoes,fontes){
 const ref=imovel.ref,originais=origem.rows.filter(r=>String(r[0]||'').trim().toUpperCase()===ref),e=originais.length===1?originais[0]:null;
 const precos=e?['Venda','Trespasse','Arrendamento','Permuta'].flatMap((operacao,i)=>cpPrecoOrigem_(e[3+i])!==null?[{operacao,valor:cpPrecoOrigem_(e[3+i])}]:[]):[],base=precos.length===1?precos[0]:null;
 const out={fonteEgo:origem.fonte,dataEgo:origem.data,natureza:e?String(e[1]||''):'',concelho:e?String(e[7]||''):'',precos,estadoBase:originais.length>1?'Referência repetida na origem eGO':!e?'Sem referência na origem eGO':!base?'Sem preço único eGO para comparar':'Base histórica; confirmar operação e preço atual',portais:[],limites:'Áreas e tipologia não têm fontes estruturadas compatíveis. Localidade do portal não é automaticamente equivalente ao concelho eGO. Preço zero ou não numérico não é interpretado como preço de venda.'};
 ['Idealista','Green-Acres','Rightmove'].forEach(portal=>{
  const ls=ligacoes.filter(l=>l[0]===portal&&String(l[3]||'').trim().toUpperCase()===ref&&l[4]==='Confirmada');
  if(imovel.duplicada||!ls.length){out.portais.push({portal,estado:imovel.duplicada?'Referência eGO duplicada; comparação bloqueada':'Sem ligação confirmada',preco:null});return;}
  ls.forEach(l=>{
   const id=String(l[1]),source=portal==='Green-Acres'?fontes.green:portal==='Rightmove'?fontes.rightmove:[],rows=source.filter(r=>String(r[3])===id&&(portal!=='Rightmove'||Number(r[2])===30)),date=r=>String(r[0]||''),last=rows.reduce((a,r)=>date(r)>a?date(r):a,'');
   const latest=rows.filter(r=>date(r)===last),col=portal==='Green-Acres'?8:6,valid=latest.map(r=>cpPreco_(r[col])),unique=[...new Set(valid)],price=unique.length===1?unique[0]:null;
   const estado=!rows.length?'Sem preço recolhido':unique.length!==1?'Valores em conflito na mesma data':price===null?'Preço por confirmar':!base||!origem.data?'Base eGO insuficiente':price===base.valor?'Valor nominal igual; confirmar atualidade e operação':'Valores diferentes; confirmar datas e operação';
   out.portais.push({portal,id,preco:price,recolha:last,dadosAte:portal==='Rightmove'&&latest.length?String(latest[0][1]||''):'',localidade:latest.length?String(latest[0][portal==='Green-Acres'?9:5]||''):'',estado,operacaoEgo:base?base.operacao:'',precoEgo:base?base.valor:null,diferenca:price!==null&&base&&origem.data?price-base.valor:null,fonte:portal==='Idealista'?'Recolhas atuais sem preço estruturado':portal==='Green-Acres'?'Lista oficial Green-Acres':'Property Performance · janela de 30 dias'});
  });
 });return out;
}
function verificarComparacaoPrioritarios(){const m=consultarAuditoriaPrioritarios(),comparacoes=m.imoveis.flatMap(x=>x.comparacao.portais),r={prioritarios:m.quantidade,baseEgo:m.imoveis[0]&&m.imoveis[0].comparacao.dataEgo,precosRecolhidos:comparacoes.filter(p=>p.preco!==null&&p.preco!==undefined).length,comparacoesNominais:comparacoes.filter(p=>typeof p.diferenca==='number').length,diferencasNominais:comparacoes.filter(p=>typeof p.diferenca==='number'&&p.diferenca!==0).length,somenteLeitura:true};console.log(JSON.stringify(r));return r;}
function cpEnriquecer_(ss,m,ligacoes){
 const s=ss.getSheetByName('Origem EGO');let origem={rows:[],fonte:'Origem EGO indisponível',data:''};
 if(s){const h=s.getRange(4,1,1,11).getDisplayValues()[0],esperado=['Referência','Natureza','Disponibilidade','Venda (€)','Trespasse (€)','Arrendamento (€)','Permuta (€)','Concelho'];if(esperado.some((v,i)=>h[i]!==v))origem.fonte='Estrutura de Origem EGO por confirmar';else{const fonte=s.getRange(3,1).getDisplayValue();origem={fonte,data:cpDataFonte_(fonte),rows:s.getLastRow()>4?s.getRange(5,1,s.getLastRow()-4,11).getValues():[]};}}
 const data=(n,w,headers)=>ipTabela_(ss,n,w,headers).map(r=>r.map((v,i)=>v instanceof Date?ipData_(v):v)),fontes={green:data('Green-Acres - anúncios',20,GA_ANUNCIOS_HEADERS),rightmove:data('Rightmove - desempenho',16,RM_PERF_HEADERS)};
 m.imoveis.forEach(x=>x.comparacao=cpModelo_(x,origem,ligacoes,fontes));m.limites[0]='Preços: comparação nominal com a exportação eGO datada. Diferenças requerem confirmação da operação e atualidade; áreas e tipologia continuam por avaliar.';return m;
}
