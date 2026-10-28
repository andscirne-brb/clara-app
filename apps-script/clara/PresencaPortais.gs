/* Presença observada: sem inferir ausência ou publicação atual a partir de históricos. */
function ppData_(v){return typeof v==='string'&&/^20\d\d-\d\d-\d\d$/.test(v)?v:'';}
function ppModelo_(x,ligacoes,fontes){
 return ['Idealista','Green-Acres','Rightmove'].map(portal=>{
  const ls=ligacoes.filter(l=>l[0]===portal&&String(l[3]||'').trim().toUpperCase()===x.ref&&l[4]==='Confirmada'),ids=new Set(ls.map(l=>String(l[1])));
  const out={portal,estado:'Por verificar',data:'',fonte:'Sem observação associada',ambito:'',anuncios:[]};
  if(x.duplicada){out.estado='Referência duplicada; associação bloqueada';return out;}
  if(!ids.size){out.estado='Sem ligação confirmada; presença por verificar';return out;}
  const source=portal==='Idealista'?fontes.idealista:portal==='Green-Acres'?fontes.green:fontes.rightmove;
  const rows=(source||[]).filter(r=>ppData_(String(r[0]||''))&&(portal!=='Idealista'||['lista','ranking','carteira_ativa'].includes(r[1])));
  const ultima=rows.reduce((a,r)=>String(r[0])>a?String(r[0]):a,'');
  out.anuncios=[...ids].map(id=>{
   const match=rows.filter(r=>String(r[portal==='Idealista'?6:3])===id),last=match.reduce((a,r)=>String(r[0])>a?String(r[0]):a,''),recentes=match.filter(r=>String(r[0])===last);
   if(!recentes.length)return{id,data:'',estado:'Ligação histórica sem registo de inventário associado',fonte:'Ligações dos portais',ambito:'Identificação não comprova publicação atual'};
   let fonte,estado,ambito;
   if(portal==='Idealista'){
    const ativa=recentes.some(r=>r[1]==='carteira_ativa'&&r[7]==='ativo'),lista=recentes.some(r=>r[1]==='lista');
    fonte=ativa?'Carteira ativa Idealista':lista?'Lista de imóveis Idealista':'Ranking Idealista';
    estado=ativa?'Observado na carteira publicada na data da recolha':lista?'Observado na lista; publicação por confirmar':'Observado no ranking do período; publicação atual por verificar';
    ambito=[...new Set(recentes.map(r=>String(r[4]||'')+' · '+String(r[9]||'')+(r[2]||r[3]?' · Período '+r[2]+' a '+r[3]:'')))].join(' | ');
   }else if(portal==='Green-Acres'){
    fonte='Lista oficial Green-Acres';estado='Observado na lista na data da recolha';
    ambito=[...new Set(recentes.map(r=>'Estado: '+String(r[5]||'por confirmar')+' · Difusão: '+String(r[6]||'por confirmar')+' · '+String(r[2]||'')+' · '+String(r[17]||'')))].join(' | ');
   }else{
    fonte='Property Performance Rightmove';estado='Observado no relatório; publicação atual por verificar';
    ambito=[...new Set(recentes.map(r=>'Dados até '+String(r[1]||'por confirmar')+' · Janela '+String(r[2]||'por confirmar')+' dias'))].join(' | ');
   }
   if(last<ultima)ambito+=' · Existe uma recolha posterior deste portal ('+ultima+'); confirmar o âmbito antes de concluir ausência.';
   const assinaturas=new Set(recentes.map(r=>String(r[portal==='Idealista'?10:portal==='Green-Acres'?18:14]||'')));
   if(assinaturas.size>1)ambito+=' · Várias recolhas nesta data; confirmar filtros e estados.';
   return{id,data:last,estado,fonte,ambito};
  });
  out.data=out.anuncios.reduce((a,r)=>r.data>a?r.data:a,'');out.estado=out.data?'Há observações datadas; consultar detalhe':'Ligação histórica; presença por verificar';out.fonte='Recolhas associadas por ID confirmado';return out;
 });
}
function verificarPresencaPrioritarios(){const m=consultarAuditoriaPrioritarios(),r={prioritarios:m.quantidade,portais:['Idealista','Green-Acres','Rightmove'].map(portal=>({portal,comObservacao:m.imoveis.filter(x=>x.presenca.some(p=>p.portal===portal&&p.data)).length})),somenteLeitura:true,ausenciasInferidas:0};console.log(JSON.stringify(r));return r;}
