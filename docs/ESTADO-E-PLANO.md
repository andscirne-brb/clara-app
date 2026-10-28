## 28 outubro — piloto da recolha conjunta

Preparada recolha conjunta Green-Acres (cinco CSV + lista de anúncios) numa única leitura CLARA6, com falhas e gravação por bloco explícitas. Marcador 20261028.1 exige atualização. Validadores reais testados no Google com dados sintéticos sem importação; falta clique integral do marcador e gravação real conjunta no navegador habitual. Ver RECOLHA-CONJUNTA.md. Idealista e Rightmove ainda não têm coordenação de recolha conjunta.

## 28 outubro — avisos de desempenho para revisão

Implementado o primeiro conjunto de avisos por anúncio prioritário, com regras e limites em ALERTAS-DESEMPENHO.md. Fonte, data e período visíveis; não compara métricas entre portais nem cria tarefas. Leituras parciais ou incompatíveis ficam sem conclusão. Próximos passos: completar histórico comparável e rever os avisos antes de desenvolver a passagem para pendências/resumo.

## Atualização de 28 outubro — âmbito corrigido pela Andreia

Os prioritários já estão marcados no Levantamento; usar essa seleção. A presença nos portais é apurada pela equipa no levantamento, sem depender da Idília. Retirada da interface e do bundle a confirmação de destinos introduzida no incremento anterior; nenhuma decisão real foi guardada.

Implementados: consulta dos prioritários, comparação nominal de preços com fontes datadas e resumo semanal que separa correções documentadas de verificações. Implementada a presença observada por imóvel, com fonte, data e âmbito das recolhas, sem inferir ausência. Ver PRESENCA-PORTAIS.md. Próximo: melhorar a cobertura e atualidade das fontes antes de concluir ausência e preparar alertas de desempenho comparáveis. Alertas de desempenho, tarefas derivadas e comparação de áreas/tipologia permanecem por implementar. As notas datadas abaixo preservam o histórico e podem descrever etapas já concluídas.

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

# Clara: estado e plano

## 26 outubro — ligações e ficha por imóvel

Disponível «Clara > Portais: imóveis»: ligações por referência explícita, histórico, vista geral por eGO e ficha que separa os indicadores e períodos de Idealista, Green-Acres e Rightmove. Identificação pública em lotes de cinco, guardados para retoma; atualização inicial em curso. Consulta pública autorizada pela Andreia e testada no Chrome. O navegador integrado continua a recusar essa autorização; não representa falha da conta no Chrome.

Marcador 20261026.2 acrescenta recuperação CLARA5 nas fichas públicas para anúncios cujo acesso pelo Google falha. Confere ID/endereço e referência única no levantamento, sem associação por preço/localização. Casos ausentes, duplicados ou divergentes ficam por rever. Não afirmar publicação atual a partir de um ranking histórico. Ver detalhes, testes e limites em [LIGACAO-PORTAIS-EGO.md](LIGACAO-PORTAIS-EGO.md).

Próximas fases, ainda não implementadas: comparação de atributos, publicação esperada, alertas de desempenho, tarefas derivadas e integração desses alertas no resumo semanal. Nada foi enviado por email.


## 26 outubro — Green-Acres: estatísticas por anúncio

Marcador 20261026.1 mantém os cinco CSV oficiais no Resumo da conta e acrescenta a Lista dos anúncios. Nesta lista não foi encontrada exportação CSV/Excel: lê a pesquisa oficial com os filtros atuais, sem ações de publicação, sem navegar a página visível e sem recolher contactos individuais. Consulta páginas em grupos de três, reconfirma a primeira e a página original, bloqueia referências repetidas, páginas em falta, alterações de filtros e somas divergentes. Fotografias sem contagem visível ficam desconhecidas.

Validação DOM real: oito páginas, 156 referências únicas, 28 sem planta; quatro somas iguais aos totais da lista. Testes sintéticos cobrem duplicação, validação, cobertura, rollback, pesquisa sem publicação e reconferência. Importação revista no painel existente Green-Acres: estatísticas; destino Green-Acres - anúncios, histórico separado, sem somar recolhas repetidas nem substituir os CSV mensais no dashboard. Referências são do portal; não presumir correspondência eGO. Estatísticas por anúncio atualizadas pelo portal a cada 24 horas e período guardado tal como selecionado. A seleção Este mês é parcial; não equivale aos últimos 30 dias.

Para usar: reinstalar marcador; abrir Lista dos anúncios; clicar Clara; colar em Green-Acres: estatísticas; rever cobertura e guardar. Teste integral do novo marcador na sessão da utilizadora ainda por confirmar; parser e somas reais verificados. Teste nativo no Apps Script gravou e releu 156 linhas na nova aba: preparação 29 ms e escrita/conferência 1155 ms. Função temporária privada removida e código final relido; transporte do marcador coberto por teste sintético.


## Último ponto de situação — 25 outubro: correção CSV mensal Green-Acres

Erro reportado pela Andreia no marcador 20261025.5: O CSV mensal não ficou disponível. A procura no HTML inicial do relatório dependia de renderização JavaScript. Corrigido em 20261025.6: constrói o endereço oficial do botão CSV mensal (ExportTableCsv/4726, groupBy MONTH) com a conta lida da exportação visível atual. Endereço e parâmetros comparados no navegador com o botão real: idênticos. Não depende do gráfico nem de ler HTML de páginas intermédias; ficam apenas os cinco pedidos CSV em paralelo. Mantém validações de conta, cabeçalhos, datas e somas; rejeita dados incompatíveis e repõe o separador original em falha.

Teste de regressão cobre HTML sem ligação CSV (não deve ser consultado), cinco pedidos diretos, conta correta e parâmetros mensais, CSV inválido e reposição do separador. Testes de interface e Green-Acres passaram. Marcador, indicação da versão no painel e instalação atualizados para 20261025.6. Teste do marcador 20261025.6 confirmado pela Andreia e pelo print: cinco CSV reconhecidos, aviso de recolha já guardada correto. Conferência direta no Sheets confirmou uma única importação, indicadores e gráfico mensal coerentes, sem duplicação; lacuna diária preservada sem zero. A recolha corresponde aos CSV já importados no teste anterior. Sem novos dados importados nesta correção.


## Último ponto de situação — 25 outubro: Green-Acres

Pedido da Andreia implementado: Green-Acres: estatísticas no menu, painel com logótipo e marcador 20261025.5. No Resumo da conta, recolhe cinco CSV oficiais (prioridade sobre a leitura visual e sobre Excel quando ambos existem): visitantes únicos diários, emails diários, visualizações em lista, anúncios Green-Acres/Vizzit e visitas/contactos mensais. Descobre as ligações oficiais na página e nos relatórios; usa a sessão local, confirma mesma conta e restaura o separador visual original. Não recolhe contactos individuais, nomes ou emails pessoais. Se faltar CSV requerido, bloqueia a recolha em vez de inventar cobertura; os cinco relatórios observados têm CSV e Excel.

