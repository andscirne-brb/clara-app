import json
import re
import sys
from pathlib import Path

source, destination = map(Path, sys.argv[1:])
if destination.exists():
    raise SystemExit("Escolhe um ficheiro de saída novo.")
base = Path(__file__).resolve().parent.parent / 'apps-script' / 'clara'
code = source.read_text(encoding='utf-8-sig')
pattern = re.compile(r'(?m)^const PAINEL_HTML = ("(?:[^"\\]|\\.)*");')
matches = list(pattern.finditer(code))
if len(matches) != 1 or any(name in code for name in ('function guardarTextosFotosEgo(', 'function guardarFotosInternas(')):
    raise SystemExit("Estrutura inesperada ou integração já presente.")
panel = json.loads(matches[0][1])
if panel.count('</body>') != 1:
    raise SystemExit("Estrutura do painel inesperada.")
block = (base / 'TextosFotosEgo.html').read_text(encoding='utf-8-sig')
hook = "  SpreadsheetApp.getUi().showSidebar(HtmlService.createHtmlOutput(html).setTitle('Clara'));"
if code.count(hook) != 1:
    raise SystemExit('Ponto de integração inesperado.')
injection = "  if(tipo==='ego')html=html.replace('</body>',()=>" + json.dumps(block, ensure_ascii=False) + "+'</body>');\n"
code = code.replace(hook, injection + hook)
code += '\n' + (base / 'TextosFotosEgo.gs').read_text(encoding='utf-8-sig')
with destination.open('x', encoding='utf-8') as output:
    output.write(code)

