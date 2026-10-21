# Clara: estado e plano

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

## Último ponto de situação (21 out 2026)

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

- **22/10 00:20:** datas das pendências P0016 a P0021 corrigidas para só dia (regra nova: datas sem horas). Código da Clara no Sheet escrito em `apps-script/clara/` (Codigo.gs, Painel.html, marcador.js; `python3 scripts/construir-clara.py` gera `dist/Clara.gs` para colar). Marcador testado na página pública do imóvel piloto: lê referência, 38 fotografias (0 com texto alternativo, 7 com legenda), planta em PDF, 0 vídeos, visita virtual, 19 fotos 360, 3 folhetos, 81 características, classe A e textos nos 5 idiomas. **Bloqueio:** o assistente não consegue criar o projeto ligado ao Sheet no navegador (página "não encontrada" por causa das várias contas Google). A Andreia tem de abrir uma vez o Sheet > Extensões > Apps Script no navegador dela; depois o assistente cola o código.

**Próximo passo:** M1 no Sheet (plano B): script ligado ao Sheet com menu "Clara" e painel lateral com caixa para colar; marcador "Clara" que lê a página pública ou a ficha do EGO e copia o resumo; análise e escrita no Levantamento e Pendências; testar com o imóvel piloto. M0 concluído do lado da Andreia; falta só a resposta da Sara à P0016 e a medição de rede do WebView2.

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
| Clara (PC, sem internet) | Cruza as fontes, deteta faltas, mostra só o que precisa de decisão |
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
| O4 | Pedidos à equipa sem trabalho extra | Rascunhos no Gmail, nunca envio automático; seguimento no Sheet |
| O5 | Indicadores fáceis de consultar | Painel com período à escolha; contactos e qualidade por plataforma (idealista, Green Acres, RightMove, EGO), no total e por imóvel |
| O6 | Segurança | Clara sem internet, cifrada, backup diário; nenhum dado real fora da Janela |

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

**M1 · Um imóvel automático (até 31 out)**: imóvel piloto escolhido pela Andreia (referência só no Sheet).
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
