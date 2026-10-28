# Avisos de desempenho — primeiro incremento

Disponíveis em Clara > Portais: auditoria, por imóvel prioritário e ID confirmado. O cartão e a visão geral indicam os imóveis com avisos. Não cria pendências, não atribui responsáveis, não envia email e não altera anúncios ou dados. Usa as fontes já carregadas pela comparação, sem pedidos externos adicionais.

## Regras e limites

Idealista: ranking por anúncio com período explícito, data, filtros e métricas não contraditórias. Contactos são o total exportado ou a soma de chamadas e mensagens quando ambos existem. Desconhecido não é zero. Em pelo menos sete dias do período recolhido, visitas em detalhes positivas com zero contactos originam observação para revisão; não prova problema do anúncio. Quedas de visitas/contactos exigem períodos consecutivos com o mesmo número de dias e os mesmos filtros, base positiva e valores conhecidos. Sem percentagem mínima inventada nem comparação entre portais.

Green-Acres: usa visitas/emails por anúncio. Só sinaliza visitas sem emails num mês anterior reconhecido como fechado; mês atual, ontem e períodos sem limites absolutos não geram esse aviso. Emails não representam todos os canais de lead. Não compara meses de durações diferentes.

Rightmove: janela de 30 dias. Usa a comparação estruturada do CSV, guardada como diferença absoluta · diferença percentual, com ou sem sinal %. Ambas negativas permitem mostrar a queda indicada pelo próprio portal. New entry, formatos desconhecidos e conflitos ficam sem conclusão automática. Não infere contactos por imóvel a partir das visitas.

Apresenta fonte, data, período, notas e indicadores. Sem aviso gerado não significa bom desempenho: podem faltar dados ou histórico compatível. As observações descrevem os dados recolhidos, sem afirmar presença atual, causalidade ou necessidade de publicação.

## Validação

Dezoito suites locais passaram; após ajustes finais repetidas as suites afetadas de auditoria e desempenho. Casos sintéticos: períodos desiguais/sobrepostos/filtros distintos, base zero, desconhecidos, conflitos, mês parcial, entrada nova e janelas diferentes. Verificação nativa e visual registadas após instalação.

Validação nativa final em 28/10: 22 prioritários e 44 anúncios associados avaliados; zero avisos gerados com os dados e regras atuais, zero pendências criadas. Consulta de leitura concluída em cerca de 15 segundos num ensaio (não é garantia). Interface inspecionada com APT13261: Green-Acres Este mês sem conclusão temporal; Rightmove com comparação não normalizada explicitamente indicada. Código instalado relido e igual ao bundle. Não confundir zero avisos com bom desempenho.
