# Dashboard visual

Resultados dos portais em primeiro lugar; janela padrão de 30 dias. Cartões com números principais, dois gráficos de contactos, progresso e pendências, ligações ao detalhe.

- Idealista: última janela geral completa de exatamente 30 dias, com filtros e recolha identificados. Série diária recortada para a mesma janela, apenas com cobertura completa e soma igual ao total. Nunca somar capturas sobrepostas.
- Green-Acres: histórico mensal; último período disponível identificado e aviso quando não existe janela de 30 dias. Contactos únicos mensais não são equiparados a contactos brutos de outros portais.
- Rightmove: inventário preservado; desempenho dos CSV associado pelo ID do anúncio. Colunas R:V com médias diárias 30/60/90, variação e âmbito. O cartão usa a média por anúncio, não um total obtido multiplicando por dias. CSV não inclui contactos; datas exatas da janela desconhecidas ficam explícitas.
- Progresso: indicadores atuais ligados às fórmulas da cópia anterior, que continuam a consultar as folhas de trabalho. Não confundir completude do CRM com qualidade, verificação ou correção concluída.

A instalação cria uma cópia oculta do Dashboard antes de reorganizar a vista. Registos de origem e histórico não são apagados. A vista técnica Clara - dashboard alimenta os gráficos e fica oculta. O conteúdo extenso sai apenas da vista principal.

Atualização: ao abrir o documento e ao guardar estatísticas gerais Idealista. Fórmulas de progresso recalculam diretamente. Atualizações usam o bloqueio do documento; falha na vista não invalida uma recolha já guardada. Sem novos itens no menu.

Validação: testes de janela de 30 dias, duplicação, zeros/ausentes e passagem de mês; regressões eGO/Idealista; leitura real das fontes, dos cartões e dos dados dos gráficos. Gráficos recriados a partir da fonte conferida; só os dois gráficos desta vista são substituídos. Uma função de manutenção verificarDashboardVisual permite conferir fontes, fórmulas e intervalos sem alterar dados.
