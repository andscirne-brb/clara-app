
## Automação após recolha e conferência — 26/10/2026

- Dispatcher devolve sinal de identificação apenas após gravação válida de inventário novo (Idealista lista/ranking/carteira, anúncios Green-Acres, desempenho Rightmove). Repetições e séries agregadas de leads não iniciam consultas desnecessárias.
- Painel confirma primeiro a gravação; depois processa as ligações em pedidos separados de cinco fichas, enquanto estiver aberto. Pedidos simultâneos no mesmo painel são reunidos. Fechar o painel interrompe a continuação; retoma pelo menu Portais: identificar anúncios. Falha de identificação não invalida dados guardados e não pede nova importação. Não há acionador agendado nem recolha autónoma de sessões dos portais.
- Resumo comum de conferência na revisão: duplicação, data anterior à atual, lacunas, lista parcial, ranking sem Excel, ausência de série diária/carteira e avisos da fonte. Os validadores específicos continuam a bloquear dados incoerentes. Períodos mantêm-se separados; idade da leitura é aviso, não rejeição de histórico válido.
- Menu Portais: conferência abre vista gerada com os casos pendentes e próximo passo. Fontes preservadas; não cria pendências da equipa. Verificação nativa: 363 confirmadas, zero novas por identificar, 17 por rever (9 referências ausentes no levantamento e 8 fichas públicas por confirmar). A verificação e geração da vista terminaram em cerca de 13 s; não representa tempo de gravação nem garantia.
- Vistas idênticas não são regravadas. Testes cobrem repetição, conservação de zeros, conflitos, avisos, falha depois da gravação, concorrência no painel, retoma e ausência de escrita redundante.
- Mantidas apenas três abas visíveis: Dashboard, Levantamento e Pendências da equipa. Vista de revisão fica oculta até ser solicitada. Marcador permanece 20261026.2: esta alteração não exige reinstalação.
- Não foi efetuada nova importação real pelos painéis nesta validação; fluxo pós-gravação testado localmente e chamada nativa conferida com a fila real vazia. Os 17 casos não foram forçados a correspondências. Próxima fase: comparar eGO e portais e definir publicação esperada antes de gerar alertas.

## Validação final e organização diária — 26/10/2026

- Consulta pública validada no Chrome autorizado. Das 380 ligações de anúncios, 363 estão confirmadas e 17 exigem revisão: Green-Acres 147/156, Idealista 169/174, Rightmove 47/50. São ligações por portal, não imóveis únicos. Repetição da atualização: zero alterações; fila inicial: zero candidatos ainda não tentados.
- Ficha nativa com seletor B3 e três portais lado a lado. Leitura de dados medida em 2,2 s; primeira renderização nativa em 5,9 s, repetição em cerca de 4,5 s. Valores são medições de um ensaio, não garantia. Painel HTML opcional não foi validado no Chrome automático (iframe vazio); menu principal abre a ficha nativa.
- Referências com separadores, sufixos ou apenas números são preservadas literalmente; sem inferir correspondências por morada ou preço. Falha de acesso público não aborta outras fichas. Marcador 20261026.2 permite confirmar pela página pública quando o serviço Google não a consegue consultar.
- Auditoria de dependências das três folhas antigas de teste de gravação: nenhuma referência em fórmulas, gráficos ou intervalos nomeados; limpeza autorizada pela utilizadora. Cópias anteriores reais preservadas.
- A vista diária mantém apenas Dashboard, Levantamento e Pendências da equipa visíveis. Fontes, históricos, ligações e ficha ficam ocultos; a ficha é mostrada quando solicitada pelo menu. Cópias de segurança são preservadas.
- Fases seguintes ainda por implementar: diferenças entre fontes, publicação esperada, alertas de desempenho e geração de pendências/relatório a partir desses alertas. Nenhum email enviado.

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

## Correções e teste público real

Após consentimento, execução no Chrome confirmou leitura correta de uma referência de cada portal. O HTML Green-Acres codifica o acento de «Número» como entidade numérica; o leitor passou a descodificá-la. Formatos com espaço, hífen ou underscore são preservados literalmente e só ligados quando a referência existe de forma única; não são removidos separadores por suposição.

Uma ficha pública abre no browser mas devolve «Endereço indisponível» ao serviço Google. O lote agora isola esse erro e continua com os restantes anúncios, registando o problema sem contornar o acesso. Há alternativa no marcador 20261026.2: na ficha pública Green-Acres ou Rightmove, recolhe somente os identificadores e a referência explícita num pacote CLARA5. Colar no painel de estatísticas desse portal permite rever e guardar a ligação. O anúncio tem de existir nas recolhas e o ID/endereço têm de coincidir; divergências com a referência anterior ficam em conflito, não são substituídas.

A resposta HTML é conferida quanto à identidade: ID numérico explícito Green-Acres ou canonical do anúncio Rightmove. Redirecionamentos para outro anúncio são recusados. Testes adicionais cobrem entidades HTML, separadores, isolamento de falhas de rede, ligação via marcador, repetição sem novo histórico e preservação de ligação anterior em conflito. A ficha indicada pela Andreia foi lida no navegador, conferida e guardada pela mesma validação CLARA5, sem publicar o respetivo payload no repositório.
