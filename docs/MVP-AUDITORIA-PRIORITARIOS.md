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
