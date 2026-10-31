const el=id=>document.getElementById(id);const VERSAO='0.3.0';let leitura='',autoCopiarPedido='',aguardarPedido='',render=0,destinoLeitura='Rightmove: estatísticas';
function bloquear(v){el('iniciar').disabled=v;el('imovel').disabled=v;el('idealista').disabled=v;el('green').disabled=v;}
async function mostrar(){const atual=++render,{clara:s}=await chrome.storage.session.get('clara');if(atual!==render)return;el('resumo').replaceChildren();leitura='';el('copiar').hidden=true;el('limpar').hidden=!s;bloquear(false);
if(aguardarPedido&&s?.pedido!==aguardarPedido){bloquear(true);el('estado').textContent='A iniciar uma nova recolha. A leitura anterior não será copiada.';return;}
if(!s){el('estado').textContent='Abre a página do imóvel ou do portal e escolhe a ação.';return;}
if(s.versao!==VERSAO){el('estado').textContent='A leitura anterior pertence a outra versão. Faz uma nova recolha.';return;}
if(s.estado==='a-recolher'&&Date.now()-s.quando>100000){aguardarPedido='';autoCopiarPedido='';el('estado').textContent='A recolha excedeu o tempo previsto. Atualiza a extensão e os relatórios antes de repetir; não há uma nova leitura para guardar.';return;}
if(Date.now()-s.quando>30*60000){el('estado').textContent='Esta leitura expirou. Recolhe novamente.';return;}
bloquear(s.estado==='a-recolher');if(s.estado==='a-recolher'){const r=await chrome.runtime.sendMessage({acao:'estado'});if(atual!==render)return;if(!r?.ativo){aguardarPedido='';autoCopiarPedido='';bloquear(false);el('estado').textContent='A recolha foi interrompida. Atualiza os relatórios e volta a recolher.';return;}}
el('estado').textContent=s.mensagem;for(const text of ['Versão '+s.versao+' · '+new Date(s.quando).toLocaleTimeString('pt-PT'),...(s.resumo||[]),...(s.faltas||[]).map(f=>'Por recolher: '+f.nome+' · '+f.erro)]){const p=document.createElement('p');p.textContent=text;el('resumo').append(p);}
if(s.estado==='pronto'){destinoLeitura=s.destino||'Rightmove: estatísticas';leitura=s.texto;el('copiar').hidden=false;aguardarPedido='';if(autoCopiarPedido===s.pedido){autoCopiarPedido='';try{await navigator.clipboard.writeText(s.texto);if(atual===render)el('estado').textContent='Nova leitura copiada. Cola em Clara > '+destinoLeitura+'.';}catch(e){if(atual===render)el('estado').textContent='Nova recolha pronta. Clica em Copiar leitura para continuar.';}}}
if(s.estado==='erro'){aguardarPedido='';autoCopiarPedido='';}}
async function iniciarRecolha(tipo){const pedido=crypto.randomUUID();aguardarPedido=pedido;autoCopiarPedido=pedido;leitura='';el('copiar').hidden=true;bloquear(true);el('texto').hidden=true;el('estado').textContent='A iniciar uma nova recolha…';try{const r=await chrome.runtime.sendMessage({acao:'iniciar',pedido,tipo});if(r?.erro)throw Error(r.erro);aguardarPedido=r.pedido;autoCopiarPedido=r.pedido;await mostrar();}catch(e){aguardarPedido='';autoCopiarPedido='';bloquear(false);el('estado').textContent='Não foi possível iniciar. '+String(e.message||e);}};
el('copiar').onclick=async()=>{if(!leitura)return;try{await navigator.clipboard.writeText(leitura);el('estado').textContent='Leitura copiada. Cola em Clara > '+destinoLeitura+'.';}catch(e){el('texto').value=leitura;el('texto').hidden=false;el('texto').select();el('estado').textContent='Copia o texto selecionado com Ctrl+C.';}};
el('limpar').onclick=async()=>{const r=await chrome.runtime.sendMessage({acao:'limpar'});if(r?.erro){el('estado').textContent=r.erro;return;}aguardarPedido='';autoCopiarPedido='';el('texto').value='';el('texto').hidden=true;await mostrar();};
chrome.storage.onChanged.addListener((c,area)=>{if(area==='session'&&c.clara)mostrar();});mostrar();

setInterval(()=>{if(el('iniciar').disabled)mostrar().catch(()=>{el('estado').textContent='A ligação à extensão foi interrompida. Fecha e volta a abrir este painel.';});},1000);

el('iniciar').onclick=()=>iniciarRecolha('rightmove');
el('imovel').onclick=()=>iniciarRecolha('ego');

el('idealista').onclick=()=>iniciarRecolha('idealista');
el('green').onclick=()=>iniciarRecolha('green-acres');
