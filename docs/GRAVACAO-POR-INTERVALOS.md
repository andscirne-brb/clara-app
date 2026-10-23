# Gravação por intervalos

A gravação eGO usava uma escrita por célula, incluindo cada célula do histórico. Agrupa agora apenas células planeadas adjacentes na mesma linha, sem preencher lacunas nem substituir fórmulas. Cada intervalo mantém comparação de valores, fórmulas e formatos antes e depois, escape literal de strings e rollback dos intervalos tentados. Não muda formatos das colunas tipadas.

O painel mostra A guardar… no botão enquanto espera a resposta. A proteção contra segundo clique continua ativa.

Validação: regressões sintéticas de tipos, zeros iniciais, fórmulas, CRLF, repetição, erro e rollback; teste de lacunas não incluídas; menos chamadas remotas de escrita no cenário sintético. A redução do tempo real tem de ser medida numa próxima gravação real; não há promessa de segundos fixos. Não repetir dados operacionais apenas para medir.
