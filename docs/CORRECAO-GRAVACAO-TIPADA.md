# Gravação em colunas tipadas

As colunas tipadas do Google Sheets rejeitam setNumberFormat. A gravação e a recuperação deixaram de alterar formatos.

escreverLiteralClara_ usa o escape nativo por apóstrofo para texto literal e preserva os tipos de números e datas. A conferência de valores, fórmulas e alterações concorrentes mantém-se.

Validação: testes sintéticos de gravação e recuperação, incluindo texto numérico, zeros iniciais, apóstrofos e texto com sinal de igual. O mock rejeita qualquer chamada de formatação. Regressões eGO e Idealista passaram. Testes de integração em cópias de tabelas tipadas confirmaram escrita e reposição sem alterar formatos.

A transação completa com a leitura original do utilizador ainda aguarda validação. Não confundir os testes em cópias com uma gravação operacional concluída.
