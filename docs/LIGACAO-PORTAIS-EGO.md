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
