# Publicação esperada — decisão da Idília

A Idília gere a seleção dos imóveis prioritários e a distribuição pelos portais (confirmação da Andreia em 28/10/2026). A Clara não atribui essa decisão à Andreia nem infere destinos pela prioridade.

Em Clara > Portais: auditoria, cada imóvel prioritário apresenta Idealista, Green-Acres e Rightmove com Por confirmar, Publicar ou Não publicar. São destinos pretendidos, não comandos de publicação. Para registar é obrigatório indicar onde/quando a Idília confirmou a decisão. Sem essa informação, manter Por confirmar. A seleção da prioridade existente no Levantamento não é alterada.

Persistência: registos acrescentados na folha de suporte oculta Publicação esperada, criada atomicamente apenas na primeira decisão efetiva. Cada registo inclui os três destinos, data, atribuição funcional à equipa/Idília, ID e origem da confirmação. Não recolhe o email de quem abriu o painel nem pede uma permissão adicional. A origem é declarada pela equipa; não constitui autenticação independente da Idília. Versões anteriores são preservadas.

Gravação com bloqueio do documento, assinatura da decisão anterior, validação de referência única ainda prioritária, opções restritas, repetição sem escrita e confirmação após escrita. Os controlos ficam bloqueados durante o pedido; após falha é necessário atualizar antes de repetir. Não altera anúncios, levantamento ou pendências e não gera alertas de ausência.

Testes: configuração sintética cobre criação oculta numa operação atómica, versões anteriores, repetição, conflitos, referências duplicadas, opções inválidas e falta da confirmação da Idília. A primeira decisão real deve vir da Idília; não foram inventadas decisões para testar.

Validação nativa: 22 prioritários, zero decisões explícitas. Interface dos três portais conferida e tentativa sem origem da decisão bloqueada antes do envio ao servidor. Código instalado relido e igual ao bundle local. Dezasseis suites locais aprovadas. Não se testou a gravação de uma decisão real: não existe ainda uma indicação concreta da Idília que autorize preenchê-la. A criação da folha de suporte e persistência foram testadas com dados sintéticos, não com decisões inventadas no documento real.
