#!/usr/bin/env python3
"""Junta apps-script/clara/{Codigo.gs,Painel.html,marcador.js} num só ficheiro
apps-script/clara/Clara-completo.gs, para colar no editor do Apps Script ligado ao Sheet."""
import json, pathlib, re
base = pathlib.Path(__file__).resolve().parent.parent / 'apps-script' / 'clara'
codigo = (base / 'Codigo.gs').read_text(encoding='utf-8')
painel = (base / 'Painel.html').read_text(encoding='utf-8')
lista = (base / 'Lista.html').read_text(encoding='utf-8')
marc = (base / 'marcador.js').read_text(encoding='utf-8')
marc = ' '.join(l.strip() for l in marc.splitlines() if l.strip())
out = codigo + '\n/* ---------- gerado por scripts/construir-clara.py: não editar à mão ---------- */\n'
out += 'const PAINEL_HTML = ' + json.dumps(painel, ensure_ascii=False) + ';\n'
out += 'const LISTA_HTML = ' + json.dumps(lista, ensure_ascii=False) + ';\n'
out += 'const MARCADOR_JS = ' + json.dumps(marc, ensure_ascii=False) + ';\n'
(base / 'Clara-completo.gs').write_text(out, encoding='utf-8')
print(len(out), 'caracteres')
