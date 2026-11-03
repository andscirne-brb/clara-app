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
if len(matches) != 1 or 'function guardarTextosFotosEgo(' in code:
    raise SystemExit("Estrutura inesperada ou integração já presente.")
panel = json.loads(matches[0][1])
if panel.count('</body>') != 1:
    raise SystemExit("Estrutura do painel inesperada.")
block = (base / 'TextosFotosEgo.html').read_text(encoding='utf-8-sig')
panel = panel.replace('</body>', block + '\n</body>')
code = pattern.sub(lambda _: 'const PAINEL_HTML = ' + json.dumps(panel, ensure_ascii=False) + ';', code)
code += '\n' + (base / 'TextosFotosEgo.gs').read_text(encoding='utf-8-sig')
with destination.open('x', encoding='utf-8') as output:
    output.write(code)
