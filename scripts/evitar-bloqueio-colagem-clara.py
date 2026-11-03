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
const ficheiroClara = document.createElement('input');
ficheiroClara.type = 'file';
ficheiroClara.accept = '.txt,.json';
ficheiroClara.setAttribute('aria-label', 'Carregar ficheiro da recolha Clara');
if ('__CLARA_MARCA__' === 'ego') el('txt').after(ficheiroClara);
ficheiroClara.addEventListener('change', async () => {
  const ficheiro = ficheiroClara.files[0];
  ficheiroClara.value = '';
  if (!ficheiro || ocupado) return;
  const anterior = revisao;
  try {
    if (ficheiro.size > 12000000) throw Error('O ficheiro excede 12 MB.');
    const texto = (await ficheiro.text()).trim();
    if (ocupado || anterior !== revisao) return;
    if (!texto.startsWith('CLARA7:')) throw Error('Seleciona o ficheiro da recolha de imóveis da Clara.');
    leituraGrandeClara = texto;
    el('txt').value = etiquetaLeituraGrandeClara;
    entrada();
  } catch (erro) {
    el('erro').textContent = erro.message;
    el('erro').hidden = false;
  }
});
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
receiver = (Path(__file__).resolve().parent.parent / 'Clara-extensao-0.5.2' /
            'importacao-blocos.js').read_text(encoding='utf-8-sig')
handler += "\n" + receiver + """
// O transporte da extensão chama esta função após validar o separador de destino.
let rececaoClara;
function receberImportacaoClara(pedido) {
  if (ocupado) throw Error('Já existe uma operação em curso.');
  if (!pedido || typeof pedido.id !== 'string' || !pedido.id || pedido.id.length > 80)
    throw Error('Sessão de receção inválida.');
  if (pedido.acao === 'iniciar') {
    if (rececaoClara && rececaoClara.id === pedido.id)
      return rececaoClara.recebidos;
    rececaoClara = {id: pedido.id, revisao, recebidos: 0,
      recetor: criarRecetorImportacaoClara(pedido.total)};
    return 0;
  }
  if (!rececaoClara || rececaoClara.id !== pedido.id || rececaoClara.revisao !== revisao)
    throw Error('A revisão mudou. Inicia novamente o envio.');
  if (pedido.acao === 'bloco') {
    rececaoClara.recebidos = rececaoClara.recetor.receber(pedido.indice, pedido.texto);
    return rececaoClara.recebidos;
  }
  if (pedido.acao !== 'concluir') throw Error('Ação de receção desconhecida.');
  leituraGrandeClara = rececaoClara.recetor.concluir();
  rececaoClara = null;
  el('txt').value = etiquetaLeituraGrandeClara;
  entrada();
  return {recebida: true};
}
"""
panel = panel.replace(hook, handler)
code = pattern.sub(lambda _: 'const PAINEL_HTML = ' + json.dumps(panel, ensure_ascii=False) + ';', code)
with destination.open('x', encoding='utf-8') as output:
    output.write(code)