CLARA4, validação estrita de datas/valores/conta/cinco relatórios, somas mensais conferidas no CSV, lacunas preservadas sem zero. Conta e âmbito guardados para auditoria; relatórios diários mantêm a seleção de sites all e anúncios dos dois sites em indicadores separados. Relatório mensal usa o âmbito definido pelo portal. Não confundir emails, visitantes únicos e contactos do CSV mensal; o dashboard chama a estes últimos contactos, sem os apresentar como contactos únicos.

Histórico em Green-Acres - recolhas, acrescentado em lote e conferido integralmente, com rollback e proteção de repetição. Strings e datas escritas literalmente para evitar conversões nativas do Sheets. Dashboard prefere o CSV mensal e preserva a alternativa histórica anterior enquanto não houver importação; mostra meses recentes e assinala mês corrente parcial. Dados de Leads por período preservados. Gráficos existentes de Idealista/Rightmove mantidos. Tempos de preparação, escrita/conferência e dashboard devolvidos ao painel; repetição não atualiza dashboard.

Testes sintéticos de parser, datas PT, totais, lacunas, privacidade, gravação, repetição/revisão, rollback e reposição do separador passaram. Importação real dos CSV descarregados no navegador confirmada no Sheets e gráfico mensal confirmado; primeira tentativa foi reposta por divergência na conferência, corrigida pela escrita literal. Wrapper privado de teste removido do código final; CSV, leituras, identificadores reais e screenshots não vão para o repositório. Conferência direta na folha confirmou uma única importação e a assinatura esperada em todas as linhas. Segundo teste nativo de repetição interrompido por falta de resposta antes de devolver análise. Painel Green-Acres e logótipo abrem; RPC do painel no navegador integrado continua a recusar acesso à folha (limitação conhecida; testar no Chrome habitual da Andreia). Falta confirmar o clique completo no marcador reinstalado pelo utilizador; não confundir teste dos CSV/servidor com execução automática real do marcador. Próximo passo: reinstalar versão 20261025.5, clicar em Clara no Resumo da conta Green-Acres, colar em Green-Acres: estatísticas e conferir repetição/novos dados.


## Último ponto de situação — 25 outubro: organização do menu

Andreia aprovou manter o menu nativo, com acesso direto e separadores entre plataformas, em vez de acrescentar um painel de navegação. Ordem: eGO; Idealista (duas funções juntas); Rightmove; opções gerais (Progresso, Resumo semanal, Instalar o marcador). Nomes das funções preservados. Green-Acres só entra quando existir funcionalidade disponível, sem opção vazia ou sem ação. Logótipos continuam nos painéis laterais. Sem alteração do marcador ou dos dados.


## Último ponto de situação — 25 outubro: logótipos nos painéis

Andreia aprovou logótipos oficiais nos painéis laterais; o menu nativo mantém os nomes Plataforma: função, sem imagens (limitação Google). eGO, Idealista e Rightmove no cabeçalho, com proporções preservadas e texto acessível; a marca acompanha a origem da leitura. Imagens incorporadas via logos/logos.json, sem pedidos externos ou partilha de dados. Fontes oficiais documentadas na pasta logos.

Idealista: estatísticas passa da caixa nativa de colagem para o painel lateral existente Colar/Rever/Guardar, usando os mesmos analisador e gravador. Abertura comum escolhe marca e oculta documentos fora do eGO. Caixa antiga mantida em função interna como alternativa, sem item novo no menu. Corrigida correspondência do aviso da versão do marcador para 20261025.4; marcador não foi alterado e não precisa de reinstalação nesta atualização visual.

Testes de marca ao trocar de leitura, abertura por plataforma e regressão. Verificação visual efetuada nos três painéis reais no Sheets, com logótipos e títulos corretos; código guardado com leitura de volta idêntica. Testes passaram. Esta validação é de apresentação e abertura dos painéis, não uma nova importação de dados.




## Último ponto de situação: 25 outubro (Claude): tarefas dos perfis

Pedido da Andreia (22/10, registado a 25/10): informação dos perfis dos portais no Sheet, no formato atual (tarefas em Pendências da equipa, Tema "Perfil do portal", Referência = portal; Perfis dos portais com uma linha por portal).
- P0026 (green-acres, nome e logótipo): nome público já alterado para "Janela Imobiliária" pela Andreia; falta centrar o logótipo (continua a aguardar a Sara para versões do logótipo e manual de marca).
- P0028 (green-acres) e P0033 (rightmove), Apresentação e idiomas: ação atualizada para "atualizar a descrição e verificar se é possível inserir noutros idiomas".
- Novas P0065 (idealista: atualizar o logótipo) e P0066 (idealista: atualizar a descrição), Andreia, Por tratar, com ligação ao perfil e a fórmula de Conferência copiada de uma tarefa de portal existente.
- Perfis dos portais: idealista passou de "Por levantar" a "Por rever" (22/10), com ligação.
- Notado, não alterado: P0030 e P0034 estão Concluído mas a Conferência pede "Validar conclusão" (falta resposta, data de resolução ou Confirmado).
- Código do projeto Apps Script reposto exatamente como estava (função temporária removida). A versão da Clara desta sessão de 22/10 (eeeb547) já tinha sido incorporada e ultrapassada pelo trabalho do Codex; não colar versões antigas.

## Último ponto de situação — 25 outubro: carteira ativa Idealista

Aprovado pela Andreia: um clique no gráfico recolhe estatísticas e tenta obter a carteira atual através da ligação dos anúncios ativos. Lista oficial de publicação, ScopeId=1; percorre as páginas, confere total, IDs únicos e primeira página no fim. Não navega a página principal nem altera o período. Prefere HTML direto; se a lista depender de JavaScript, aguarda renderização numa janela interna temporária da mesma origem e remove-a em sucesso/falha. Se falhar, copia estatísticas com aviso explícito, sem registar carteira parcial nem inferir saídas.

Sheets: carteira completa guardada no histórico existente com tipo carteira_ativa, marcador totalAtivos (inclui zero), referências e códigos. Comparação apenas entre recolhas completas da mesma seleção. Pré-visualização e dashboard distinguem primeira recolha de entradas/saídas. Vista derivada Idealista - ativos mostra lista atual e saídas desde a anterior; histórico permanece intacto. Gravação dos dados em lote, uma leitura do histórico para preparar a importação.

Marcador 20261025.4 requer reinstalação. Corrigida também uma chamada duplicada à exportação Excel detetada no marcador anterior. Testes automáticos de cobertura, repetição, zero, mudanças da lista, renderização dinâmica e restauro. Lista real conferida no navegador: total 50, segunda página 20 e última página 10. Código guardado no projeto ligado com conferência da versão anterior. Falta teste completo com o marcador reinstalado e confirmação de gravação da primeira carteira pelo utilizador. Não afirmar que a primeira carteira real já foi importada.


## Último ponto de situação — 25 outubro: Excel do ranking Idealista

