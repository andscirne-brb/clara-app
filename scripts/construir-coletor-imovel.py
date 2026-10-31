"""Generate extension collector from the existing bookmarklet, keeping one source."""
from pathlib import Path
import re
root=Path(__file__).resolve().parents[1]
base=root/'apps-script/clara';target=root/'apps-script/rightmove-extension/ego-collector.js'
s=(base/'marcador.js').read_text(encoding='utf8')
body=s[s.index("  ui.estado('A ler a ficha do imóvel…');"):s.rindex('  }catch(e)')]
body=body.replace("if(!me){ui.falhar('Esta página não é uma ficha de imóvel. Abre o anúncio e volta a clicar no marcador.');return;}","if(!me)throw Error('Abre a ficha pública completa do imóvel no website.');")
body=body.replace("if(!out.ref){ui.falhar('Não consegui identificar a referência. Confirma que abriste a ficha completa do imóvel e volta a tentar.');return;}","if(!out.ref)throw Error('A referência do imóvel não ficou identificada.');")
body=body.replace('  if (p && p.Reference) {',"  const refDom=(doc.querySelector('.detailContainer')||doc.body).textContent.match(/Ref\\.\\s*([A-Z]{2,5}\\d+)/);\n  if(p&&p.Reference&&refDom&&p.Reference!==refDom[1])throw Error('As referências da página e dos dados não correspondem. Atualiza a ficha.');\n  if (p && p.Reference) {")
last=body.index('  const falharam=')
body=body[:last]+"  return out;\n"
body=re.sub(r'\bdocument\b','doc',body)
body=body.replace("if(out.parcial){\n    const galerias", "if(out.parcial){\n    out.fotos=null;\n    const galerias")
helper=(base/'marcador-ui.js').read_text(encoding='utf8')
helper=helper[helper.index('async function fetchClara('):]
helper=helper.replace('const control=new AbortController()',"if(!/^https:\\/\\/(?:www\\.)?janela-imobiliaria\\.com\\//.test(url)&&!/^https:\\/\\/websiteapi\\.egorealestate\\.com\\/v1\\/Properties\\/\\d+\\?/.test(url))throw Error('Fonte externa não autorizada.');const control=new AbortController()")
wait=r"""async function aguardarFichaClara(doc){
 const pronta=()=>Array.from(doc.querySelectorAll('script[type="application/ld+json"]')).some(n=>{try{return JSON.parse(n.textContent)['@type']==='RealEstateListing';}catch(e){return false;}})&&(!!doc.querySelector('.mediaGallery .totalImgCounter')||/Ref\.\s*[A-Z]{2,5}\d+/.test(doc.querySelector('.detailContainer')?.textContent||''));
 if(pronta())return;
 await new Promise((resolve,reject)=>{let timer;const obs=new MutationObserver(()=>{if(pronta()){obs.disconnect();clearTimeout(timer);resolve();}});obs.observe(doc.documentElement,{childList:true,subtree:true});timer=setTimeout(()=>{obs.disconnect();reject(Error('A ficha não terminou de carregar. Atualiza a página pública e volta a tentar.'));},12000);if(pronta()){obs.disconnect();clearTimeout(timer);resolve();}});
}
"""
target.write_text('/* Gerado por scripts/construir-coletor-imovel.py; não editar à mão. */\n'+helper+'\n'+wait+'async function recolherFichaClara(doc,ui){\n await aguardarFichaClara(doc);\n'+body+'}\n',encoding='utf8')
print('Coletor de imóvel gerado.')
