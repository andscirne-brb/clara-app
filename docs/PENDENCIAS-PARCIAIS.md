# Pendências documentais parcialmente resolvidas

A análise eGO atualiza a evidência e a ação de uma pendência documental aberta quando os quatro documentos são explicitamente conferidos. A evidência enumera apenas os documentos ainda em falta ou na categoria errada. Mantém ID, assunto estável de associação, responsável, prioridade, estado e data de criação. Alterações conservam antes/depois no histórico transacional existente.

Uma leitura incompleta não reduz a lista anterior. Repetir a mesma leitura não cria histórico duplicado. Pendências concluídas continuam a seguir a reabertura existente; Não aplicável não é sobrescrito. O painel antecipa a nova evidência nas pendências já registadas.

Validação: testes sintéticos de redução de quatro documentos para um, preservação de gestão, histórico, repetição idempotente e leitura incompleta, além das regressões de gravação e interface.