Regra da Andreia: nas estatísticas, dar prioridade à exportação oficial CSV/Excel quando existe. Rightmove já prefere CSV; o ranking Idealista passa a obter o XLS completo pelo formulário oficial, na sessão local. Sem serviços externos ou bibliotecas remotas. Leitor restrito CFB/BIFF8, rejeita fórmulas, encriptação, formatos não reconhecidos e dados incoerentes. Não executa macros.

O Excel inclui referência interna e contactos agregados. Não inventar separação chamadas/mensagens nas linhas que não foram conferidas na página. Período e filtros vêm da página e são conferidos antes/depois; todas as métricas das linhas visíveis têm de coincidir com o Excel. Exportação presente mas inválida bloqueia a recolha; sem exportação mantém leitura visível com cobertura explícita. Gráfico geral e comparativo da zona continuam separados.

Validação local do ficheiro real: todas as 50 linhas visíveis coincidem; Excel contém 222 imóveis. Nenhum dado real foi incluído no repositório. Testes locais de parser, coerência, captura do formulário e regressão passaram. Código guardado no projeto ligado com leitura de volta idêntica. Falta teste do clique no novo marcador reinstalado pelo utilizador: a captura automática do formulário está testada com simulação, o download oficial e o cruzamento das linhas foram verificados na sessão real. Marcador 20261025.3 requer reinstalação após publicação.


Documento de passagem de testemunho. Mantido atualizado no fim de cada sessão. Sem dados reais (repositório público).

## DECISÃO (21 out 2026, 23:55): a Clara passa a viver dentro do Google Sheet

Aprovado pela Andreia ("gosto da ideia de ter tudo num só lugar"). A aplicação de Windows (Tauri) fica **em pausa**: continua instalada e funcional na 0.7.4, mas não recebe novo desenvolvimento. Todo o trabalho novo é feito no Google Sheet do levantamento com Apps Script:
- **Menu "Clara" e painel lateral dentro do Sheet** (script ligado ao Sheet), para rever só as dúvidas.
- **Botão "Ler esta página"** (marcador no navegador) na página pública do imóvel: lê os dados que a página carregou e as 4 versões noutros idiomas e envia-os para um serviço Apps Script restrito à conta janela.pt, que preenche o Levantamento e cria as pendências. Plano B, se o Google da Janela bloquear o serviço: o botão copia um resumo e a Andreia cola-o no painel da Clara no Sheet.
- **Apps Script diário**: relê títulos e descrições (JSON-LD) dos imóveis com ligação guardada.
- **Documentos (só no EGO):** o mesmo marcador "Clara" reconhece em que página está. Na ficha do imóvel no EGO (sessão da Andreia) lê o bloco "Documentos" e envia só se cada categoria tem ficheiro (Caderneta Predial, Certificado Energético, Contrato de Mediação Imobiliária, Licença de Habitação) e quantos ficheiros há em "Outros documentos" (nunca nomes nem conteúdo dos ficheiros). Preenche as 4 colunas "(anexo)" do Levantamento; "Outros documentos" com ficheiros gera dúvida "rever se algum é um documento obrigatório mal classificado". Documento em falta (regra da Andreia, 22/10): primeiro a Andreia verifica o dossier no escritório e carrega no EGO; só o que não estiver no dossier passa a pergunta à Sara. P0020 já atualizada assim. Plano B: 4 caixas no painel da Clara.
- Deixa de existir a "ponte" por ficheiros e a escrita no XLSM.
- Mantém-se: custo zero, nada enviado sem a Andreia, pendências no Sheet, esclarecimentos para a Sara e trabalho operacional para a Andreia.
- Perde-se a cifra local; aceite porque o levantamento já vive no Google da Janela.
- Se no fim do M1 faltar algo que só uma aplicação local resolva, reavalia-se.

## Comparação descrição e características (22 outubro 2026, verificação pedida pela Andreia)

**Ainda não implementada no Apps Script.** Confirmado em Codigo.gs e marcador.js: o marcador transmite apenas a contagem de Features/Childs; o analisador considera Características preenchido quando a contagem é positiva. Não há nomes dos itens, comparação com o texto, sinónimos ou negações. O algoritmo limitado da antiga app desktop não foi portado e não deve ser apresentado como função da app Sheets.

Requisito pedido: comparar descrição e características assinaladas nos dois sentidos, apresentar diferenças e sugestões para revisão. Distinguir Coerente, Há diferenças a rever e Não foi possível verificar. Para implementar, preservar os nomes/identificadores dos itens na leitura, mostrar o excerto de suporte e tratar sinónimos, negações e hipóteses (sem garagem, possibilidade de piscina). Contagem positiva não demonstra completude nem coerência. Usar inicialmente PT se não houver regras validadas para os restantes idiomas; não declarar os cinco verificados por extrapolação. Não alterar o eGO automaticamente. Esta passagem foi de verificação e registo do requisito; a função continua pendente.

## Ponto atual para continuar (22 outubro 2026, Codex)

Andreia autorizou consolidar a Clara Apps Script e pediu os menus **Progresso** e **Resumo semanal**. Pediu explicitamente que todas as alterações e pendências de execução fiquem no repositório para continuar no Claude.

Implementado e testado com dados sintéticos:
- Grava títulos e descrições dos idiomas efetivamente lidos em **Textos por idioma**. Um idioma inacessível preserva o texto anterior.
- **Registo de alterações** recebe antes/depois de cada mudança no levantamento, textos e pendências. Usa as colunas existentes; não altera a estrutura nem escreve na fórmula Conferência.
- Leitura parcial, idioma não lido, formato desconhecido ou documentos por rever mantém **Em curso**, não Verificado. Ter faltas confirmadas não impede concluir um levantamento completo.
- Uma falha que reaparece reabre a pendência Concluído com o mesmo ID; Não aplicável continua a ser decisão humana. A resolução anterior é preservada no histórico.
- Bloqueio de gravações simultâneas da Clara, verificação prévia das células, vagas escolhidas individualmente, proteção de fórmulas e recuperação se a gravação falhar. O bloqueio não impede edições manuais feitas ao mesmo tempo.
- Resumo semanal separa leitura parcial de anúncio verificado e só conta correções Concluído + Confirmado.
- Menus/painéis renomeados para Progresso e Resumo semanal.
- Verificado na folha real: Estado da verificação é uma fórmula e Categorias por verificar conta vazios e Por verificar. O código preserva essa fórmula; blocos não lidos recebem Por verificar. Textos anteriores dos idiomas inacessíveis mantêm-se intactos. O teste sintético inclui esta variante com estado calculado.

Validação local: `node scripts/testar-clara-apps.mjs` passou (leitura parcial, idioma inacessível, docs incompletos, reabertura, linhas intercaladas sem sobrescrita, textos, histórico antes/depois, repetição, texto literal, recuperação, bloqueio e fórmulas). `Clara-completo.gs` regenerado pelo gerador oficial. Adicionada CI específica de Apps Script com dados fictícios; isto não equivale a teste de gravação real no Sheets.

