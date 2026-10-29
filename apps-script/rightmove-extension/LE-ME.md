# Clara · imóveis e Rightmove — 0.2.0

Atualiza a extensão que já tens instalada, substituindo todos os ficheiros na mesma pasta e clicando Atualizar em chrome://extensions. Não precisas de instalar uma segunda extensão. Confirma a versão 0.2.0. O Chrome pode pedir acesso ao website público da agência para a nova ação; não é acesso ao CRM administrativo do eGO.

## eGO: ler este imóvel

Abre a página pública completa do imóvel no website da agência. Clica na extensão e em «eGO: ler este imóvel». A leitura apresenta os campos confirmados e os que ficaram por verificar. Copia se a cópia automática não funcionar. No Sheets, abre Clara > eGO: estado, cola, analisa, revê e confirma a gravação. Os documentos continuam a ser confirmados manualmente. Não é possível ler o CRM interno nesta versão.

Fotografias e alt texts só são confirmados quando a galeria fica completa. Campos desconhecidos não são tratados como ausentes. «Descrição lida» confirma leitura, não qualidade editorial. O histórico e os estados anteriores continuam sujeitos às regras existentes do Sheets. Não há gravação automática nem edição do website.

## Rightmove

O percurso continua disponível no segundo botão, com CSV de desempenho prioritário e leads agregadas sem dados pessoais. Mantém o relatório de leads visível. Se o popup fechar ao ativar o relatório, volta a abri-lo para copiar. Os prazos, falhas parciais e conferência de totais da 0.1.4 são mantidos.

## Validação e dados

Piloto: 23 suites locais aprovadas; instalação e leitura real da nova ação ainda precisam de teste. Testa primeiro um imóvel conhecido e confere o resultado no Sheets. A extensão guarda temporariamente a leitura em storage.session, com limite de 30 minutos para copiar; pode ser apagada em Limpar leitura e desaparece ao fechar o browser. Não guarda palavras-passe nem envia dados para um servidor próprio.

O código é estático, sem bibliotecas remotas. Só executa por clique. Não pede acesso ao admin.eGO nem a todos os sites. O novo acesso serve apenas o domínio público da agência. Detalhes técnicos e limites em docs/EXTENSAO-IMOVEIS.md no repositório.
