/* Usa os separadores oficiais e repõe o gráfico; não inventa ligações de exportação. */
async function recolherConjuntoIdealista(doc,geral,ui){
 const blocos=[],faltas=[],contexto={url:geral.url,lido:geral.lido},base=JSON.stringify(geral);
 const pausa=ms=>new Promise(r=>setTimeout(r,ms));
 const tab=nome=>Array.from(doc.querySelectorAll('a[data-typology]')).find(a=>a.getAttribute('data-typology')===nome);
 async function esperar(tipo){let anterior='',iguais=0,erro;for(let i=0;i<45;i++){try{const d=recolherIdealista(doc,contexto),sig=JSON.stringify(d);iguais=sig===anterior?iguais+1:0;anterior=sig;if(d.tipo===tipo&&iguais>=2)return d;}catch(e){erro=e;}await pausa(200);}throw erro||Error('O separador do Idealista não terminou de carregar.');}
 ui.estado('1 de 2 · Estatísticas, contactos diários e carteira ativa…');
 try{await recolherDiariosIdealista(doc,geral);}catch(e){geral.avisoSerie=String(e.message||e);}
 try{geral.carteiraAtiva=await recolherAtivosIdealista(doc,geral,ui);}catch(e){geral.avisoCarteira=String(e.message||e);}
 geral.marcadorVersao='20261028.2';blocos.push({nome:'estatisticas',texto:'CLARA2:'+JSON.stringify(geral)});
 let restaurado=false;
 try{
  const ranking=tab('ranking'),grafico=tab('graph');if(!ranking||!grafico)throw Error('Não encontrei os separadores oficiais do gráfico e ranking.');
  ui.estado('2 de 2 · A abrir o ranking e obter o Excel oficial…');ranking.click();const d=await esperar('ranking');
  if(d.periodo.inicio!==geral.periodo.inicio||d.periodo.fim!==geral.periodo.fim)throw Error('O ranking apresenta um período diferente das estatísticas.');
  const excel=await recolherExcelIdealista(doc,d,ui);if(excel.fonte!=='Excel oficial Idealista')throw Error('O Excel oficial não ficou disponível. O ranking parcial não foi usado.');
  excel.marcadorVersao='20261028.2';blocos.push({nome:'ranking',texto:'CLARA2:'+JSON.stringify(excel)});
 }catch(e){faltas.push({nome:'ranking',erro:String(e.message||e).slice(0,600)});}
 finally{const grafico=tab('graph');if(grafico){grafico.click();try{const depois=await esperar('geral');restaurado=JSON.stringify(depois)===base;}catch(e){restaurado=false;}}}
 if(!restaurado)throw Error('Não consegui confirmar o gráfico e os filtros iniciais no fim da recolha. Volta ao Gráfico e recolhe novamente.');
 return{v:6,origem:'idealista',tipo:'conjunta',marcadorVersao:'20261028.2',lido:geral.lido,blocos,faltas};
}
