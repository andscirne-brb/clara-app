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
