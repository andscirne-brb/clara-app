# Abertura do dashboard

A abertura compara uma assinatura dos valores das fontes e da presença dos gráficos. Se nada mudou desde uma construção bem-sucedida, reutiliza a vista. Alterações em células existentes também invalidam a assinatura, mesmo sem novas linhas.

As fontes são Idealista, leads por período, anúncios e histórico Rightmove, Levantamento, histórico de indicadores e pendências. A versão da estrutura e o fuso horário fazem parte da assinatura. A folha auxiliar gerada não entra como fonte.

A atualização técnica `atualizarDashboardVisual` mantém a reconstrução forçada. Não foram alterados nomes no menu. As fórmulas de indicadores continuam a recalcular normalmente. A comparação ainda exige leitura das fontes, mas evita a formatação e substituição de gráficos sem necessidade.

Falhas não registam sucesso. Se os dados mudarem durante a construção, a abertura seguinte volta a atualizar. A data da vista não é avançada quando é reutilizada; as datas de recolha permanecem identificadas por portal.

Validação automatizada: reutilização sem mudança, alteração de valor, recuperação após falha e alteração concorrente. A duração real depende do serviço Google Sheets e do volume das fontes.


## Atualização após CSV Rightmove

A assinatura da vista considera a projeção efetiva de 30 dias, não os identificadores de importação nem o detalhe de 60/90 dias. Uma nova recolha com os mesmos valores apresentados não reconstrói a vista. Mudanças reais de médias, carteira ou data continuam a invalidá-la. O histórico de medições gerado pela vista deixou de invalidar a própria assinatura.

Cada gráfico mantém também uma assinatura dos seus dados, opções, intervalo, folha de origem, posição e identidade. Numa atualização da vista, gráficos com a mesma assinatura e identidade são reutilizados. Gráficos removidos ou substituídos são reconstruídos quando a rotina de atualização os avalia. A primeira atualização após esta versão estabelece as assinaturas.

O CSV lê o histórico de desempenho uma vez para preparar as três janelas, em vez de o reler para cada uma. A fotografia da leitura é usada apenas durante a mesma preparação.

As gravações Rightmove registam espera pelo bloqueio, preparação, escrita e conferência, dashboard e total em milissegundos. Os registos não contêm referências, descrições ou dados de leads. O painel mostra os segundos da gravação dos dados e do dashboard separadamente, além do tempo total observado no navegador. Repetições não atualizam o dashboard.

Os testes cobrem importações equivalentes, alterações reais, gráficos substituídos, opções alteradas, leitura única, fases medidas e ausência de dados privados nos registos. A nova medição não permite inferir a divisão interna das execuções antigas.

Medição nativa em 25/10/2026: primeira atualização com estabelecimento das assinaturas 16,355 s; atualização forçada preservando os mesmos três gráficos 7,477 s; verificação sem alterações 2,512 s. Identidades dos gráficos preservadas e conferência sem erros em células. São tempos do dashboard, não de uma nova gravação completa.
