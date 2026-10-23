# Revisão de usabilidade do marcador e dos painéis

## Objetivo
Reduzir o esforço para recolher, rever e guardar, mantendo confirmação humana, histórico e os nomes de menu acordados. Sem alterações aos registos de imóveis nesta revisão.

## Implementado
- Painel eGO: etapas Colar/Rever/Guardar, instruções e nomes acessíveis para os campos, botões de ação fixos, resumo de alterações e campos sem alteração recolhidos numa secção fechada. Pendências existentes e notas são expansíveis.
- Documento alterado ou nova leitura invalida a revisão anterior; mudar de referência limpa as quatro escolhas documentais. Análise e gravação bloqueiam edição e cliques repetidos. Respostas antigas são rejeitadas. Guardar usa a leitura e as escolhas que foram efetivamente revistas.
- Falha mantém a leitura e exige nova análise antes de confirmar novamente. Sucesso limpa as escolhas e permite navegar ao registo. Erro de autorização explica a sessão Google em vez de sugerir repetições sem contexto.
- Progresso: pesquisa local por referência/localidade/assunto, sem pedidos de servidor adicionais. Botões de referências acessíveis por teclado. A pesquisa não altera os dados nem declara todos verificados quando só não há correspondências.
- Marcador: painel de estado não bloqueante, proteção contra clique repetido, confirmação de cópia e alternativa manual quando a área de transferência recusa acesso. Mostra a cobertura e o destino de colagem.
- Idiomas: ligações de cada idioma são deduplicadas, lidas em paralelo e têm tempo limite. Página inacessível é marcada como não lida, não como descrição vazia. A descrição do idioma atual só substitui o mesmo idioma, nunca português por defeito numa página estrangeira.
- Instalação: botão Copiar código e orientação para atualizar o marcador existente. É necessária uma atualização manual do marcador instalado. O menu Idealista: estatísticas conserva a confirmação nativa existente; os nomes de menu não mudaram.
- Dashboard: elimina sublinhados herdados nos blocos de texto; as ligações reais continuam identificadas como tal.

## Verificação
Testes sintéticos de estado, resposta antiga, alteração de documentos, clique duplo, recuperação, pesquisa sem acentos, cópia recusada, tempo limite e idiomas inacessíveis. Regressões eGO, Idealista, dashboard e marcador compacto incluídas na validação automática.

O novo painel foi renderizado no navegador integrado no documento ligado. A ligação RPC desse navegador devolve PERMISSION_DENIED. No acesso automático ao Chrome, os painéis HTML ficaram vazios, incluindo Progresso. Foi solicitada confirmação humana do carregamento no Chrome; esta validação continua pendente. Não declarar validação completa da gravação pela nova interface só pelos testes ou pela renderização inicial. A gravação de dados não foi repetida nesta revisão.
