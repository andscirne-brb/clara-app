# Dashboard visual

Resultados dos portais em primeiro lugar; janela padrão de 30 dias. Cartões com números principais, dois gráficos de contactos e dois gráficos de progressão, progresso e pendências, ligações ao detalhe.

- Idealista: última janela geral completa de exatamente 30 dias, com filtros e recolha identificados. Série diária recortada para a mesma janela, apenas com cobertura completa e soma igual ao total. Nunca somar capturas sobrepostas.
- Green-Acres: histórico mensal; último período disponível identificado e aviso quando não existe janela de 30 dias. Contactos únicos mensais não são equiparados a contactos brutos de outros portais.
- Rightmove: inventário preservado; desempenho dos CSV associado pelo ID do anúncio. Colunas R:V com médias diárias 30/60/90, variação e âmbito. O cartão usa a média por anúncio, não um total obtido multiplicando por dias. CSV não inclui contactos; datas exatas da janela desconhecidas ficam explícitas.
- Progresso: fórmulas diretas nas folhas Levantamento e Pendências da equipa; não depende das cópias de segurança. Não confundir completude do CRM com qualidade, verificação ou correção concluída.

A instalação cria uma cópia oculta do Dashboard antes de reorganizar a vista. Registos de origem e histórico não são apagados. A vista técnica Clara - dashboard alimenta os gráficos e fica oculta. O conteúdo extenso sai apenas da vista principal.

Atualização: ao abrir o documento e ao guardar estatísticas gerais Idealista. Fórmulas de progresso recalculam diretamente. Atualizações usam o bloqueio do documento; falha na vista não invalida uma recolha já guardada. Sem novos itens no menu.

Validação: testes de janela de 30 dias, duplicação, zeros/ausentes e passagem de mês; regressões eGO/Idealista; leitura real das fontes, dos cartões e dos dados dos gráficos. Gráficos recriados a partir da fonte conferida; só os gráficos desta vista são substituídos. Uma função de manutenção verificarDashboardVisual permite conferir fontes, fórmulas e intervalos sem alterar dados.


## Progressão Rightmove e eGO
- Rightmove: nova folha Rightmove - histórico preserva uma medição por anúncio/lote, data do relatório separada da data de registo. Hash do conteúdo ordenado evita duplicação em cada abertura. Recolhas revistas preservam as anteriores; no gráfico entra a última versão da data.
- Comparação temporal apenas entre lotes com o mesmo conjunto completo de IDs. Usa a média diária por anúncio da janela de 30 dias; não liga 30/60/90 como se fossem datas. Falta de uma data exata para a janela continua explícita no cartão.
- eGO: Histórico de indicadores, apenas referências atualmente prioritárias. Só compara datas em que esse grupo inteiro tem uma medição válida; datas parciais e imóveis exteriores ao grupo ficam fora. Mede completude do CRM, não qualidade nem correções concluídas.
- Quando só existe uma medição, o gráfico mostra um ponto e a legenda Primeira medição. Nunca cria uma linha de melhoria nem zeros para valores ausentes.
- A segunda linha de gráficos ocupa as linhas 34:50; progresso/pendências/detalhe passam para 53:80. Antes da migração é guardada outra cópia oculta do Dashboard. Nenhuma folha de origem é apagada.
- Testes sintéticos cobrem percentagens/zeros, datas e grupos incompletos, revisão de lote, duplicação e recuperação de falha na escrita. Validação real confirmou quatro gráficos, com um ponto inicial em cada nova série. É necessário um novo relatório/medição completa para demonstrar evolução.

A contagem de imóveis com pendências exclui referências de portais. A conferência confirmou que a contagem anterior misturava esses dois tipos. Os totais de assuntos, responsáveis e conclusões mantêm os mesmos critérios e foram reconferidos.