**Estado do Google:** código completo colado e guardado no projeto aberto pela Andreia, com leitura de volta para confirmar o conteúdo. A cópia anterior foi preservada apenas localmente, sem enviar IDs/dados reais ao repositório. A associação ao Sheet ficou confirmada: depois de recarregar a folha, o menu mostra Progresso e Resumo semanal e abre o painel com o título Clara · progresso. Executar onOpen diretamente do editor deu erro de contexto; recarregar a folha atualiza o menu corretamente. O conteúdo do painel continua a devolver PERMISSION_DENIED no navegador do assistente, pelo que a gravação real não foi testada. A ligação Drive do assistente continua sem acesso à conta da Janela.

**Próximo passo:** resolver o acesso PERMISSION_DENIED ao conteúdo dos painéis neste navegador; verificar Analisar imóvel e Resumo semanal; testar uma gravação real revista pela Andreia e confirmar textos/histórico, sem duplicar pendências. Só declarar conclusão em produção depois desse teste. Não voltar ao desenvolvimento desktop nem criar novo instalador.

## Histórico das sessões anteriores (21 e 22 outubro 2026)

- **Versão instalada no PC da Andreia: 0.7.4.** Inclui tudo o que existia na 0.7.3 (comparação feita função a função) mais a regra dos destinos alimentados pelo EGO.
- **Google Sheet do levantamento** já existe (conta janela.pt), com 11 separadores: Dashboard, Levantamento (títulos na linha 9, 35 colunas), Origem EGO, Pendências da equipa, Textos por idioma, Registo de alterações, Histórico de indicadores, Leads por período, Perfis dos portais, Histórico dos perfis, Rightmove: anúncios.
  - Verificado: fuso horário errado (America/Los_Angeles), nenhuma lista de validação, nenhuma proteção, nenhum acionador.
  - A Andreia **autorizou** aplicar: fuso Europe/Lisbon, listas de escolha nas colunas de categoria e proteção das colunas calculadas. As opções das listas são mostradas à Andreia antes de aplicar.
- **Em curso:** função `listarCategorias()` em `apps-script/estrutura.gs` para ver que opções já se usam nas colunas de categoria (só valores de categoria, nunca referências nem textos), para desenhar as listas sem invalidar o que já existe.
- **Exportação do EGO** tem só estas colunas: Referência, Natureza, Disponibilidade, Venda (€), Trespasse (€), Arrendamento (€), Permuta (€), Concelho, Data de criação, Data de alteração, Descrição.
  - Consequência: **não traz fotografias, plantas, documentos nem características.**
- **Descoberta (ver `docs/FONTES-DE-DADOS.md`):** a página pública de cada imóvel no site da Janela tem quase tudo: títulos e descrições nos 5 idiomas, fotografias (com legendas e texto alternativo), 360, visita virtual, vídeo, plantas com o formato, folhetos, características, áreas, classe energética e data da última alteração. O EGO só é indispensável para os 4 documentos (caderneta, certificado energético, contrato de mediação, licença de habitação).
  - **Decisão para o M1:** botão "Ler esta página" no site público (marcador no navegador, sem login), em vez de "Ler esta ficha" no EGO. Documentos: lista curta na Clara.

- Nível de preenchimento da eGO (percentagem na lista de imóveis) só aponta campos vazios; não deteta idioma trocado, planta em PDF, texto alternativo nem documentos. A lista de imóveis do EGO mostra também oportunidades, site/portais e visitas por imóvel (possível fonte de contactos para o M4). A Andreia não tem permissão para abrir as oportunidades, mas vê a contagem; vai pedir esclarecimento sobre o que conta como oportunidade.

- **Pendências registadas no Sheet para a Sara (21/10):** P0016 (o que conta como oportunidade no eGO) e P0017 a P0021 com as faltas do imóvel piloto (descrição FR, planta em PDF, texto alternativo, documentos, vídeo). Regra nova da Andreia: tudo o que é partilhado com a Janela e todas as pendências ficam no Sheet.

- **Listas de escolha propostas à Andreia (21/10, à espera de aprovação):** valores em uso lidos com `opcoesLevantamento()` e `vocabularioPendencias()`. Proposta: campos de verificação do Levantamento = Por verificar, Preenchido, Em falta, Formato errado, Não aplicável, Não foi possível verificar; Estado da verificação = Por iniciar, Em curso, Verificado; Prioridade = Prioritária, Alta, Normal; Pendências: Estado = Por tratar, A aguardar esclarecimento, Em curso, Concluído, Não aplicável; Verificação final = Por verificar, Confirmado, Não confirmado; Onde corrigir = eGO, eGO e portais, eGO, site, portais e folhetos, Portais, Site; Registo: Resultado da verificação inclui "Confirmado" (o resumo semanal depende deste valor). Modo proposto: aviso, sem bloquear. Colunas calculadas ficam protegidas.
- **M0 no Sheet concluído (21/10 23:48):** fuso Europe/Lisbon; 28 listas de escolha (aviso, sem bloquear) em Levantamento, Pendências e Registo (`apps-script/regras-m0.gs`). Proteções automáticas impossíveis: os separadores são tabelas do Google Sheets. Pendências: P0017 a P0019 atribuídas à Andreia (operacionais); P0016, P0020 e P0021 são perguntas à Sara.

- **Resultado do teste (22/10 00:10):** a Andreia publicou a aplicação Web (acesso restrito, pede login: confirmado). Envio a partir da página pública FALHOU de três formas: fetch (cookies de terceiros bloqueados), fetch após autorização, e envio por navegação direta ("Page not found": o navegador tem várias contas Google e o serviço abre com a conta pessoal, sem acesso). Conclusão: **plano B adotado** (marcador copia o resumo; colar no painel da Clara no Sheet). Alternativa futura: perfil do Chrome só com a conta janela.pt. A implementação de teste pode ser arquivada pela Andreia (Implementar > Gerir implementações); só aceita referências TESTE-.
- **Teste de 22/10 00:05:** a publicação da aplicação Web não foi feita pelo assistente (bloqueada por regra de segurança do próprio assistente: publicar um serviço que recebe dados é uma decisão da Andreia). Código de teste `doPost`/`doGet` está no projeto Apps Script, NÃO publicado. Opções: (A) a Andreia publica ela própria (Implementar > Nova implementação > App para a Web > Executar como: eu > Acesso: utilizadores da Janela); (B) recomendado: sem serviço; o marcador copia o resumo e a Andreia cola no painel da Clara no Sheet (Ctrl+V), que não precisa de publicação.
- **(Anterior) Teste previsto:** confirmar que o Google da Janela permite publicar um serviço Apps Script ("aplicação Web") com acesso "qualquer pessoa em janela.pt" e que o marcador, aberto na página pública, consegue enviar dados de teste (TESTE-001) para um separador de teste. A Andreia só aprova o ecrã de autorização da Google. Se falhar: plano B (copiar e colar no painel).

