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
