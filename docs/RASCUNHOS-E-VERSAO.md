# Rascunho do painel e versão do marcador

O painel mantém a última leitura e as quatro escolhas documentais no armazenamento local do navegador, numa chave própria para o documento. Não envia o rascunho a um serviço externo. É uma ajuda para retomar, não uma cópia de segurança: outro navegador, limpeza de dados, bloqueio de armazenamento ou mudança da origem do painel podem impedir a recuperação.

Ao reabrir, identifica a referência e exige nova análise antes de permitir guardar. Nunca restaura uma revisão aprovada. Trocar de imóvel limpa as escolhas documentais. Limpar leitura e gravação confirmada removem o rascunho. Rascunhos com mais de sete dias não são recuperados.

Se o painel for fechado durante uma gravação, a recuperação pede primeiro a confirmação no Levantamento, pois a operação no servidor pode ter terminado. Não repete gravações automaticamente. Falhas de armazenamento são apresentadas sem impedir o percurso normal.

O marcador inclui `marcadorVersao: 20261024.1` nas leituras eGO e Idealista. Leituras anteriores continuam aceites com aviso de atualização em Clara > Instalar o marcador. Não são alterados os nomes do menu.

Testes: reabertura com escolhas, análise obrigatória, interrupção, troca de imóvel, limpeza, expiração, armazenamento recusado e aviso de versão. Dados de teste sintéticos. Validação no documento real: fechar e reabrir recuperou a leitura sintética TESTE-RASCUNHO e a escolha documental. O painel exigiu nova análise; não foi feita qualquer gravação de teste na folha. A leitura sintética foi limpa no fim.