- **22/10 00:20:** datas das pendências P0016 a P0021 corrigidas para só dia (regra nova: datas sem horas). Código da Clara no Sheet escrito em `apps-script/clara/` (Codigo.gs, Painel.html, marcador.js; `python3 scripts/construir-clara.py` gera `apps-script/clara/Clara-completo.gs` (é este que se cola no projeto Apps Script do Sheet)). Marcador testado na página pública do imóvel piloto: lê referência, 38 fotografias (0 com texto alternativo, 7 com legenda), planta em PDF, 0 vídeos, visita virtual, 19 fotos 360, 3 folhetos, 81 características, classe A e textos nos 5 idiomas. **Resolvido (00:26):** o projeto "Projeto sem nome" (o mesmo usado antes) afinal é o projeto ligado ao Sheet. O código antigo foi substituído por `Clara-completo.gs`; o menu **Clara** já aparece no Sheet. Teste da análise (sem gravar) no imóvel piloto: 18 campos propostos certos e as 5 pendências reconhecidas como já existentes (P0017 a P0021), sem duplicar. As funções antigas de diagnóstico estão em `apps-script/estrutura.gs`, `regras-m0.gs` e `pendencias.gs`. O `doPost` de teste deixou de existir; a implementação Web pode ser arquivada.

- **M1 CONCLUÍDO (22/10 00:31):** teste de ponta a ponta feito pela Andreia no imóvel piloto: marcador, colar, documentos, analisar, gravar. **2 minutos** (antes 20; meta era 5 ou menos). Gravou 17 campos; nenhuma pendência duplicada.

- **Revisão do Sheet (22/10 00:40), a pedido da Andreia, à espera de aprovação antes de mudar:** redundâncias encontradas: Perfis dos portais e Histórico dos perfis com as mesmas 11 colunas; lista de pendências repetida (e desatualizada) no Dashboard; Textos por idioma com 1100 linhas quase vazias e a descrição PT duplicada da Origem EGO; Rightmove com colunas em duplicado (lista e desempenho) e "Referência eGO" vazia apesar de "Referência do agente" preenchida; Histórico de indicadores com 3 colunas sempre vazias. Desatualizado: "Visita virtual (não avaliada)", notas que falam do Excel, "Responsável pelo acompanhamento" sempre "Por atribuir", 15 pendências antigas sem responsável segundo a regra. Código da Clara no Apps Script atualizado para a versão com confirmação de correções (commit b2a117c).
- **Confirmação automática FUNCIONA (22/10 01:04):** ao reler o imóvel piloto depois de o site atualizar, a P0017 (descrição FR) passou sozinha a Concluído + Confirmado, com resposta e data de resolução; Conferência sem avisos. Prioridade 1 concluída. Prioridade 2 feita (22/10 01:10): menu "Clara > Próximos imóveis" (`Lista.html` + `listaTrabalho()`): progresso, prioritários por verificar, pendências da Andreia por imóvel, perguntas à espera da Sara, e depois os de prioridade Alta. Prioridade 3 feita (22/10 01:15): "Clara > Resumo semanal para a Sara" (`Resumo.html`, `resumoSemanal()`, `criarRascunho()`): período 7/14/30 dias, pré-visualização, Andreia escondeu os separadores de uso pontual (01:20): visíveis só Dashboard, Pendências e Levantamento. Perfis dos portais: tarefas da Andreia de 22/10 (green-acres: nome alterado, logótipo por centrar, descrição, idiomas; rightmove: descrição, idiomas; idealista: logótipo, descrição) a registar no separador Perfis dos portais; a lista "Próximos imóveis" passa a mostrar as tarefas abertas dos perfis. ALTERADO a pedido da Andreia (01:12): o email da Janela é o webmail (janela.pt/webmail), não o Gmail. A Clara prepara o assunto e o email (com tabela) no painel; botões Copiar assunto / Copiar email; a Andreia cola no webmail e envia. Sem Gmail nem permissões de email.
- **Teste de confirmação (22/10 01:03):** a Andreia corrigiu a descrição FR no eGO, mas a leitura das 01:00 ainda trazia o texto antigo (cache do navegador nas páginas por idioma). Às 01:04 o site já mostra o FR certo. Corrigido: o marcador lê sem cache (`cache: 'no-store'`); a Andreia tem de reinstalar o marcador (Clara > Instalar o marcador).
- **Arrumação executada pela Andreia (22/10 00:50):** tudo OK exceto listas em Registo, Histórico de indicadores e Perfis (colunas com tipo próprio na tabela travaram o separador inteiro). 10 pendências antigas passaram para a Andreia, 8 ficaram com a Sara. Segunda passagem `listasEmFalta()` corrida (22/10 00:53, com aprovação da Andreia): Perfis dos portais com listas; Registo de alterações e Histórico de indicadores são tabelas com colunas de tipo próprio que recusam listas por script (os menus dessas colunas editam-se à mão na tabela; atenção ao valor antigo "Levantamento Excel", agora "Levantamento"). Nota técnica: no Sheets os erros de escrita só aparecem no flush seguinte; usar `SpreadsheetApp.flush()` dentro do try.
- **(Antes) Arrumação aprovada pela Andreia (22/10 00:43):** código em `apps-script/arrumacao-2026-10-22.gs` (já colado no projeto do Sheet, junto com a Clara atualizada: visita virtual descontinuada e página pública). O assistente foi bloqueado pela sua regra de segurança ao correr alterações em massa num ficheiro partilhado; a Andreia corre `aplicarArrumacao` no editor (Executar). Correção à revisão: a "Referência do agente" do Rightmove não é a referência eGO (formato 99999_99999999), por isso não se junta; colunas do Rightmove ficam como estão. Prioritários = etiqueta "melhora" (22).
- **Prioridades aprovadas pela Andreia (22/10 00:36):** documentos do EGO continuam manuais (rápido, não compensa automatizar). Ordem: 1) a Clara confirma correções sozinha ao reler um imóvel (FEITO no código, a testar); 2) "Clara > Próximos imóveis" (lista de trabalho: prioritários por verificar e pendências da Andreia); 3) resumo semanal para a Sara em rascunho no Gmail (M3).

**(Anterior) Próximo passo (M2):** 1) ler os 4 documentos na ficha do EGO com o mesmo marcador (ver a estrutura da página com a Andreia); 2) aplicar a todos os imóveis do levantamento e ver o resumo de progresso; 3) Apps Script diário a reler os textos dos imóveis já lidos (guardar a ligação pública de cada imóvel); 4) resumo "Hoje".

**(Feito) Teste:** a Andreia testa de ponta a ponta no imóvel piloto: Clara > Instalar o marcador; abrir a página pública; carregar no marcador; Clara > Analisar imóvel; colar; marcar os 4 documentos; confirmar. Medir o tempo (meta: 5 minutos ou menos). Depois: ler os documentos na ficha do EGO com o mesmo marcador (precisa de ver a estrutura da página do EGO com a Andreia).

