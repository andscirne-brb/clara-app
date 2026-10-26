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
