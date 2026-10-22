function recolherIdealista(doc, contexto) {
  const txt = e => e ? e.textContent.replace(/\s+/g, ' ').trim() : '';
  const numero = s => /^\d[\d .]*%?$/.test(String(s).trim()) ? Number(String(s).replace(/[ .%]/g, '')) : null;
  const visivel = e => !!e && !e.hidden && (!e.getClientRects || e.getClientRects().length > 0);
  const body = doc.body.innerText || doc.body.textContent;
  const data = s => { const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s || ''); return m ? m[3]+'-'+m[2]+'-'+m[1] : null; };
  const out = {v:2,origem:'idealista',tipo:'',lido:contexto.lido,url:contexto.url,periodo:{inicio:null,fim:null},filtros:[],cobertura:'Parcial: apenas a página aberta',registos:[]};
  out.filtros = Array.from(doc.querySelectorAll('a.actived, a.active, button.dropdown-wrapper .placeholder')).filter(visivel).map(txt).filter(s=>s && s.length<80 && !/[-錄]/.test(s)).filter((s,i,a)=>a.indexOf(s)===i);
  const relativo=out.filtros.find(s=>/^(Hoje|7 dias|30 dias|90 dias)$/.test(s));
  if(relativo)out.periodo.etiqueta=relativo;
  const dates = /de (\d{2}\/\d{2}\/\d{4}) até (\d{2}\/\d{2}\/\d{4})/.exec(body);
  if (dates) Object.assign(out.periodo,{inicio:data(dates[1]),fim:data(dates[2])});
  const contact = doc.querySelector('a[href*="fromDate="][href*="toDate="]');
  if(contact){const u=new URL(contact.getAttribute('href'),contexto.url);Object.assign(out.periodo,{inicio:data(u.searchParams.get('fromDate')),fim:data(u.searchParams.get('toDate'))});}
  if (/\/tools\/listadostarter/.test(contexto.url)) {
    out.tipo='lista';
    out.filtros=Array.from(doc.querySelectorAll('a.icon-arrow-dropdown')).filter(visivel).map(txt).filter(Boolean);
    const pesquisa=doc.querySelector('input[placeholder="Referência, rua, localidade, etc..."]');if(pesquisa&&pesquisa.value.trim())out.filtros.push('Pesquisa: '+pesquisa.value.trim());
    if(!out.filtros.length)out.filtros=['Filtros da lista não identificados'];
    const pagina=new URL(contexto.url).searchParams.get('CurrentPage');if(pagina&&/^\d+$/.test(pagina))out.cobertura+=' · página '+pagina;
    out.registos=Array.from(doc.querySelectorAll('ul.row[data-key]')).filter(visivel).map(r=>{
      const cols=Array.from(r.children), ref=txt(r.querySelector('.exteral-ref')).replace(/^Ref\s+/,'');
      return {id:r.getAttribute('data-key'),ref:ref,metricas:{qualidade:numero(txt(r.querySelector('.quality-info-col svg text')))},publicacao:cols[8]?cols[8].innerText.trim():'',rendimento:cols[10]?cols[10].innerText.trim():'',aviso:Array.from(r.querySelectorAll('[title]')).some(e=>e.getAttribute('title')==='Validação pendente')?'Validação pendente':''};
    });
  } else if (/\/stats\/rank\/neighborhood/.test(contexto.url) || Array.from(doc.querySelectorAll('h2')).some(e=>/^ranking\s/i.test(txt(e)))) {
    out.tipo=/\/stats\/rank\/neighborhood/.test(contexto.url)?'zona':'ranking';
    out.registos=Array.from(doc.querySelectorAll('table tr')).filter(visivel).map(r=>{
      const c=Array.from(r.querySelectorAll('td')); if(c.length!==9)return null;
      const a=r.querySelector('a[href*="/tools/propiedad/"],a[href*="/imovel/"]'), m=a&&/\/(?:propiedad|imovel)\/(\d+)/.exec(a.getAttribute('href'));
      const n=c.slice(2).map(e=>numero(txt(e)));if(n.some(x=>x===null))return null;
      return {id:m?m[1]:'',ref:'',posicao:numero(txt(c[0])),metricas:{visitasListas:n[0],visitasDetalhes:n[1],partilhas:n[2],alertas:n[3],favoritos:n[4],chamadas:n[5],mensagens:n[6]}};
    }).filter(Boolean);
    if(out.tipo==='zona')out.cobertura='Comparativo da zona: apenas os resultados visíveis; não é a carteira da agência';
  } else if (/\/stats\/loadImpactStats/.test(contexto.url)) {
    out.tipo='geral';out.cobertura='Totais visíveis da carteira no período e filtros selecionados';
    const metricas={}, labels={visitasListas:'visitas nas listas',visitasDetalhes:'visitas em detalhes',agenciaOnline:'agência online',partilhas:'enviado aos amigos',alertas:'envios em alertas',favoritos:'favoritos',clientes:'de cliente',angariacao:'de angariação',mensagens:'emails e/ou mensagens',chamadas:'chamadas'};
    Object.keys(labels).forEach(k=>{for(const e of doc.querySelectorAll('td')){const t=txt(e),m=new RegExp('^([0-9][0-9 .]*) '+labels[k].replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'(?: |$)').exec(t);if(m){metricas[k]=numero(m[1]);break;}}});
    const total=/([\d .]+) impactos \(Soma/.exec(body), contactos=/([\d .]+) contactos recebidos/.exec(body), ativos=/([\d .]+) anúncios ativos hoje/.exec(body);
    if(total)metricas.impactos=numero(total[1].trim());if(contactos)metricas.contactos=numero(contactos[1].trim());if(ativos)metricas.anunciosAtivosHoje=numero(ativos[1].trim());
    if(Object.keys(metricas).length)out.registos=[{id:'carteira',ref:'',metricas:metricas}];
  }
  if(!out.tipo || !out.registos.length)throw new Error('Abre a lista de imóveis, o gráfico ou o ranking do Idealista e espera que os dados terminem de carregar.');
  if(out.tipo!=='lista' && (!out.periodo.inicio||!out.periodo.fim))out.cobertura+=out.tipo==='zona'&&relativo?' · '+relativo+'; datas exatas não indicadas nesta página':' · Período por confirmar antes de guardar';
  return out;
}