**(Anterior) M1 no Sheet (plano B):** script ligado ao Sheet com menu "Clara" e painel lateral com caixa para colar; marcador "Clara" que lê a página pública ou a ficha do EGO e copia o resumo; análise e escrita no Levantamento e Pendências; testar com o imóvel piloto. M0 concluído do lado da Andreia; falta só a resposta da Sara à P0016 e a medição de rede do WebView2.

## Para que serve a Clara

A Clara prepara o levantamento e encontra o que falta. A Andreia só revê dúvidas e confirma.

| Peça | Papel |
|---|---|
| EGO (CRM) | Fonte oficial dos imóveis |
| Exportação do EGO | Lista de imóveis, preços, datas e descrição principal |
| Página pública do imóvel ("Ler esta página") | Textos nos 5 idiomas, fotografias, legendas, 360, visita virtual, vídeo, plantas e formato, folhetos, características |
| Ficha do EGO | Só os 4 documentos (caderneta, certificado energético, contrato de mediação, licença de habitação) |
| Apps Script | Releitura diária dos textos por idioma no site (JSON-LD), depois de a ligação estar guardada |
| Google Sheet | Registo partilhado com a equipa: resultado, pendências, evolução |
| Clara (Apps Script, dentro do Sheet) | Analisa a leitura do marcador, propõe estados e pendências, regista alterações após confirmação |
| Prints do EGO | Último recurso: o OCR só lê texto, não deteta galerias, anexos nem caixas assinaladas |

## Regras de negócio

**Textos por idioma (PT, EN, FR, DE, ES)**
- Se a página de um idioma no site mostra o texto noutro idioma, a descrição desse idioma está **vazia no EGO**. Ação: "Preencher descrição <idioma> no EGO". O mesmo para títulos.

**Plantas**
| Situação | Estado | Ação |
|---|---|---|
| Planta em JPG | Correto | Nenhuma |
| Só em PDF | Formato errado | Converter para imagem (JPG) e carregar no EGO. **Plantas em PDF não são exportadas para os portais.** |
| Nenhuma | Em falta | Carregar planta em JPG no EGO |

**Quem faz o quê (regra da Andreia, 21/10):** questões para esclarecimento vão para a Sara (Pendências, "Aguarda análise de: Sara"); tudo o que é operacional a Andreia faz sozinha (Responsável "Andreia", sem esperar pela Sara).

**Destinos alimentados pelo EGO (`feed_only`)**: RightMove só se corrige no EGO (0.7.4).

## Objetivos

| # | Objetivo | Medida |
|---|---|---|
| O1 | Menos trabalho manual | Revisão de um imóvel em 5 minutos ou menos (tempo de partida medido no M0) |
| O2 | Faltas detetadas com a ação certa | "presente", "em falta", "formato errado", "não foi possível verificar", cada um com ação; coincide com a verificação manual no imóvel piloto |
| O3 | Textos verificados nos cinco idiomas | Idioma trocado assinalado como "vazio no EGO" |
| O4 | Pedidos à equipa sem trabalho extra | Resumo para copiar para o webmail, nunca envio automático; seguimento no Sheet |
| O5 | Indicadores fáceis de consultar | Painel com período à escolha; contactos e qualidade por plataforma (idealista, Green Acres, RightMove, EGO), no total e por imóvel |
| O6 | Segurança | Acesso pelo Google da Janela, histórico no Sheet; nenhum dado real no repositório |

## Milestones

**M0 · Base estável (até 24 out)**
- [x] Clara 0.7.4 instalada
- [x] Colunas da exportação do EGO conhecidas
- [x] Autorização para regras no Sheet
- [x] Regra de passagem de testemunho (AGENTS.md e CLAUDE.md): atualizar este documento e fazer push a cada passo, em Claude e Codex
- [x] Listas de escolha e fuso Lisboa (proteções impossíveis em tabelas)
- [x] Tempo atual por imóvel: cerca de 20 minutos (meta do M1: 5 minutos ou menos, menos 75%)
- [x] Origem dos contactos: cada plataforma tem os seus números. Por confirmar (pendência P0016, Sara) se as oportunidades do eGO juntam os pedidos de contacto do idealista, Green Acres e RightMove ou se os portais os medem à parte.
- [ ] Medição dos pedidos de rede do WebView2 (AC23) e confirmação do NDA

**M1 · Um imóvel automático (até 31 out) · CONCLUÍDO a 22/10: 2 minutos por imóvel**: imóvel piloto escolhido pela Andreia (referência só no Sheet).
- Apps Script lê o site público nos cinco idiomas e preenche "Textos por idioma" com data e origem; aplica a regra do idioma trocado.
- Botão "Ler esta página" (marcador) na página pública do imóvel: lê os dados já carregados pela página e as 4 versões noutros idiomas; copia um resumo; a Clara cola e propõe estados e ações (idioma trocado, planta em PDF, fotografias sem texto alternativo, sem vídeo, etc.).
- Lista curta na Clara para os 4 documentos do EGO.
- Ecrã do imóvel só com dúvidas e ações.
- Concluído quando a proposta coincide com a verificação manual e demora 5 minutos ou menos.

**M2 · Todos os imóveis (até 14 nov)**
- (Ponte por ficheiros cancelada: a Clara vive no Sheet.)
- Resumo "Hoje" no Sheet, atualizado automaticamente às 18:20.
- Exportação do EGO detetada numa pasta do Drive.
- Leitura diária do site para todos os imóveis.
- Plantas PDF para imagem: indicar ferramenta gratuita ou solução no Drive (a aplicação local está em pausa).
- O XLSM antigo passa a arquivo.

**M3 · Pedidos e seguimento (até 28 nov)**
- Pedidos consolidados à equipa com a ação concreta; rascunhos no Gmail (Apps Script); lembretes de pendências antigas; (atualização da aplicação por pasta do Drive deixa de ser necessária).

**M4 · Painel de indicadores (dezembro)**
- Looker Studio (gratuito) sobre o Sheet: seletor de período com comparação ao anterior; filtro por plataforma e por imóvel; evolução de contactos no total e por imóvel; comparação idealista, Green Acres, RightMove, EGO; qualidade (completos vs. com faltas, pendências e idade).
- Dados nos separadores "Leads por período" e "Histórico de indicadores", em formato fixo.

## Fora do âmbito (de propósito)

Internet ou APIs na Clara; editar diretamente nos portais; envios automáticos; mais desenvolvimento na leitura de prints.


## Organização dos perfis e datas — 22/10/2026

