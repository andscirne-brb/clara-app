import json
import re
import sys
from pathlib import Path

source, destination = map(Path, sys.argv[1:])
code = source.read_text(encoding='utf-8-sig')
pattern = re.compile(r'(?m)^const PAINEL_HTML = ("(?:[^"\\]|\\.)*");')
matches = list(pattern.finditer(code))
if len(matches) != 1:
    raise SystemExit('Não encontrei um único painel Clara.')
panel = json.loads(matches[0][1])
hook = "el('txt').addEventListener('input',entrada);"
if panel.count(hook) != 1 or 'function textoClaraColado()' in panel:
    raise SystemExit('Painel diferente do esperado ou correção já aplicada.')
panel = re.sub(r"el\('txt'\)\.value(?!\s*=(?!=))", 'textoClaraColado()', panel)
handler = """let leituraGrandeClara = '';
const etiquetaLeituraGrandeClara = 'Leitura completa da Clara carregada.';
function textoClaraColado() {
  const valor = el('txt').value;
  return valor === etiquetaLeituraGrandeClara ? leituraGrandeClara : valor;
}
el('txt').addEventListener('paste', e => {
  const texto = e.clipboardData && e.clipboardData.getData('text/plain');
  if (!texto || !texto.startsWith('CLARA7:') || texto.length <= 400000) return;
  e.preventDefault();
  if (ocupado) return;
  leituraGrandeClara = texto;
  el('txt').value = etiquetaLeituraGrandeClara;
  entrada();
});
el('txt').addEventListener('input', () => {
  leituraGrandeClara = '';
  entrada();
});"""
panel = panel.replace(hook, handler)
code = pattern.sub(lambda _: 'const PAINEL_HTML = ' + json.dumps(panel, ensure_ascii=False) + ';', code)
with destination.open('x', encoding='utf-8') as output:
    output.write(code)
