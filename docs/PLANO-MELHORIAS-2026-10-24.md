# Plano de melhoria da Clara — 2026-10-24

Estado: proposta após revisão dirigida do código e dos problemas observados. Não constitui validação integral do documento em produção. Nenhuma alteração funcional aplicada nesta revisão.

## Base já resolvida

Gravação por intervalos com conferência estrita e recuperação; datas enviadas por série numérica em colunas de data; expansão automática do Registo de alterações; leitura parcial que preserva valores conhecidos; vista simplificada de pendências; vista guardada para Sara; resumo com ligações e plano explícito; gráficos de leads dos três portais. A gravação rápida de eGO: estado foi confirmada pela utilizadora após a correção de datas. A expansão do histórico foi validada em testes e numa cópia nativa; aguarda confirmação da próxima gravação real.

## 1. Fiabilidade e coerência — primeira prioridade

- Centralizar a regra de responsável/estado. A lista visível usa Responsável, mas algumas funções ainda selecionam Sara pela coluna interna Aguarda análise de. Edições manuais podem divergir; não há onEdit que reconcilie esses campos. Utilizar uma única regra em tarefas, resumo, indicadores e vista, registando mudanças relevantes. Ao regressar uma tarefa operacional à Andreia após esclarecimento, exigir atribuição coerente, sem inventar a resposta da Sara.
- Proteger o resumo contra respostas antigas. O painel de eGO já verifica revisões; o Resumo não verifica se o plano/período mudou durante a chamada. Acrescentar identificação do pedido, ignorar respostas ultrapassadas e manter Copiar desativado até a versão atual estar pronta.
- Corrigir Onde foi alterado no histórico de novas gravações. Atualmente a criação escreve Levantamento mesmo quando o assunto identifica outra folha. Guardar o destino real; rever registos antigos apenas com evidência, sem reescrever todo o histórico por inferência.
- Estender a gestão de capacidade, hoje automática apenas para o histórico, às folhas que recebem novos textos e pendências. Para tabelas nativas, confirmar expansão da tabela e dos filtros, fórmulas e validações. Não escrever fora da vista sem avisar.

Validação: criar, editar, delegar, responder e concluir uma pendência; comparar aba, resumo e indicadores; testar alteração rápida do plano durante carregamento; encher cada destino numa cópia e confirmar preservação de datas, fórmulas e histórico.

## 2. Rapidez e continuidade do trabalho

- Evitar reconstruir os gráficos em todas as aberturas quando os dados não mudaram; atualizar após recolhas relevantes ou por pedido explícito, mostrando datas de dados e da vista separadamente.
- Medir tempos por fase sem guardar dados recolhidos nos registos de diagnóstico. Definir um orçamento após medições representativas, sem prometer uma duração universal.
- Recuperar rascunhos de leitura e plano semanal de forma controlada, na sessão/localmente, com indicação do imóvel e data e opção de eliminar; nunca gravar dados privados no repositório. Não repetir gravações para medir velocidade.
- Exibir versão do marcador e da aplicação para identificar leituras antigas. Uma mensagem simples deve orientar a atualização quando necessária.

Validação: abertura repetida sem reconstrução; alteração de dados atualiza os gráficos; rascunho recuperado não pode guardar sobre outro imóvel; falhas e tentativas repetidas não duplicam dados.

## 3. Recolha Rightmove Plus

- Criar o leitor dos dois relatórios e a entrada de menu proposta Rightmove: estatísticas, mantendo a lógica de nomes aprovada.
- Leads: ler período, totais e datas das listas de chamadas/emails; agregar sem nomes, telefones, endereços pessoais ou mensagens; percorrer páginas; conferir chamadas + emails e cobertura antes de considerar a leitura completa.
- Performance: percorrer a lista dinâmica, identificar anúncios únicos, conferir quantidade com o total anunciado e guardar período, atualização da fonte, visitas médias, fotos, plantas e comparações apresentadas. Não transformar New entry em percentagem.
- Revisão antes de guardar; identificador de recolha e deteção de repetição/revisão; histórico preservado. Não somar relatórios com períodos sobrepostos.
- Agregar ao dashboard por dia/mês com informação de cobertura. Um intervalo que começa a meio do mês não representa esse mês completo; desconhecido não é zero. Não inferir conversão dividindo métricas incompatíveis.

