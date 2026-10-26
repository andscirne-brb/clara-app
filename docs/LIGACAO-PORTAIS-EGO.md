# Ligação entre anúncios dos portais e o eGO

## Verificação de 26 outubro 2026

Na Green-Acres, três fichas públicas da agência foram verificadas: o campo «Número de mandato» contém a referência original eGO. As três referências existem exatamente uma vez na coluna Referência EGO do Levantamento, confirmado por leitura direta sem depender de filtros visuais. A descrição também contém `ref:`, mas o campo explícito é preferível. Não foram alterados dados do levantamento nem criadas associações automáticas nesta verificação.

DOM observado: `.agency-details .label-value`, com `label` igual a «Número de mandato» e valor em `p`. O campo «Referência» é o ID numérico Green-Acres, diferente da referência eGO. As URLs podem redirecionar para caminhos com tipo de imóvel e cidade: identificar anúncio pelo código final estável e conferir também o ID numérico apresentado.

## Implementação proposta, ainda não executada

1. Recolher o mandato explícito da ficha pública e conferir a identidade do anúncio.
2. Associar automaticamente apenas quando a referência existir uma única vez no Levantamento; ausência, duplicação ou divergência ficam por rever.
3. Guardar portal, ID e URL do anúncio, referência eGO, fonte, estado da associação e data da confirmação numa tabela de correspondências. Não inferir pelo preço ou localização.
4. Reutilizar correspondências nas recolhas seguintes, sinalizando divergências sem substituir ligações silenciosamente. Não voltar a consultar todas as fichas em cada recolha estatística.
5. A lista autenticada e a ficha pública têm origens diferentes: testar CORS no marcador. Se a leitura direta não for permitida, resolver no Apps Script com URLs públicas estritamente limitadas ao portal, em lotes pequenos, com progresso, cache e retoma; nunca contornar autenticação.
6. Investigar separadamente as referências originais em Idealista e Rightmove antes de prometer cobertura entre todos os portais.

A amostra prova viabilidade na Green-Acres, não que todos os anúncios tenham mandato preenchido. Ainda não há análise holística implementada.

## Idealista e Rightmove — verificação de 26 outubro

Idealista: descarregada a exportação oficial Excel do ranking atual. O cabeçalho inclui COD. IDEALISTA e REFERÊNCIA INTERNA. Foram lidas 222 linhas, todas com referência interna distinta e não vazia. Leitura direta da coluna do levantamento confirmou 188 correspondências exatas únicas, 34 referências ausentes e nenhuma ambiguidade no levantamento. Não presumir que as ausentes são erro ou imóveis ativos: ranking histórico não equivale à carteira atual. Devem ficar por rever, sem criação automática de imóveis nem alterações ao eGO. O coletor Excel existente já preserva ambos os identificadores.

Rightmove: CSV Property Performance contém Rightmove URL e Agent Reference. Nesta conta, Agent Reference é um código técnico composto, não a referência eGO apresentada à equipa. Em três fichas públicas, a descrição contém uma marca explícita `#ref:` com a referência original. As três correspondem exatamente a uma única linha do levantamento. Guardar separadamente ID Rightmove, Agent Reference e referência eGO; não substituir um pelo outro.

As três plataformas têm uma fonte viável de identificação. A amostra de três fichas Rightmove não prova cobertura total; uma descrição sem referência explícita deve ficar por rever. No Idealista, preferir sempre o Excel oficial às fichas individuais. No Rightmove, verificar primeiro se outra exportação oficial já contém a referência original antes de ler descrições. A ligação persistente e a vista transversal por imóvel continuam propostas, ainda não implementadas.

Verificação realizada sem alterar dados do levantamento. Função temporária de leitura removida; código final reposto. Este documento não contém identificadores reais, dados individuais, URLs privadas nem conteúdos das descrições.

## Primeira implementação — 26 outubro

Módulos ImoveisPortais.gs, LeituraPublicaPortais.gs e Portais.html: tabela de ligações com estados explícitos, histórico de alterações, vista por referência eGO e ficha pesquisável em Clara > Portais: imóveis (também acessível em Progresso > Ficha por imóvel). Na abertura, atualiza a partir das recolhas já guardadas. Referências inexistentes e duplicadas não são associadas; divergência de uma referência previamente confirmada bloqueia a associação. Uma ligação não comprova publicação atual. A ficha mantém métricas e períodos por portal, sem somar janelas nem converter médias em totais.

Consulta pública autorizada pela Andreia em 26 outubro: só Green-Acres e Rightmove; URLs e redirecionamentos limitados aos anúncios originais, sem enviar dados do Sheets aos portais. Lotes de cinco com persistência, retoma e paragem entre lotes. Fichas já identificadas e problemas de acesso não são repetidos automaticamente. Sem CAPTCHA, bypass de autenticação ou dados individuais de leads. Construção com --sem-fichas-publicas permite gerar versão sem chamadas externas.

Testes sintéticos: identidade explícita, referências ausentes e duplicadas, conflito preservando a ligação anterior, ID técnico Rightmove separado, zero real, retoma, URL inesperado, redirecionamento para outro anúncio bloqueado, reposição da tabela e histórico em falha, repetição sem histórico redundante e sintaxe do painel. A ficha e a leitura direta não substituem uma conferência nativa.

O trabalho seguinte continua distinto desta fase: controlo de diferenças de atributos entre fontes comparáveis, regras de publicação esperada, priorização por desempenho e ligação dos alertas confirmados às pendências e ao resumo semanal. Não foram criadas tarefas automáticas a partir de associações não verificadas.

Primeira execução nativa: 380 ligações derivadas das recolhas existentes, 169 confirmadas e 211 por rever. A contagem refere-se ao histórico efetivamente guardado no documento, que difere do Excel novo descarregado apenas para investigação (222 referências, 188 existentes). Não foi importado esse novo Excel nesta fase. A tabela tem histórico próprio e uma vista de todos os imóveis do levantamento. A chamada pública em lote exigiu consentimento Google; o navegador integrado não consegue concluir essa autorização e foi pedida intervenção da Andreia no Chrome. Até essa confirmação, não afirmar que os lotes públicos foram executados nem que todos os portais estão associados.
