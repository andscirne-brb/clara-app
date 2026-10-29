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
