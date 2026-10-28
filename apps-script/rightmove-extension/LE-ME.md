# Clara · Rightmove — versão de teste 0.1.3

## Instalar uma vez no Chrome
1. Extrai o ZIP para uma pasta fixa. Mantém todos os ficheiros juntos.
2. Abre chrome://extensions e ativa Modo de programador.
3. Escolhe Carregar expandida (ou Carregar sem compactação) e seleciona a pasta que contém manifest.json.
4. Fixa Clara · Rightmove na barra das extensões.

A instalação concede acesso apenas aos dois domínios dos relatórios Rightmove, execução dos coletores nesses relatórios, memória temporária da extensão e cópia para a área de transferência. Não pede palavras-passe, cookies, histórico geral, acesso ao Sheets ou acesso a todos os sites. Não há instalação automática nem publicação na loja nesta versão.

## Utilizar
1. Inicia sessão no Rightmove Plus. Abre Leads > Summary e Property Performance; confirma a agência e escolhe os períodos pretendidos. Mantém apenas um separador de cada relatório. Os períodos são independentes.
2. Clica na extensão e em Recolher os dois relatórios. Evita alterar filtros ou navegar nesses separadores durante a recolha.
3. Se mantiveres a janela pequena aberta até terminar, a leitura é copiada automaticamente. Podes fechar a janela pequena; ao reabrir, recupera o resultado enquanto a sessão do navegador se mantiver. A leitura expira para cópia após 30 minutos. Limpar leitura remove-a da memória da extensão.
4. Se a cópia automática não ocorreu, clica Copiar leitura para o Sheets. No documento, Clara > Rightmove: estatísticas, cola, revê cada fonte e confirma a gravação.

Se um relatório não estiver aberto, a extensão tenta abrir a página oficial em segundo plano. Pode ser necessário iniciar sessão ou selecionar agência/período nessa página e repetir. Os separadores abertos pela extensão ficam disponíveis para esta verificação. Se faltar sessão ou algum relatório, o resultado indica o bloco em falta; não se apresenta como recolha completa. O CSV de desempenho tem prioridade. Se falhar e a leitura integral da página funcionar, só a janela escolhida é recolhida e isso é indicado no resumo.

Só se copiam datas e contagens agregadas de leads, nunca nomes, emails, telefones ou mensagens individuais. O CSV de leads não é usado, porque pode conter dados pessoais. Os resultados ficam em chrome.storage.session; não há servidor da extensão, telemetria, recolha periódica nem envio automático para o Sheets. O CSV de desempenho pode também ser descarregado pelo próprio botão do portal.

## Estado de validação
Testes locais com Chrome simulado e regressões dos coletores/Apps Script aprovados. Código do painel preparado para a leitura conjunta. A instalação real, a execução entre os dois domínios e a primeira gravação desta versão ainda precisam de teste no Chrome da Andreia. Não confundir testes simulados com validação real.

## Manutenção
collectors.js é gerado por scripts/construir-clara.py a partir dos coletores partilhados. Não editar esse ficheiro manualmente. Depois de uma atualização local, clicar Atualizar no cartão da extensão em chrome://extensions.

Correção 0.1.1: o resumo aguarda estabilidade dos totais, com espera adicional quando começa em zero. No primeiro teste real, a versão 0.1.0 guardou zeros transitórios; esse teste não valida as leads. O desempenho CSV foi guardado. A nova versão requer teste real e conferência das somas antes de ser considerada validada.

Correção 0.1.3: cada clique cria um identificador novo. A cópia automática só aceita o resultado desse pedido, impedindo a corrida que podia copiar o resultado antigo antes de começar a recolha nova. Resultados de versões anteriores não podem ser copiados pelo painel. Versão e hora do resultado são apresentadas. A atualização exige substituir todos os ficheiros na pasta carregada e clicar Atualizar em chrome://extensions; não basta mudar o manifest. A leitura corrigida ainda exige conferência real.

## Validação de leads em 0.1.3

As contagens são conferidas independentemente nas tabelas Calls e Emails e cruzadas com o resumo final. Um zero sem prova não é exportado. Zero legítimo exige cartão zero, tabela vazia e mensagem oficial No leads estáveis. Loading... nunca confirma ausência. O desempenho pode ser recolhido como bloco parcial. Instalação e recolha real desta versão ainda por validar.
