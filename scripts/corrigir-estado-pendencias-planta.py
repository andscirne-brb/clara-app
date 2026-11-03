import sys
from pathlib import Path

source, target = map(Path, sys.argv[1:])
code = source.read_text(encoding='utf-8-sig')
entry = 'function simplificarPendenciasEquipa() {'
temporary = entry + '\n  return corrigirPendenciasPlantaEmFalta();\n'
old = "estado==='Por verificar'?'Por tratar':estado;"
new = "estado==='Por verificar'?'Por tratar':x[0]==='planta'&&estado==='Em falta'?'Falta no eGO > ver dossiê':estado;"
if code.count(entry) != 1:
    raise SystemExit('Função de simplificação inesperada.')
code = code.replace(temporary, entry)
if code.count(old) == 1 and new not in code:
    code = code.replace(old, new)
elif code.count(new) != 1 or old in code:
    raise SystemExit('Regra de estado inesperada.')
if 'return corrigirPendenciasPlantaEmFalta();' in code:
    raise SystemExit('Rever chamada temporária antes de publicar.')
with target.open('x', encoding='utf-8') as output:
    output.write(code)