- Aplicado e conferido no Google Sheets: «Perfis dos portais» tem uma linha por portal; as ações estão em «Pendências da equipa». O resumo conta as tarefas abertas por fórmula, excluindo Concluído e Não aplicável.
- Registos anteriores e situação prévia das pendências preservados em duas cópias de segurança ocultas. Não repetir scripts/organizar-perfis.gs: contém guarda contra repetição. A revisão automática exigiu confirmação específica; Andreia confirmou a reorganização antes da execução.
- Notas simplificadas na folha, sem repetir responsáveis e estados. Conferência das novas tarefas reconhece os portais e mantém os controlos de IDs repetidos, conclusão e justificação N/A. Os textos reais e os backups não foram enviados ao repositório público.
- Scores: «Não recolhido» enquanto não houver score oficial; não foi criado um score próprio. Indicadores históricos continuam separados dos perfis. O perfil ainda não levantado está explicitamente marcado como tal; zero tarefas não significa perfil concluído.
- Datas concluídas: yyyy-mm-dd nas colunas identificadas de registo, verificação, recolha, criação, alteração e resolução, incluindo Última atualização. Fórmulas e valores preservados. Datas textuais antigas convertidas em datas reais. Parser do resumo semanal aceita ISO e o formato anterior.
- As tabelas Google bloquearam setNumberFormat nas colunas tipadas. Andreia autorizou explicitamente a troca do tipo interno das colunas afetadas por formato personalizado com validação de datas. Alteração feita pela interface; scripts/datas-interface.gs finalizou o formato e a validação DATE_IS_VALID com rejeição de entradas inválidas. Todas as colunas do plano devolveram ok:true. Visibilidade original das folhas restaurada; cópias de segurança permanecem ocultas.
- Código de Progresso lê as tarefas dos portais da lista única, sem as duplicar nas tarefas de imóveis. Mantém compatibilidade com o formato antigo apenas se a migração não tiver sido feita.
- Código final aplicado no Apps Script e confirmado por leitura integral, igual a Clara-completo.gs. Funções temporárias de manutenção foram removidas do projeto ativo; scripts de manutenção permanecem no repositório como referência, fora do bundle habitual.
- Testes locais: regressões de gravação, histórico, bloqueio, proteção de fórmulas, parser de datas e agrupamento sintético das tarefas de perfis. Conferência real: resumo sem erros, contagens numéricas e datas ISO nas pendências. A sidebar continua com a limitação de acesso anteriormente registada; não foi demonstrada uma nova gravação real de imóvel por essa interface.
- O requisito anterior de comparação entre descrição e características continua por implementar.


## Botão Clara no Idealista — 22/10/2026

- Pedido aprovado: sessão iniciada no browser, clicar no marcador Clara, copiar automaticamente os dados da página e colar no Google Sheets. Sem OCR, sem enviar credenciais ao Apps Script e sem recorrer a endpoints privados.
- Implementado: coletor DOM em idealista.js, integrado no marcador existente. Reconhece lista de imóveis, gráfico geral, ranking da carteira e comparativo da zona. Recolhe somente a página aberta; listas e rankings são explicitamente parciais. Não navega automaticamente entre páginas. Copia CLARA2:JSON para a área de transferência, com alternativa de cópia manual se o browser bloquear a clipboard.
- Campos: qualidade em percentagem lida do texto SVG, referência/código, publicação, rendimento e avisos na lista; indicadores numéricos no ranking e resumo; período e filtros selecionados. Top 50 é comparativo da zona, não uma lista exclusiva da agência; quando a página só indica período relativo, preserva essa etiqueta e deixa as datas exatas desconhecidas.
- Importador: pré-visualização, validação de origem/período/escala, preservação do histórico e bloqueio da repetição da mesma recolha no mesmo dia. Desconhecido não vira zero. Texto é gravado como literal, não fórmula. Cria Idealista - recolhas apenas na primeira gravação confirmada. É uma fonte de indicadores, não substitui Levantamento, Perfis dos portais ou Pendências da equipa. Ainda não agrega automaticamente estes novos dados no Dashboard.
- Menu atualizado: Recolher informação; adicionada alternativa nativa Colar leitura Idealista para não depender da comunicação do painel lateral, que apresentou PERMISSION_DENIED no browser de teste. Instalar o marcador fornece a nova versão; marcadores já instalados precisam de atualização manual uma única vez.
- Testes locais de regressão e específicos: preservação de histórico, deduplicação, desconhecido/zero, texto literal, origem, escala, datas e falha de escrita; coletor com fixtures fictícias. Teste DOM real confirmou leitura da lista e do comparativo, incluindo scores SVG e filtros, sem guardar dados reais no repositório.
- Não confundir qualidade do anúncio Idealista com completude eGO nem com score do perfil da agência. Contactos não são impactos; não somar períodos sobrepostos ou repetir os totais gerais com as linhas individuais.
- Validação real concluída pelo menu nativo: colagem, pré-visualização, confirmação e gravação de uma página real da lista, explicitamente parcial. Confirmada criação da fonte Idealista - recolhas e mensagem de sucesso. O painel lateral recebeu a leitura mas a chamada de análise devolveu PERMISSION_DENIED; usar Colar leitura Idealista neste contexto. A limitação da sidebar não foi resolvida nem mascarada.
- Os resultados reais, referências, URLs privadas, capturas e exportações permanecem locais/no Sheet. O repositório contém apenas código e testes fictícios. Esta implementação não faz recolha agendada em segundo plano: exige a sessão e a página abertas no browser.
- Teste real de repetição confirmou a mensagem «Esta recolha já está guardada. Não foi duplicada.». Leitura posterior da folha confirmou as linhas guardadas e todos os scores numéricos do lote. Texto acentuado foi conferido diretamente na célula (a clipboard da ferramenta altera alguns caracteres na leitura TSV).

### Controlo de páginas Idealista
- Menu Clara > Conferir páginas Idealista: resume a data mais recente com páginas guardadas/em falta, imóveis únicos e páginas repetidas.
- Deteta sobreposição entre páginas, conteúdo diferente numa repetição, filtros/ordenação diferentes e mudança no total de ativos. Não apaga histórico nem altera o levantamento eGO.
- O marcador passa a recolher paginação, tamanho de página e total de ativos visível; a metadata fica na coluna Observação com prefixo PAGINACAO, sem mudar os cabeçalhos existentes.
- Recolhas antigas são utilizáveis para contar páginas e imóveis, mas não confirmam a última página esperada por não terem guardado o total. Não se inventa esse total retroativamente.
- A mensagem Recolha completa confirmada exige total e tamanhos coerentes, todas as páginas, IDs únicos iguais ao total, mesmos filtros e ordenação, sem sobreposições ou alterações detetadas. É uma conferência das capturas, não uma garantia de que o portal ficou imutável.
- Atualizar o marcador uma vez em Clara > Instalar o marcador. Testes fictícios cobrem falhas de cobertura e repetições.

