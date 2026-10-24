# Rightmove Plus no marcador Clara

Menu: **Rightmove: estatísticas**. O marcador reconhece Lead Reports e Property performance report. Depois da recolha, colar no painel, rever e confirmar. Reinstalar o marcador após esta atualização (versão 20261024.3).

## Leads

No Lead Reports, manter o período pretendido. O marcador consulta Summary, Calls e Emails, regressando a Summary. Conta apenas datas: nomes, telefones, emails, mensagens e gravações não entram na leitura copiada. Percorre páginas e confere cada canal com os totais. Inclui dias sem contactos apenas depois de conferir a cobertura completa. Se faltarem páginas, datas ou houver filtros incompatíveis, recusa copiar.

Destino: Rightmove - leads diárias. Guarda cada série com período, data de recolha e identificador; repetir a mesma recolha não duplica. Uma revisão fica no histórico. O dashboard usa a recolha completa com fim mais recente e, em empate, a última revisão. Não soma períodos sobrepostos. O gráfico diário ocupa o lugar do antigo gráfico mensal Rightmove, ao lado dos outros portais. Enquanto não houver série diária, mantém o histórico mensal anterior.

## Property Performance

Limpar pesquisa e desmarcar Include sold STC. Escolher Last 30, 60 ou 90 Days. O marcador percorre a lista virtual, reúne códigos únicos e compara com o total indicado. Repõe a posição de deslocação no fim. Mudanças de filtros ou indicadores durante a leitura impedem a conclusão.

Destino: Rightmove - desempenho. Regista data de atualização indicada pelo portal, janela, código, referência, localidade, preço, fotografias, plantas, dias desde atualização, visitas diárias médias e comparações. New entry fica como texto, não vira percentagem. Não inventa datas exatas do período a partir da janela.

No dashboard, o desempenho usa a recolha de 30 dias com data de atualização mais recente. As janelas de 60 e 90 dias ficam no detalhe e não substituem a média de 30. O histórico anterior de anúncios e medições é preservado.

## Validação e limites

Testes locais: datas inválidas, séries incompletas, somas, duplicações, revisão, escrita com falha e reposição, texto literal, navegação entre separadores, páginas e carteira virtual de 50 códigos. Interface testada com revisão e confirmação.

Validação nativa Google Sheets: gravação e repetição de leads e desempenho em duas folhas temporárias, removidas no fim; texto com sinal de fórmula preservado como texto. Os extratores de datas e dos campos dos anúncios foram verificados no DOM real do Rightmove. A recolha real de leads foi conferida com os totais antes do registo inicial.

A execução integral do novo marcador instalado no navegador da utilizadora continua a exigir um teste de aceitação, sobretudo para a deslocação da lista virtual e tempos de carregamento. Se o portal mudar a estrutura, a recolha deve falhar com aviso, nunca apresentar cobertura parcial como completa.

Registo inicial validado no documento: 31 dias conferidos com o resumo do portal; segunda gravação devolveu duplicada, sem novas linhas. Dashboard com três gráficos, incluindo Rightmove por dia; verificação sem erros em células. Os dados concretos e capturas permanecem privados.

## Correção do carregamento dos totais

A versão 20261024.3 aguarda a ausência de indicadores de carregamento e a correspondência do total de cada canal com Summary. Um zero transitório não provoca imediatamente o erro de totais alterados. No fim, volta a conferir os três totais do resumo. Se a diferença persistir, termina com aviso e não copia uma série incoerente. Teste de regressão com zeros transitórios aprovado.
