#!/usr/bin/env python3
"""Junta apps-script/clara/{Codigo.gs,Painel.html,marcador.js} num só ficheiro
apps-script/clara/Clara-completo.gs, para colar no editor do Apps Script ligado ao Sheet."""
import json, pathlib, re, sys
base = pathlib.Path(__file__).resolve().parent.parent / 'apps-script' / 'clara'
codigo = (base / 'Codigo.gs').read_text(encoding='utf-8')
codigo += '\n' + (base / 'EstadosCurtos.gs').read_text(encoding='utf-8')
codigo += '\n' + (base / 'EstadoDocumental.gs').read_text(encoding='utf-8')
codigo += '\n' + (base / 'AuditoriaPrioritarios.gs').read_text(encoding='utf-8')
codigo += '\n' + (base / 'AlertasDesempenho.gs').read_text(encoding='utf-8')
codigo += '\n' + (base / 'PresencaPortais.gs').read_text(encoding='utf-8')
codigo += '\n' + (base / 'ComparacaoPortais.gs').read_text(encoding='utf-8')
codigo += '\n' + (base / 'RecolhaConjunta.gs').read_text(encoding='utf-8')
codigo += '\n' + (base / 'ResumoSemanal.gs').read_text(encoding='utf-8')
identidade = (base / 'ImoveisPortais.gs').read_text(encoding='utf-8')
consulta = (base / 'LeituraPublicaPortais.gs').read_text(encoding='utf-8') if '--sem-fichas-publicas' not in sys.argv else "function ipLerPublicas_(){throw Error('Consulta pública ainda não ativada. A ficha e as ligações das recolhas continuam disponíveis.');}\n"
codigo += '\n' + identidade.replace('/* LEITURA_PUBLICA_PORTAIS */', consulta)
codigo += '\n' + (base / 'AutomacaoPortais.gs').read_text(encoding='utf-8')
codigo += '\n' + (base / 'OrganizacaoAbas.gs').read_text(encoding='utf-8')
codigo += '\n' + (base / 'FichaImovel.gs').read_text(encoding='utf-8')
codigo += '\n' + (base / 'LigacaoPortal.gs').read_text(encoding='utf-8')
codigo += '\n' + (base / 'GreenAnuncios.gs').read_text(encoding='utf-8')
codigo += '\n' + (base / 'GreenAcres.gs').read_text(encoding='utf-8')
codigo += '\n' + (base / 'RightmoveCSV.gs').read_text(encoding='utf-8')
codigo += '\n' + (base / 'Rightmove.gs').read_text(encoding='utf-8')
codigo += '\n' + (base / 'Idealista.gs').read_text(encoding='utf-8')
codigo += '\n' + (base / 'DashboardIdealista.gs').read_text(encoding='utf-8')
codigo += '\n' + (base / 'ContactosIdealista.gs').read_text(encoding='utf-8')
codigo += '\n' + (base / 'DashboardVisual.gs').read_text(encoding='utf-8')
codigo += '\n' + (base / 'ProgressoDashboard.gs').read_text(encoding='utf-8')
painel = (base / 'Painel.html').read_text(encoding='utf-8')
for marca, uri in json.loads((base / 'logos' / 'logos.json').read_text(encoding='utf-8')).items():
    painel = painel.replace('__LOGO_' + marca.upper() + '__', uri)
lista = (base / 'Lista.html').read_text(encoding='utf-8')
resumo = (base / 'Resumo.html').read_text(encoding='utf-8')
marc = (base / 'marcador.js').read_text(encoding='utf-8')
marc = marc.replace('/* LIGACAO_PUBLICA */', (base / 'ligacao-portal.js').read_text(encoding='utf-8'))
marc = marc.replace('/* GREEN_COLLECTOR */', (base / 'green-acres.js').read_text(encoding='utf-8') + '\n' + (base / 'green-anuncios.js').read_text(encoding='utf-8') + '\n' + (base / 'recolha-conjunta.js').read_text(encoding='utf-8'))
marc = marc.replace('/* CLARA_UI */', (base / 'marcador-ui.js').read_text(encoding='utf-8'))
marc = marc.replace('/* RIGHTMOVE_COLLECTOR */', (base / 'rightmove-csv.js').read_text(encoding='utf-8') + '\n' + (base / 'rightmove.js').read_text(encoding='utf-8'))
marc = marc.replace('/* IDEALISTA_COLLECTOR */', (base / 'idealista.js').read_text(encoding='utf-8') + '\n' + (base / 'idealista-excel.js').read_text(encoding='utf-8') + '\n' + (base / 'idealista-ativos.js').read_text(encoding='utf-8') + '\n' + (base / 'idealista-conjunta.js').read_text(encoding='utf-8'))
marc = ' '.join(l.strip() for l in marc.splitlines() if l.strip())
out = codigo + '\n/* ---------- gerado por scripts/construir-clara.py: não editar à mão ---------- */\n'
out += 'const PAINEL_HTML = ' + json.dumps(painel, ensure_ascii=False) + ';\n'
out += 'const ESTADO_DOCUMENTAL_HTML = ' + json.dumps((base / 'EstadoDocumental.html').read_text(encoding='utf-8'), ensure_ascii=False) + ';\n'
out += 'const AUDITORIA_PRIORITARIOS_HTML = ' + json.dumps((base / 'AuditoriaPrioritarios.html').read_text(encoding='utf-8'), ensure_ascii=False) + ';\n'
out += 'const LISTA_HTML = ' + json.dumps(lista, ensure_ascii=False) + ';\n'
out += 'const RESUMO_HTML = ' + json.dumps(resumo, ensure_ascii=False) + ';\n'
out += 'const MARCADOR_JS = ' + json.dumps(marc, ensure_ascii=False) + ';\n'

out += 'const PORTAIS_HTML = ' + json.dumps((base / 'Portais.html').read_text(encoding='utf-8'), ensure_ascii=False) + ';\n'
(base / 'Clara-completo.gs').write_text(out, encoding='utf-8')

print(len(out), 'caracteres')

# Extensão Rightmove: código estático local, sem dependências ou código remoto.
extensao = base.parent / 'rightmove-extension'
if extensao.exists():
    (extensao / 'collectors.js').write_text((base / 'rightmove-csv.js').read_text(encoding='utf-8') + '\n' + (base / 'rightmove.js').read_text(encoding='utf-8'), encoding='utf-8')