### Revisão das estatísticas gerais Idealista
- Corrige falha de extração do total de impactos causada por espaços duplicados/não separáveis. Inclui totais de visitas e ações, além dos respetivos detalhes.
- Pré-visualização nativa e painel mostram nomes e valores dos 15 campos esperados; ausentes aparecem como Não recolhido e zero permanece zero.
- Distingue totais do período, anúncios ativos no momento da leitura e dados por imóvel/dia, que esta captura geral não contém. Não extrai séries dos gráficos.
- Necessário atualizar o marcador para usar o coletor corrigido. Código validado com dados fictícios; comparação visual dos totais feita na página real, sem publicar valores privados no repositório.

### Correção da conferência de gravação (Recolher informação)
- Falha reproduzida com o código anterior e simulação de conversão automática de texto numérico pelo Sheets e normalização de CRLF.
- Escreve strings não vazias como texto literal rico, preservando valores numéricos/data em campos de histórico, zeros iniciais e conteúdo que começa por =. Números e datas reais continuam tipados.
- Comparação só normaliza quebras de linha CRLF/CR para LF; não relaxa tipos nem diferenças no conteúdo.
- Falhas de leitura indicam folha e célula sem revelar o conteúdo. A recuperação passa também a conferir os valores repostos antes de afirmar que as células foram repostas.
- Testes sintéticos passam; não considerar a gravação do imóvel real confirmada sem repetir a recolha e obter sucesso na interface.


### Nomes do menu Clara
- Registar eGO (antes Recolher informação).
- Registar Estatísticas Idealista (antes Colar leitura Idealista); mantém também a importação da lista de imóveis.
- Ver páginas recolhidas no Idealista (antes Conferir páginas Idealista): páginas guardadas/em falta, repetições e imóveis únicos.
- Instruções e mensagens do marcador atualizadas para os mesmos nomes. Funções e dados preservados.


Nomes pedidos pela Andreia: eGO: estado; Idealista: Registar estatísticas; Idealista: ranking dos anúncios. Este último mantém a função de conferência de páginas existente; a renomeação não cria um ranking novo.

Nome final pedido: Idealista: estatísticas.

### Dashboard Idealista
- Bloco reservado Dashboard!A96:E121 (ou primeira linha livre posterior, detetada com proteção do conteúdo existente), abaixo do conteúdo existente; não altera a seleção de datas nem os indicadores anteriores.
- Mostra até quatro combinações período/filtros mais recentemente recolhidas, usando a última leitura de cada combinação; nunca soma janelas sobrepostas.
- Inclui os 15 indicadores, período, filtros, data da recolha e notas de âmbito. Ausente não se converte em zero.
- Atualiza após novas recolhas gerais. Se o bloco falhar, a recolha permanece guardada e o aviso indica que o dashboard não atualizou.
- Função interna atualizarDashboardIdealista permite gerar a vista inicial sem criar novas entradas de menu.

A área A67 contém o bloco de pendências existente, preservado. As suas fórmulas já apresentavam erros antes da nova vista; não corrigidas nesta alteração. Atalho para estatísticas em A6 quando livre.


### Correção confirmada da falha G31 e fórmulas do Dashboard
- Teste real em folha técnica oculta com dados fictícios confirmou: setRichTextValue de "14" num formato numérico devolve number; com formato @ devolve string. A correção anterior só com RichText não bastava.
- Gravação agora define @ antes de escrever strings; guarda e repõe o formato anterior em caso de recuperação. Números e datas reais mantêm os tipos. Reconferência anterior à escrita protege também alterações de formato concorrentes.
- Seis fórmulas Dashboard!B69:B74 reparadas de separadores vírgula para ponto e vírgula, respeitando locale pt_PT e texto entre aspas. Cópia anterior em folha oculta Clara - fórmulas antes 20261023.
- Auditoria posterior de erros nas fórmulas de todas as folhas visíveis: zero erros detetados. Backups ocultos excluídos da auditoria operacional.
- Scripts de manutenção ficam em scripts/corrigir-formulas-dashboard.gs; não adicionar menus. Folha técnica oculta Clara - teste de gravação contém apenas dados fictícios.
- Gravação completa do imóvel real exige confirmação de sucesso após nova tentativa; o diagnóstico não a executou automaticamente.


### Gráfico diário de contactos Idealista
- Menu mantém Idealista: estatísticas, sem criar itens. Marcador passa a ler pontos e escala SVG visíveis de contactos/mensagens/chamadas, alternando os dois rádios e repondo a seleção original.
- Rejeita zoom parcial, escala não linear/desconhecida, pontos fracionários/ambíguos, dias em falta, desalinhados, somas diferentes dos totais ou total diário diferente de mensagens+chamadas. Não usa OCR nem inventa valores. Em falha, mantém os totais e mostra aviso sobre a série.
- Payload CLARA2 inclui diarios opcional. Validação independente no servidor; 3 linhas por dia no histórico Idealista - recolhas, tipo contactos_diarios. Datas não se somam entre capturas.
- Novo gráfico combinado no Dashboard, ancorado em A124: contactos em linha e mensagens/chamadas em barras. Fonte derivada oculta Clara - contactos Idealista. Só atualiza o gráfico com título da Clara; preserva os anteriores.
- Usa a última série completa validada com o seu período no título. Uma nova recolha do mesmo intervalo substitui a vista derivada; histórico anterior preservado. Períodos diferentes não são unidos nem somados.
- Necessário atualizar o marcador uma vez. Leitura real de 90 pontos por série comparada com os totais do portal; dados reais apenas em ficheiros locais privados e no Sheets autorizado, não no GitHub.
- Preferência de menus: plataforma: função, nomes curtos e claros. Perguntar antes de decidir em caso de ambiguidade; não renomear por iniciativa própria.

Validação real: série de 90 dias importada com somas conferidas e gráfico combinado criado na primeira aba. Nova recolha usa o mesmo gráfico, sem criar cópias. Datas curtas no eixo; intervalo completo no título. Teste assíncrono verifica reposição dos controlos em sucesso e falha.

### Correção eGO: colunas tipadas (substitui a tentativa com formato @)
- Causa confirmada nas cópias reais das tabelas: setNumberFormat é rejeitado pelas colunas tipadas, incluindo durante a recuperação. A tentativa anterior com @ deve considerar-se substituída.
- escreverLiteralClara_ usa escape nativo por apóstrofo para strings e mantém números/datas nos tipos originais. Não altera formatos na gravação nem na recuperação. Fórmulas, valores e formatos concorrentes continuam protegidos; erros mostram também a causa original.
- Quatro cópias ocultas das folhas afetadas preservadas antes do diagnóstico. Teste em novas cópias reais confirmou escrita e reposição de texto numérico, zeros iniciais, texto que começa com = ou apóstrofo, estado e número, sem mudar formatos. Originais preservados nesse teste.
- Testes sintéticos de gravação e rollback rejeitam qualquer chamada a setNumberFormat; regressões eGO e Idealista passaram. Código final relido no editor e igual ao bundle, sem função temporária.
- Falta confirmar a transação completa com a leitura original do imóvel: painel do utilizador estava fechado, foi pedido que o deixasse com a leitura colada. Não declarar a gravação real concluída apenas pelos testes em cópias.
