/* Popup da leitura de todos os imóveis. Independente da leitura individual. */
(()=>{
const $=id=>document.getElementById(id);
const enviar=m=>chrome.runtime.sendMessage(Object.assign({},m));
const teste=document.createElement('button');teste.id='massaTeste';teste.textContent='Teste: ler só 10 imóveis';teste.style.cssText='background:#fff;color:#087f8c;border:1px solid #087f8c';$('massa').after(teste);
async function iniciar(limite){$('massaBox').hidden=false;$('massaEstado').textContent='A preparar a lista de imóveis do site…';const r=await enviar({massa:'iniciar',limite});if(r?.erro)$('massaEstado').textContent=r.erro;mostrar();}
$('massa').onclick=()=>iniciar(0);teste.onclick=()=>iniciar(10);
$('massaContinuar').onclick=async()=>{const r=await enviar({massa:'continuar'});if(r?.erro)$('massaEstado').textContent=r.erro;mostrar();};
$('massaParar').onclick=()=>enviar({massa:'parar'});
$('massaLimpar').onclick=async()=>{const r=await enviar({massa:'limpar'});if(r?.erro){$('massaEstado').textContent=r.erro;return;}$('massaTexto').hidden=true;mostrar();};
async function copiar(n){const r=await enviar({massa:'lote',n});if(!r?.texto){$('massaEstado').textContent='Este lote já não está disponível. Volta a ler.';return;}
 try{await navigator.clipboard.writeText(r.texto);$('massaEstado').textContent='Lote '+n+' copiado. Cola em Clara > eGO: estado, analisa e guarda. Depois volta aqui para o lote seguinte.';$('massaTexto').hidden=true;}
 catch(e){$('massaTexto').value=r.texto;$('massaTexto').hidden=false;$('massaTexto').select();$('massaEstado').textContent='Copia o texto selecionado com Ctrl+C.';}mostrar();}
async function copiarTexto(t,ok){try{await navigator.clipboard.writeText(t);$('massaEstado').textContent=ok;$('massaTexto').hidden=true;}catch(e){$('massaTexto').value=t;$('massaTexto').hidden=false;$('massaTexto').select();$('massaEstado').textContent='Copia o texto selecionado com Ctrl+C.';}}
async function copiarTudo(){const r=await enviar({massa:'todos'});if(!r?.texto){$('massaEstado').textContent='A leitura já não está disponível. Volta a ler.';return;}await copiarTexto(r.texto,'Tudo copiado. Cola em Clara > eGO: estado e clica em Analisar. A gravação corre sozinha; se o painel fechar, volta a colar e continua onde parou.');await enviar({massa:'marcar',n:'todos'});mostrar();}
async function mostrar(){
 const {massa:m}=await chrome.storage.local.get('massa');const st=await enviar({massa:'estado'}).catch(()=>({}));const ativa=!!st?.ativa;
 $('massaBox').hidden=!m&&!ativa;$('massa').disabled=teste.disabled=ativa;$('massaParar').hidden=!ativa;$('massaLotes').replaceChildren();$('massaFalhas').replaceChildren();
 $('massaContinuar').hidden=!(m&&!ativa&&['a-ler','parado'].includes(m.estado));$('massaLimpar').hidden=!m||ativa;
 if(!m)return;
 const total=m.urls?.length||0,falhas=m.falhas?.length||0;
 if(m.estado==='erro')$('massaEstado').textContent='A leitura parou: '+m.erro;
 else if(m.estado==='a-ler'&&ativa)$('massaEstado').textContent=(m.teste?'Teste · ':'')+'A ler imóveis: '+m.feitos+' de '+total+(falhas?' · '+falhas+' não lidos':'')+'. Podes fechar este painel; a leitura continua numa janela minimizada.';
 else if(['a-ler','parado'].includes(m.estado))$('massaEstado').textContent='Leitura interrompida em '+m.feitos+' de '+total+'. Clica em Continuar para ler só os que faltam.';
 else if(m.estado==='concluido'){
  if(!/^(Lote|Tudo|Lista)/.test($('massaEstado').textContent))$('massaEstado').textContent=(m.teste?'Teste concluído: ':'Concluído: ')+m.lidos+' de '+total+' imóveis lidos'+(falhas?', '+falhas+' não lidos':'')+'. Copia tudo e cola uma vez no Sheets.';
  const tudo=document.createElement('button');tudo.textContent=(m.copiados?.includes('todos')?'✓ ':'')+'Copiar tudo para o Sheets ('+m.lidos+' imóveis)';tudo.onclick=copiarTudo;$('massaLotes').append(tudo);
  if(falhas){const repetir=document.createElement('button');repetir.textContent='Repetir apenas as falhas';repetir.onclick=async()=>{repetir.disabled=true;const r=await enviar({massa:'repetirFalhas'});if(r?.erro){repetir.disabled=false;massaEstado.textContent=r.erro;}else mostrar();};massaLotes.append(repetir);const nl=document.createElement('button');nl.className='lote';nl.textContent='Copiar lista de não lidos';nl.onclick=()=>copiarTexto((m.falhas||[]).map(f=>decodeURI(f.url)+' · '+f.erro).join('\n'),'Lista de não lidos copiada.');$('massaLotes').append(nl);}
  const alt=document.createElement('details');const s=document.createElement('summary');s.textContent='Alternativa: lotes de 25';alt.append(s);
  for(let n=1;n<=m.lotes;n++){const b=document.createElement('button');const feito=m.copiados?.includes(n);b.className='lote'+(feito?' ok':'');b.textContent=(feito?'✓ ':'')+'Copiar lote '+n+' de '+m.lotes;b.onclick=()=>copiar(n);alt.append(b);}
  $('massaLotes').append(alt);
 }
 $('massaFalhasBox').hidden=!falhas;(m.falhas||[]).forEach(f=>{const p=document.createElement('p');const a=document.createElement('small');a.textContent=decodeURI(f.url.replace(/^https:\/\/(www\.)?janela-imobiliaria\.com/,''))+' · '+f.erro;p.append(a);$('massaFalhas').append(p);});
}
chrome.storage.onChanged.addListener((c,area)=>{if(area==='local'&&c.massa)mostrar();});
mostrar();setInterval(()=>{if($('massaParar')&&!$('massaParar').hidden)mostrar();},2000);
})();

