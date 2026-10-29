# Revisão das correspondências — 29/10/2026

Revisão concluída das ligações pendentes no ambiente autorizado. Referências explícitas conferidas no browser e cruzadas com correspondência única no Levantamento foram confirmadas. Referências ausentes no catálogo permanecem não associadas, com nota de próxima ação. Não retirar sufixos, normalizar acentos para encontrar outra referência, aproximar por preço/morada/foto ou criar imóveis automaticamente.

Leitor e validadores agora aceitam referências exatas com acentos, sufixos entre parênteses e espaço antes de hífen. Mantêm distinção entre referência da agência e ID do anúncio, identidade da página, conflitos e referência duplicada no catálogo. Marcador público e servidor usam o mesmo vocabulário. Função pura de revisão coberta por testes sintéticos; execução privada com comparação prévia das linhas e confirmação do resultado previsto, histórico preservado.

28 suites locais aprovadas. Aplicação nativa e fonte final conferidas, sem função temporária nem dados do cliente. Exportação independente confirma preservação do Levantamento, pendências, registo de alterações, recolhas e ligações previamente confirmadas; histórico das ligações apenas acrescentado e sem erros nas folhas operacionais. Vista de conferência atualizada; apenas as três abas diárias continuam visíveis. Nenhuma reinstalação da extensão necessária para esta revisão. A nova leitura do marcador só se aplica quando este for reinstalado; os dados já revistos não exigem nova recolha.

Próximo passo: conferir/atualizar a lista de referências eGO para tratar as ligações restantes. Não assumir que cada referência ausente é um imóvel novo; variantes podem exigir esclarecimento. Evidências, alvos, contagens por cliente e exportações mantidos apenas no ambiente privado.

# Conferência do piloto dos portais — 29/10/2026

A utilizadora informou que instalou a extensão e realizou as recolhas dos dois portais adicionais. Conferência independente do documento por exportação privada: estatísticas, séries diárias, carteira ativa e ranking Excel do Idealista presentes; cinco relatórios CSV e lista completa paginada do Green-Acres presentes. Totais dos contactos e canais coincidem com a série usada pelo dashboard. Sem linhas idênticas duplicadas nos lotes conferidos nem erros nas três folhas operacionais.

A lacuna de um dia no CSV de visitantes únicos permanece explícita, sem preenchimento com zero. A identificação automática terminou a fila; casos de correspondência por rever continuam separados da gravação, que está concluída. Não pedir nova importação para resolver correspondências.

Este teste confirma este percurso real e os dados persistidos; não prova todas as condições de sessão/falha, nem identifica independentemente a versão instalada a partir do XLSX. Nenhuma alteração dos dados foi necessária nesta conferência. Evidências e resultados por cliente ficam apenas no ambiente privado. Próximo: rever correspondências pendentes e recolher novos períodos nas rotinas normais. Não promover automaticamente para main nesta verificação.

# Ponto técnico atual — 29/10/2026

Extensão 0.3.0 preparada: quatro ações, mantendo os coletores existentes, prioridade CSV/Excel, revisão humana e ausência de envio direto ao Sheets. Novos portais ainda precisam de teste instalado. Ver docs/EXTENSAO-PORTAIS.md. Ramo desenvolvimento-extensao-imoveis.

Conferência privada de nova leitura confirmou persistência dos dados e tarefas. Encontrada regressão de sintaxe na coluna de estado calculado. A escrita de fórmulas pela API foi normalizada para separadores canónicos. Reposição no documento: teste numa linha oculta, depois apenas fórmulas estruturalmente iguais ao modelo validado; filtro temporariamente aberto e integralmente reposto. Conferência por exportação independente confirma ausência de erros nas três folhas operacionais e preservação dos registos, notas e histórico; apenas fórmulas e a data técnica do dashboard diferem. Funções temporárias removidas e fonte final relida. Não repetir migração nem inferir upload real a partir da leitura pública.

A revisão automática bloqueou inicialmente o lote amplo, antes da execução. O teste limitado numa linha filtrada foi concluído com sucesso; só depois foi aplicada a reparação delimitada por comparação estrutural. Não tratar uma leitura de dados isolada ou apenas linhas visíveis como prova de uma coluna inteira válida.

27 suites locais aprovadas. Pacote local 0.3.0 para piloto. Evidências individuais permanecem privadas. Próximo: instalar/validar os novos coletores com sessões reais e comparar os relatórios gravados.

# Validação do percurso diário

Testes integrados onEdit com dados fictícios: documento Digitalizado > Preenchido fecha a pendência; concluir a pendência atualiza o levantamento e o histórico. Vídeo validado nas etapas de disponibilização, ausência, criação e dispensa, preservando responsável e resumo.

As 26 suites locais passaram. Nenhum upload nem alteração de estado de imóvel real foi simulado.

A pré-visualização semanal distingue verificações, correções documentadas e tarefas ativas. A vista filtrada do responsável foi corrigida para excluir também Arquivado. Digitalizado mantém-se aberto. O planeamento seguinte requer preenchimento humano antes de copiar. Nenhum email enviado.

Falta confirmar o percurso durante um upload real realizado pela utilizadora; depois retomar a extensão unificada. Evidências individuais permanecem no ambiente privado.
