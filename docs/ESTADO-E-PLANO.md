# Clara: estado e plano

Documento de passagem de testemunho. Mantido atualizado no fim de cada sessão. Sem dados reais (repositório público).

## Último ponto de situação (21 out 2026)

- **Versão instalada no PC da Andreia: 0.7.4.** Inclui tudo o que existia na 0.7.3 (comparação feita função a função) mais a regra dos destinos alimentados pelo EGO.
- **Google Sheet do levantamento** já existe (conta janela.pt), com 11 separadores: Dashboard, Levantamento (títulos na linha 9, 35 colunas), Origem EGO, Pendências da equipa, Textos por idioma, Registo de alterações, Histórico de indicadores, Leads por período, Perfis dos portais, Histórico dos perfis, Rightmove: anúncios.
  - Verificado: fuso horário errado (America/Los_Angeles), nenhuma lista de validação, nenhuma proteção, nenhum acionador.
  - A Andreia **autorizou** aplicar: fuso Europe/Lisbon, listas de escolha nas colunas de categoria e proteção das colunas calculadas. As opções das listas são mostradas à Andreia antes de aplicar.
- **Em curso:** função `listarCategorias()` em `apps-script/estrutura.gs` para ver que opções já se usam nas colunas de categoria (só valores de categoria, nunca referências nem textos), para desenhar as listas sem invalidar o que já existe.
- **Exportação do EGO** tem só estas colunas: Referência, Natureza, Disponibilidade, Venda (€), Trespasse (€), Arrendamento (€), Permuta (€), Concelho, Data de criação, Data de alteração, Descrição.
  - Consequência: **não traz fotografias, plantas, documentos nem características.** Pelo ponto de decisão do M1, essa informação vem de um botão no navegador ("Ler esta ficha") na ficha do EGO, que copia os campos para colar na Clara.

**Próximo passo:** terminar `listarCategorias`, propor as listas à Andreia, aplicar as regras ao Sheet (M0). Depois arrancar o M1.

## Para que serve a Clara

A Clara prepara o levantamento e encontra o que falta. A Andreia só revê dúvidas e confirma.

| Peça | Papel |
|---|---|
| EGO (CRM) | Fonte oficial dos imóveis |
| Exportação do EGO | Lista de imóveis, preços, datas e descrição principal |
| Ficha do EGO no navegador ("Ler esta ficha") | Fotografias, plantas (e formato), documentos, características |
| Site público da Janela | Títulos e descrições por idioma (lido pelo Apps Script) |
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
| Só em PDF | Formato errado | Converter para JPG e carregar no EGO |
| Nenhuma | Em falta | Carregar planta em JPG no EGO |

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
- [ ] Listas de escolha propostas e aplicadas; fuso Lisboa; proteções
- [ ] Tempo atual por imóvel medido (Andreia)
- [ ] Origem dos números de contactos por plataforma (Andreia)
- [ ] Medição dos pedidos de rede do WebView2 (AC23) e confirmação do NDA

**M1 · Um imóvel automático (até 31 out)**: imóvel piloto escolhido pela Andreia (referência só no Sheet).
- Apps Script lê o site público nos cinco idiomas e preenche "Textos por idioma" com data e origem; aplica a regra do idioma trocado.
- Botão "Ler esta ficha" para a ficha do EGO (bookmarklet ou extensão local): copia fotografias, plantas com formato, documentos e características para a área de transferência; a Clara cola e propõe estados e ações.
- Ecrã do imóvel só com dúvidas e ações.
- Concluído quando a proposta coincide com a verificação manual e demora 5 minutos ou menos.

**M2 · Todos os imóveis (até 14 nov)**
- Ponte com o Sheet: Apps Script exporta fotografia .xlsx para a pasta `Clara Ponte`; a Clara lê-a e escreve ficheiro de saída; o script acrescenta ao Registo de alterações sem duplicar (ID de operação).
- Leitura automática às 18:20; ecrã "Hoje" pronto às 18:30.
- Exportação do EGO detetada numa pasta do Drive.
- Leitura diária do site para todos os imóveis.
- Conversão local de plantas PDF para JPG (Windows.Data.Pdf, sem programas extra).
- O XLSM antigo passa a arquivo.

**M3 · Pedidos e seguimento (até 28 nov)**
- Pedidos consolidados à equipa com a ação concreta; rascunhos no Gmail (Apps Script); lembretes de pendências antigas; atualização da Clara por pasta do Drive.

**M4 · Painel de indicadores (dezembro)**
- Looker Studio (gratuito) sobre o Sheet: seletor de período com comparação ao anterior; filtro por plataforma e por imóvel; evolução de contactos no total e por imóvel; comparação idealista, Green Acres, RightMove, EGO; qualidade (completos vs. com faltas, pendências e idade).
- Dados nos separadores "Leads por período" e "Histórico de indicadores", em formato fixo.

## Fora do âmbito (de propósito)

Internet ou APIs na Clara; editar diretamente nos portais; envios automáticos; mais desenvolvimento na leitura de prints.
