# Melhoria do processo de recolha

## Implementado
- Gravação por intervalos e duração mostrada na confirmação. A duração real otimizada deve ser medida na próxima utilização; não repetir registos para ensaio.
- Leitura parcial preserva estados conhecidos e os identifica como não reconfirmados no painel. Não resolve pendências de texto alternativo com leitura parcial.
- Pendências existentes de imagens, textos e plantas atualizam evidência/ação apenas quando a leitura do bloco é válida. Responsável, prioridade e estado preservados.
- Cruzamento conservador entre descrição PT e nomes de dez tipos de características. Mostra sugestões com excerto e itens assinalados sem menção afirmativa detetada. Negações e hipóteses excluídas. Não prova existência física nem cobertura de todas as características.
- Marcador lê nomes do bloco DOM do imóvel e exclui Zona Envolvente. Se o bloco não estiver disponível, só aceita nomes estruturados completos; leituras antigas sem nomes não produzem conclusão. Atualizar marcador uma vez.
- Sugestões por confirmar registadas em Campos de características em falta quando a coluna existe. Sem leitura válida, preserva o texto anterior. Não altera o eGO.
- Dashboard distingue datas dos dados e atualização da vista. Atualizar a vista não recolhe portais.

## Rotina
1. Abrir o anúncio público e clicar no marcador atualizado.
2. Colar em eGO: estado; confirmar só os documentos vistos no eGO/dossier.
3. Rever alterações, campos não reconfirmados e sugestões; guardar uma vez.
4. Corrigir no eGO e recolher de novo para confirmar. Consultar tarefas na folha de pendências e resultados no dashboard.
5. Idealista mantém marcador, colagem, revisão e confirmação; não mudar nomes do menu sem autorização.

## Validação e limites
Testes sintéticos de regressão, pendências parciais e preservação de estados; inspeção do bloco real de características no site. O percurso de gravação com a nova extração e a duração otimizada requerem próxima utilização real autorizada, não substituída por simulação. Sem novas abas nem novos indicadores de resultado.
