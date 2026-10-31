# Clara · imóveis e portais — 0.3.0 (piloto)

Uma extensão com quatro ações: eGO: ler este imóvel; Idealista: estatísticas; Green-Acres: estatísticas; Rightmove: recolher os dois relatórios. A extensão lê, permite copiar e indica o painel do Sheets. A gravação continua a exigir revisão e confirmação.

## Atualizar

Substituir os ficheiros na pasta da extensão instalada e clicar Atualizar em chrome://extensions. Confirmar 0.3.0. O Chrome pode pedir os novos acessos ao Idealista e Green-Acres; não há acesso ao CRM interno, contactos individuais nem todos os sites. A atualização não altera o documento.

## Páginas e fontes

- eGO: ficha pública do website, documentos confirmados manualmente no Sheets.
- Idealista: Estatísticas dos teus anúncios, em Gráfico ou Ranking. Reutiliza o Excel oficial do ranking; no Gráfico tenta também as séries diárias e carteira ativa. Mantém/restaura os filtros existentes.
- Green-Acres: Resumo da conta para cinco CSV e a lista dos anúncios; Anúncios para apenas a lista completa. Ficheiros oficiais têm prioridade. Componentes em falta são apresentados explicitamente.
- Rightmove: mantém a recolha conjunta de leads e desempenho CSV. Mantém o relatório de leads visível; se o popup fechar, reabre para copiar.

## Garantias e limites

Sem envio direto ao Sheets, edição de portais ou registo de palavras-passe. Leituras temporárias expiram após 30 minutos e ficam em storage.session. Os novos coletores usam a mesma fonte do marcador, sem bibliotecas remotas. Origem e versão da extensão acompanham o resultado. Página incompatível, mudança de URL e fonte de outro portal bloqueiam a cópia. Prazo externo de 90 segundos; uma resposta tardia não substitui o resultado. Se o prazo terminar, deixar a página terminar/atualizá-la antes de repetir.

Testes locais não substituem validação com sessões reais. Idealista e Green-Acres ainda precisam de teste instalado e conferência da gravação. O marcador continua disponível durante o piloto. Não há necessidade de alterar a estrutura nem a fonte nativa do Sheets para ler estes formatos.

## Conferência real do piloto

Percurso dos dois portais adicionais conferido no documento após teste da utilizadora: exportações oficiais e listas completas persistidas, dashboard coerente com as somas e fila de identificação terminada. Lacunas da fonte e correspondências por rever continuam explícitas. Sem nova importação necessária. Evidência individual permanece privada. Ver docs/VALIDACAO-PERCURSO-DIARIO.md.
