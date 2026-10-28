# MVP Property Audit — primeiro incremento, 28/10/2026

## Entrega

Menu `Clara > Portais: auditoria`: consulta derivada dos imóveis marcados `Prioritária`, sem escrever no levantamento, pendências ou históricos. Seleção dinâmica, 15 critérios de presença/estado, ligações por portal e fonte da linha. Documentos reutilizam a interpretação de `EstadoDocumental.gs` para distinguir dossier, Digitalizado e falta em ambos. Não cria outra aba visível nem exige reinstalação do marcador.

Na cópia exportada do documento em 28/10 foram encontrados exatamente 22 registos com essa prioridade. A consulta não fixa o total em 22: alterações futuras à prioridade refletem-se ao atualizar.

## Limites explícitos

Não é uma pontuação de qualidade. Preenchido é o estado anterior registado, não validação atual. Ligação não prova publicação atual. Dados desconhecidos não equivalem a faltas. Referências duplicadas bloqueiam associações nesta vista. A consulta não cria tarefas nem altera dados comerciais. Os cartões contam imóveis com ações/campos desconhecidos, não somam um score.

## Próximo incremento da fase 1

1. Confirmar fontes originais para preço, áreas, tipologia e localização; ainda não disponíveis num contrato uniforme.
2. Comparação campo a campo com origem, data e regras de equivalência explícitas.
3. Separar observação, recomendação, correção e publicação confirmada no histórico/relatório existente, preservando eventos anteriores.
4. Critérios editoriais e recomendações explicadas, sujeitos a revisão humana.

## Validação

`node scripts/testar-auditoria-prioritarios.mjs`: modelo, cobertura, duplicados, ausência de escritas, estados e sintaxe da interface. Testes locais não comprovam execução nativa; registar a verificação no Google separadamente após instalação.


### Verificação nativa em 28/10/2026

Consulta no Google: 22 prioritários, 22 referências únicas, zero duplicados. Com ligação confirmada: Idealista 14, Green-Acres 20, Rightmove 10; não são contagens de publicação atual. Janela aberta pelo menu do Sheets, 22 imóveis apresentados; seleção do MI14372 confirmou planta e quatro documentos Digitalizado. Código instalado relido e igual ao bundle após normalizar quebras de linha. As três abas diárias permanecem; não foi criada uma aba de auditoria.

A abertura inclui os dados iniciais do servidor, evitando uma chamada adicional e o bloqueio de leitura do iframe no navegador integrado. A atualização pelo botão depende da ligação Google do navegador. Se falhar, o painel esconde o resultado antigo e apresenta erro; reabrir pelo menu recupera uma consulta nova. Sem alegação de edição ou publicação no eGO/portais.


## Segundo incremento — comparação nominal de preços

Reutiliza Origem EGO (cabeçalhos verificados, data extraída da fonte original), ligações confirmadas, lista Green-Acres e desempenho Rightmove (janela 30 dias). Lê em bloco uma vez; a troca de imóvel não faz nova chamada. Não altera estados, tarefas, dados eGO ou anúncios.

Base eGO datada de 16/10/2026: valores lado a lado, origem e datas, natureza/concelho originais, igualdade/diferença nominal. Diferença não é erro comercial confirmado; operação do portal e atualidade devem ser verificadas. Mais de uma operação com preço positivo, fonte sem data, referência duplicada, zeros, valor não numérico ou conflito na mesma data impedem a diferença. Não escolhe arbitrariamente uma janela 90 dias nem infere localização equivalente.

Idealista sem preço estruturado nas recolhas atuais. Áreas e tipologia continuam por avaliar, sem extrair números de descrições. Próximo passo: exportação eGO atualizada com estes campos e fonte comparável dos portais; manter desconhecidos até existirem dados verificáveis.


Validação nativa final: 22 prioritários, base eGO 2026-10-16, 30 preços recolhidos e 30 comparações nominais calculadas; zero diferenças nominais. Fonte eGO armazena números como texto: aceita apenas cadeias numéricas sem separadores ambíguos (ex.: 2300000), sem modificar a origem. Catorze suítes locais passaram. Janela inspecionada com APT13261: eGO e dois portais 2300000 EUR, datas distintas explícitas. Código instalado relido e igual ao bundle. Nenhuma célula de dados ou tarefa alterada por esta consulta.
