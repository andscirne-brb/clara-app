# Fontes de dados para o levantamento: site público versus EGO

Análise feita a 21 out 2026 num imóvel real (página pública do site da Janela e ficha do EGO), registada aqui sem dados do imóvel.

## Conclusão

**A página pública do imóvel dá quase tudo o que o levantamento precisa, sem login e sem prints.** O site da Janela é feito pela própria eGO e, quando a página abre, o navegador recebe os dados completos do imóvel em formato estruturado. O EGO (backoffice) só é indispensável para os **documentos** e para informação interna.

## Cruzamento campo a campo

| Campo do levantamento | Site público | EGO (backoffice) | Melhor fonte |
|---|---|---|---|
| Referência, natureza, concelho, preço | Sim | Sim | Exportação EGO (já automática) |
| Título PT, EN, FR, DE, ES | Sim, uma página por idioma | Sim, escondido em separadores | **Site** |
| Descrição PT, EN, FR, DE, ES | Sim. Quando falta um idioma, o site mostra o texto inglês | Sim, escondido em separadores | **Site** (permite aplicar a regra "idioma trocado = vazio no EGO") |
| Número de fotografias | Sim, contagem exata | Sim, contagem visual | **Site** |
| Legendas e texto alternativo das fotografias | Sim, por fotografia (campos separados) | Sim, uma a uma | **Site** |
| Fotografias 360 | Sim, contagem | Sim | **Site** |
| Visita virtual | Sim (existe ou não) | Sim | **Site** |
| Vídeo | Sim (existe ou não) | Sim | **Site** |
| Plantas e o **formato** (PDF ou JPG) | Sim | Sim | **Site** |
| Folhetos (brochuras) | Sim, contagem | Sim | **Site** |
| Características (divisões, equipamentos, segurança, conforto, extras, áreas, serviços, infraestruturas) | Sim, por grupo e com valores | Sim, em caixas assinaladas | **Site** |
| Áreas, quartos, casas de banho, ano | Sim | Sim | **Site** |
| Classe energética | Sim | Sim | **Site** |
| Etiquetas | Sim (contagem) | Sim | Site |
| Data da última alteração | Sim | Sim | **Site** (permite ler só o que mudou) |
| Ligações por idioma | Sim | Não diretamente | **Site** |
| **Caderneta predial** | Não | Sim (Documentos) | **EGO** |
| **Certificado energético (ficheiro e número)** | Só a classe | Sim | **EGO** |
| **Contrato de mediação** | Não | Sim | **EGO** |
| **Licença de habitação** | Não (campo público vazio) | Sim | **EGO** |
| Publicação por portal | Não | Sim | EGO / portais |
| Notas internas, proprietário, visitas | Não | Sim | EGO (não entra no levantamento) |
| Nível de preenchimento da eGO (percentagem na lista de imóveis, com "campos por preencher") | Não | Sim | EGO, só como referência |
| Contagens por imóvel na lista do EGO: oportunidades, site/portais, visitas | Não | Sim | EGO (candidato a indicador de contactos por imóvel no M4) |

## Exemplos de problemas detetados automaticamente no teste

- Descrição FR igual, letra a letra, à descrição EN: a descrição FR está vazia no EGO.
- Planta só em PDF: converter para JPG.
- Nenhuma das fotografias tem texto alternativo; só uma minoria tem legenda.
- Sem vídeo.
- Os quatro documentos obrigatórios aparecem sem ficheiro na ficha do EGO.

## Como ler o site sem dar internet à Clara

1. **Botão "Ler esta página" (marcador no navegador da Andreia).** Na página pública do imóvel, um clique lê os dados que a página já carregou e as quatro versões noutros idiomas (mesmo site). Copia um resumo para a área de transferência, que a Clara cola e analisa. Não precisa de login nem de programas instalados. É o caminho para o M1.
2. **Apps Script (diário, para todos os imóveis).** O HTML de cada página traz título e descrição por idioma em dados estruturados (JSON-LD) e as ligações para os outros idiomas. O Apps Script consegue ler isto sozinho. A contagem de fotografias, plantas e vídeos é carregada depois pela página, através de um serviço da eGO que exige a chave do próprio site: não se usa esse serviço fora do navegador.
3. **EGO só para os quatro documentos.** Na Clara, uma lista curta para marcar (caderneta, certificado energético, contrato de mediação, licença de habitação), ou mais tarde um botão igual na ficha do EGO.

Ligação entre referência EGO e página do site: o site usa um número próprio no endereço (não a referência). A primeira leitura com o botão guarda a ligação; a partir daí o Apps Script consegue reler sozinho.

## Nível de preenchimento da eGO não chega

Confirmado com a Andreia: a percentagem da eGO é o "nível de preenchimento" e lista os "campos por preencher". No imóvel de teste dava 94% e só apontava a falta de vídeo. Não detetou a descrição FR vazia, a planta em PDF, as fotografias sem texto alternativo nem os documentos sem ficheiro. A pontuação da Clara mede a qualidade para os portais, não só se o campo existe; a da eGO fica como referência no levantamento.