Validação: comparar leitura com os relatórios e exportações; confirmar cobertura total e duas importações idênticas; testar meses parciais, zeros reais, lista incompleta e seleção de período diferente. Não usar dados reais como testes públicos.

## 4. Consulta e rotina semanal

- Acrescentar atalhos claros para Minhas tarefas, Para a Sara e Dashboard sem alterar os menus sem acordo.
- Validar que a vista da Sara acompanha novas linhas e que os destinatários conseguem abrir as ligações com as permissões existentes; não alterar partilhas sem instrução específica.
- Permitir escolher uma semana de calendário, além dos últimos 7/14/30 dias, mostrando datas e o plano previsto. Manter a destinatária Sara e Cc Idília/Júlia como orientação de envio, sem enviar automaticamente.
- Apresentar aviso quando dados dos portais estiverem desatualizados e permitir ver o período por gráfico. Não dar a mesma aparência a dados incompletos e a resultados completos.
- Integrar leads do eGO apenas quando houver relatório autorizado com data/origem e definição da contagem. Comparar duplicados entre origens apenas se a fonte o permitir, sem requisitar dados pessoais desnecessários.

Validação: abrir ligações como utilizador autorizado; confirmar filtros com tarefa nova e concluída; preparar email com semana selecionada, tabela resumida e plano revisto; conferir que o pedido pontual de acesso eGO não aparece fora da semana definida.

## Regras de execução

Aplicar uma fase de cada vez. Testar primeiro em dados fictícios/cópias, verificar o percurso afetado no Sheets e publicar código, testes e documentação no repositório. Preservar fórmulas, histórico, dados reais e possibilidade de recuperação. As correções de fiabilidade precedem novos indicadores ou decoração do dashboard.

## Execução por pontos

2026-10-24: implementado o primeiro ponto, gestão coerente de responsável/estado. As listas e o resumo deixaram de depender da coluna interna; dashboard segue a mesma regra, e edições manuais são sincronizadas por onEdit. Testados delegação, devolução, conclusão, repetição e recuperação; percursos confirmados em cópias nativas. Ver GESTAO-PENDENCIAS.md. Os restantes pontos continuam por executar.

2026-10-24: implementado o segundo ponto, proteção assíncrona do resumo semanal. Alterações invalidam a cópia; respostas antigas não substituem a versão atual; pedidos iguais em curso não são duplicados; erros mantêm o plano. Validado por testes de respostas fora de ordem, plano/período alterados e recuperação.

2026-10-24: implementado o terceiro ponto. Novas entradas do histórico usam o nome real da folha de destino em Onde foi alterado, em vez do valor fixo Levantamento. Registos antigos preservados. Testes abrangem Levantamento, Textos por idioma e Pendências da equipa, antes/depois e repetição sem duplicados.

2026-10-24: quarto ponto implementado — capacidade de Textos por idioma e Pendências da equipa preparada antes da gravação, com reanálise após inserção. Validados registos, formatos e filtros em cópias nativas; testes de gravação após expansão e repetição.

## Quinto ponto: abertura do dashboard

Implementada verificação das fontes antes de reconstruir gráficos. Reutiliza a vista sem alterações, preserva datas e mantém atualização técnica forçada. Testes de alterações manuais, falhas e concorrência aprovados. Ver DESEMPENHO-DASHBOARD.md.

## Sexto ponto: continuidade da recolha

Rascunho local por documento, recuperação com nova análise obrigatória, aviso de gravação interrompida e identificação da versão do marcador. Testes aprovados. Ver RASCUNHOS-E-VERSAO.md.
