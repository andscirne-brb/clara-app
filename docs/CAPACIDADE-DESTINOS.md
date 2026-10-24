# Capacidade dos destinos de gravação

A Clara prepara espaço em Pendências da equipa e Textos por idioma antes de planear uma gravação. A leitura de vagas fica limitada à zona de dados, evitando utilizar linhas exteriores à tabela apenas porque a folha tem mais linhas físicas.

Quando falta reserva, insere pelo menos 200 linhas antes da última linha da zona de dados. A inserção interna permite que a tabela e referências acompanhem a expansão. Copia formatos e validações existentes, não copia valores dos registos, e mantém apenas a fórmula de Conferência nas novas linhas de pendências. A análise é repetida após crescimento para não utilizar posições anteriores à inserção. O histórico mantém a expansão automática já implementada.

Não se deslocam linhas durante a aplicação do plano de escrita. Se não for possível ampliar por limite ou proteção, a Clara interrompe antes de gravar os dados da leitura. Linhas de reserva eventualmente criadas permanecem disponíveis; não se apagam dados para libertar espaço.

Validação: cópias nativas de ambas as folhas; testes fictícios para preservação do último registo, datas, conferência, repetição, falha de expansão e caminhos existentes de gravação/recuperação. Limites globais do Google Sheets continuam a aplicar-se.

Nas tabelas filtradas, os critérios são guardados e suspensos durante a preparação, depois repostos também em caso de erro. A confirmação do intervalo usa uma nova leitura do filtro, pois o objeto anterior pode manter dimensões em cache. Testes nativos confirmaram expansão e critérios preservados nas duas folhas.
