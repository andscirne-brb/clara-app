/* Leitura em lote (CLARA7) vinda da extensão: cada ficha é analisada e gravada pela mesma via da leitura individual (CLARA1).
   Documentos ficam como estão (sem confirmação manual nesta leitura). Imóveis fora do Levantamento são apenas listados. */
function loteValidarFicha_(f){
  if(!f||typeof f!=='object'||f.v!==1||f.origem!=='site'||!/^[A-Za-z0-9][A-Za-z0-9_\- ()]{1,30}$/.test(String(f.ref||''))||!/^https:\/\/(?:www\.)?janela-imobiliaria\.com\//.test(String(f.url||'')))throw Error('Ficha inválida no lote.');
  return 'CLARA1:'+JSON.stringify(f);
}
function analisarFichaLote(ficha){
  const texto=loteValidarFicha_(ficha),ref=String(ficha.ref).toUpperCase();
  try{
    const a=analisar(texto,null),corta=function(v){v=String(v==null?'':v);return v.length>70?v.slice(0,70)+'…':v;};
    return {ok:true,ref:a.ref,linha:a.linha,completa:a.completa,
      campos:a.campos.filter(function(x){return String(x.atual)!==String(x.novo)&&x.coluna!=='Data da verificação';}).map(function(x){return {coluna:x.coluna,atual:corta(x.atual),novo:corta(x.novo)};}),
      novas:a.pendencias.filter(function(p){return !p.jaExiste;}).map(function(p){return p.assunto;}),
      resolvidas:a.resolvidas.map(function(r){return r.id+' '+r.assunto;}),
      naoVerificados:(a.naoVerificados||[]).filter(function(n){return DOCS.every(function(x){return String(n).indexOf(x[1])<0;});}).slice(0,10)};
  }catch(e){
    const msg=String(e.message||e);
    return {ok:false,ref:ref,foraDoLevantamento:/não está no Levantamento/.test(msg),erro:msg.slice(0,300)};
  }
}
function gravarFichaLote(ficha){
  const r=gravar(loteValidarFicha_(ficha),null);
  return {ref:r.ref,escritos:r.escritos,parcial:!!r.parcial,erro:r.erro||'',avisoSeguimento:r.avisoSeguimento||''};
}
