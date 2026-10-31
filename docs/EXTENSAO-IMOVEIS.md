# Leitura de fichas públicas na extensão Clara

Versão 0.2.0, piloto. A extensão existente passa a ter duas ações: «eGO: ler este imóvel» e «Rightmove: recolher os dois relatórios». A ação eGO lê a ficha pública do website da agência, não o CRM administrativo. Não edita nem publica dados.

## Percurso

1. Atualizar os ficheiros da extensão existente e clicar Atualizar no Chrome. Confirmar 0.2.0 e aceitar o acesso ao website público caso o Chrome o peça.
2. Abrir a página pública completa do imóvel e clicar «eGO: ler este imóvel».
3. Rever os campos confirmados e os que ficaram por verificar. Copiar caso a cópia automática não esteja disponível.
4. No documento principal, abrir «Clara > eGO: estado», colar, analisar, rever e confirmar a gravação.

Documentos continuam a ser confirmados manualmente. A extensão não altera estados do Sheets nem envia a leitura diretamente. Uma descrição lida pode estar vazia; isso é distinguido de idioma não lido. Os alt texts são contados, não avaliados quanto à qualidade.

## Fonte e limites

`ego-collector.js` é gerado por `scripts/construir-coletor-imovel.py` a partir da parte eGO do marcador existente. `construir-clara.py` executa também esse gerador. Mantém o protocolo CLARA1 compatível com o painel atual; não exige atualização do Apps Script nem reinstalação do marcador.

Espera por uma ficha identificável no DOM, até 12 segundos. Tentativas de rede têm prazo e fontes limitadas ao website público e à API pública já observada pela página. A extensão só recebe novos acessos de host às duas variantes do domínio público da agência, sem acesso ao admin.eGO nem permissões para cookies, downloads ou todos os sites. A sessão do browser não é copiada.

Uma galeria só confirma contagem e alt texts quando todos os IDs únicos correspondem ao total anunciado. Dados incompletos são desconhecidos, não zeros. Referência da API divergente da referência apresentada ou mudança de URL durante a leitura bloqueiam a cópia. Não recolhe visita virtual como requisito. Limite do worker de 90 segundos, resultado temporário na sessão, mesmas regras de expiração e cópia da extensão Rightmove.

## Validação

23 suites locais passaram. Novo teste usa o coletor real com DOM e Chrome simulados para galeria completa/incompleta, idiomas desconhecidos, ausência de vídeo confirmada, plantas, documentos manuais, origem, mudança de página, referência divergente e espera/timeout do DOM. Testes existentes de Rightmove e cópia continuam aprovados.

Validação instalada ainda pendente: testar primeiro um imóvel conhecido, comparar todos os campos apresentados e conferir a gravação no Sheets; repetir noutros imóveis antes de substituir o marcador neste percurso. Não declarar o piloto validado com base apenas em testes sintéticos.
