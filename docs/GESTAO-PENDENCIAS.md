# Gestão coerente das pendências

Responsável e Estado são os campos operacionais. A coluna interna Aguarda análise de é mantida apenas por compatibilidade; não determina a seleção do resumo, da lista ou dos indicadores.

- A aguardar esclarecimento: Sara é responsável.
- Alterar Responsável para Sara numa tarefa aberta: passa a A aguardar esclarecimento.
- Devolver para Andreia: passa a Por tratar. Alterar Estado de A aguardar esclarecimento para Por tratar ou Em curso devolve a tarefa à Andreia.
- Concluído e Não aplicável: excluídos das listas abertas; não implicam uma resposta inventada nem alteram o responsável histórico.
- Uma revisão documental completa que substitua a necessidade de esclarecimento por uma ação operacional pode devolver a tarefa à Andreia; leituras parciais não reduzem faltas conhecidas.

O onEdit sincroniza alterações manuais nos campos operacionais e regista mudanças no histórico, com bloqueio, conferência e recuperação. As gravações da aplicação seguem a mesma regra. O comando técnico sincronizarResponsaveisPendencias reconcilia registos existentes, sem nova entrada quando nada mudou.

O dashboard aplica o mesmo critério de leitura da lista e do resumo: tarefas abertas atribuídas a Sara ou à espera de esclarecimento contam para Sara, sem duplicação. A vista guardada usa a coluna Responsável após sincronização.

Validação: testes com dados fictícios para delegação, devolução, conclusão, resumo independente da coluna antiga, histórico e repetição; cópias nativas antes de aplicação. Edições em massa extensas podem exceder a duração de um acionador simples; se surgir aviso, confirmar os campos e executar reconciliação. Não enviar mensagens à Sara automaticamente.
