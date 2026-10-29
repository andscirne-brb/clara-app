"""Bundle the existing export-first collectors; no remote code or dependencies."""
from pathlib import Path

root = Path(__file__).resolve().parents[1]
source = root / 'apps-script/clara'
target = root / 'apps-script/rightmove-extension/portal-collectors.js'
files = ['green-acres.js', 'green-anuncios.js', 'recolha-conjunta.js',
         'idealista.js', 'idealista-excel.js', 'idealista-ativos.js', 'idealista-conjunta.js']
target.write_text('/* Gerado por scripts/construir-coletor-portais.py. */\n' +
                  '\n'.join((source / name).read_text(encoding='utf-8') for name in files),
                  encoding='utf-8')
print('Coletores dos portais gerados a partir da fonte partilhada.')
