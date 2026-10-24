# Abertura do dashboard

A abertura compara uma assinatura dos valores das fontes e da presença dos gráficos. Se nada mudou desde uma construção bem-sucedida, reutiliza a vista. Alterações em células existentes também invalidam a assinatura, mesmo sem novas linhas.

As fontes são Idealista, leads por período, anúncios e histórico Rightmove, Levantamento, histórico de indicadores e pendências. A versão da estrutura e o fuso horário fazem parte da assinatura. A folha auxiliar gerada não entra como fonte.

A atualização técnica `atualizarDashboardVisual` mantém a reconstrução forçada. Não foram alterados nomes no menu. As fórmulas de indicadores continuam a recalcular normalmente. A comparação ainda exige leitura das fontes, mas evita a formatação e substituição de gráficos sem necessidade.

Falhas não registam sucesso. Se os dados mudarem durante a construção, a abertura seguinte volta a atualizar. A data da vista não é avançada quando é reutilizada; as datas de recolha permanecem identificadas por portal.

Validação automatizada: reutilização sem mudança, alteração de valor, recuperação após falha e alteração concorrente. A duração real depende do serviço Google Sheets e do volume das fontes.
