# Seguimento após o levantamento — 27/10/2026

## Fluxo aprovado

Clara > eGO: estado mantém a leitura do marcador e passa a incluir «Pesquisar referência · documentos e planta». A pesquisa carrega os estados existentes; a confirmação grava apenas dados do Sheets. Não altera o CRM.

Estados: Por verificar; Em falta no eGO · verificar dossier; No dossier · por digitalizar; Digitalizado; Em falta no eGO e no dossier; Categoria errada; Formato errado; Preenchido; Não aplicável.

Digitalizado significa que falta preparar/inserir o ficheiro no eGO. Não encerra a pendência. Ausência confirmada também no dossier atribui a tarefa à Sara. Uma atribuição manual à Sara corresponde a aguardar esclarecimento, sem afirmar automaticamente que o documento está ausente.

## Sincronização

- Documentos e planta têm uma pendência por item, com referência e ID estáveis.
- A edição do Estado nas Pendências atualiza o respetivo campo no Levantamento quando existe correspondência inequívoca. Concluído significa Preenchido; estados de preparação mantêm o trabalho aberto.
- Notas e respostas da equipa são conservadas. As ações escritas manualmente ficam anexadas ao novo próximo passo.
- Linhas documentais antigas com nome inequívoco são reutilizadas. Agrupamentos ficam arquivados como Não aplicável, com indicação de desdobramento; o histórico conserva antes/depois.
- O resumo é gerado a partir das pendências abertas do imóvel; o texto anterior fica no histórico.
- Plantas/documentos digitalizados não regressam a uma falta genérica por ausência no site público. Uma escolha explícita no painel pode atualizar o estado.
- Correspondências ambíguas não são concluídas automaticamente. Concluir um assunto genérico não confirma vários documentos.

## Instalação e migração

1. Construir Clara-completo.gs com scripts/construir-clara.py e publicar o conteúdo no projeto ligado ao documento.
2. Ativar o serviço oficial Google Sheets API no projeto (mesma autorização de Sheets existente). As tabelas tipadas recusam Range.setDataValidation.
3. Executar prepararSeguimentoDocumental: lê as tabelas, mantém as opções atuais e acrescenta os estados nas seis colunas necessárias, sem mudar os valores. Só depois ativa a sincronização automática.
4. Executar atualizarFormulasSeguimento para incluir os novos estados nos indicadores existentes.
5. Executar migrarSeguimentoDocumental por lotes de quatro imóveis até restantes=0. A fila fica guardada entre execuções; são usadas leituras atuais, nunca um snapshot antigo para escrever.

## Segurança e testes

Pesquisa exige uma única referência. A confirmação recusa uma revisão se os dados do imóvel ou pendências mudarem entretanto. Escritas agrupadas, histórico antes/depois, conferência e reposição em caso de erro. Estado do seguimento usa o documento ativo, sem IDs de clientes no código. O token Google só é usado na ligação oficial à API e nunca é registado.

Testes sintéticos: Digitalizado, ausência no dossier, Sara por documento, nomes antigos, notas conservadas, agrupamentos, resumo, repetição, concorrência e recuperação. A verificação no documento real deve registar separadamente instalação, configuração, migração e leitura final; testes locais não comprovam essas fases.

Confirmação específica da utilizadora: a planta MI14372 permanece Digitalizado, por inserir no eGO.

## Validação nativa

Google Sheets API ativada com autorização explícita da utilizadora. Configuração dos dropdowns executada com sucesso no projeto ligado ao documento. Fórmulas portuguesas exigem separador ponto e vírgula: o conversor preserva os separadores existentes e corrige misturas, incluindo o texto entre aspas. A conferência por exportação confirmou ausência de erros de fórmula e a contagem dos estados de preparação.

As tarefas antigas de alt-text são reconhecidas. Duplicados de vídeo são consolidados conservando a linha com resposta da equipa e arquivando a outra, com referência ao ID mantido. Características só passam a Preenchido por conclusão humana quando todas as pendências desse tema no imóvel estão encerradas.

Migração nativa concluída: 23 referências processadas e fila a zero. A data de resolução existente é preservada quando se atualiza outro documento; resoluções humanas sem data ficam registadas na conferência, com origem explícita da equipa.

Conferência final no próprio Apps Script: pesquisar e guardar estados existentes em quatro imóveis, com verificação de planta digitalizada e ausência de erros de fórmula. Rotina temporária removida após o teste; código final relido e comparado integralmente com o bundle local. A exportação final confirma IDs antigos 1 a 89 presentes, respostas de vídeo preservadas, resumos corrigidos e zero erros de fórmula. Guardar sem alterações termina sem escrita nem flush adicional.


## Visibilidade no website — 28/10/2026

Em eGO: estado, pesquisa por referência e guarda a visibilidade separadamente dos documentos. Opções: Por verificar; Visível no website; No eGO · não visível no website. Confirmação manual datada em Observações / justificação N/A, prefixo Website, com histórico antes/depois. Preserva outras notas, estados documentais, disponibilidade comercial e pendências. Não deduz invisibilidade de uma leitura falhada nem ausência nos portais. A consulta Portais: auditoria apresenta esta indicação para os prioritários. TE321 solicitado pela Andreia; existência no eGO e invisibilidade no site confirmadas por ela, causa não inferida.
