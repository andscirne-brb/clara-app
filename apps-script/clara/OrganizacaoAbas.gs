/* Visibilidade diária; não elimina dados nem folhas de suporte. */
function organizarAbasDiaADia(){
 const ss=SpreadsheetApp.getActive(),nomes=['Dashboard','Levantamento','Pendências da equipa'];
 const principais=nomes.map(n=>{const s=ss.getSheetByName(n);if(!s)throw Error('Falta a aba '+n);return s;});
 principais.forEach(s=>s.showSheet());principais[0].activate();
 ss.getSheets().forEach(s=>{if(!nomes.includes(s.getName())&&!s.isSheetHidden())s.hideSheet();});
 principais.forEach((s,i)=>{s.activate();ss.moveActiveSheet(i+1);});principais[0].activate();
 const visiveis=ss.getSheets().filter(s=>!s.isSheetHidden()).map(s=>s.getName());
 if(JSON.stringify(visiveis)!==JSON.stringify(nomes))throw Error('A visibilidade das abas não ficou como previsto.');
 return {visiveis};
}
function identificarAnunciosPortais(){atualizarImoveisPortais();const r=identificarProximosImoveisPortais();SpreadsheetApp.getActive().toast((r.mensagem||'Lote concluído.')+' Restantes: '+(r.restantes||0),'Clara',10);return r;}
