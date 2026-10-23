# Desempenho da gravação eGO

A primeira otimização reduziu escritas por célula, mas continuava com leituras individuais na preparação e intervalos de histórico por linha. A versão atual:
- Lê valor, fórmula e formato uma vez por linha durante a preparação; carrega as linhas novas do histórico num intervalo.
- Reutiliza dimensões por folha durante a operação.
- Procura vagas em páginas de 200 linhas, parando quando encontra espaço suficiente.
- Agrupa retângulos consecutivos com a mesma largura e coluna, sem preencher lacunas ou fórmulas.
- Confere valores, fórmulas e formatos por retângulo antes/depois; repõe todos os intervalos tentados em caso de falha.
- Regista tempos separados de análise, preparação, conferência anterior, escrita e conferência posterior. O resultado inclui ms, número de células e intervalos. Logs não contêm textos recolhidos.

Regressões sintéticas cobrem recuperação após falha parcial de um bloco, células numéricas como texto, zeros iniciais, fórmulas, lacunas e deduplicação. A redução de chamadas foi verificada no cenário sintético. Não há duração real prometida: medir a próxima gravação normal e consultar os tempos por fase se necessário. Não repetir registos operacionais para benchmark.
