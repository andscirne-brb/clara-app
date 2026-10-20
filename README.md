# Clara

## Resumo por imóvel (0.3.2)

Os novos resumos apresentam uma tabela com uma linha por imóvel: trabalho realizado/verificação e pendentes para análise da Sara. O Excel mantém uma linha por alteração, sem reorganização nem perda do histórico. **Copiar email** inclui a tabela formatada e uma alternativa em texto simples; se a cópia formatada não estiver disponível, a Clara avisa. Resumos antigos permanecem no seu formato original. Autoria, local e verificação detalhados continuam no Excel; falhas ou verificações pendentes permanecem visíveis no resumo. Júlia continua apenas em CC. Nenhum envio automático.

## Resumo semanal (0.3.1)

Em **Resumo semanal**, escolhe uma vez o mesmo levantamento principal XLSM na pasta sincronizada do Drive. Guarda e sincroniza o ficheiro antes de gerar. A Clara lê as folhas Levantamento, Pendências da equipa e Registo de alterações, sem executar macros nem alterar o ficheiro. Seleciona o período, gera e usa **Copiar email**. Os resumos gerados são preservados no cofre cifrado, com período, data, nome e hash do ficheiro consultado. Gerar de novo preserva o resumo anterior. O registo de alterações no XLSM continua a ser o histórico colaborativo detalhado; a Clara guarda a fotografia semanal desse registo e das pendências.

A Sara é a interlocutora de todos os assuntos; a Júlia recebe apenas em CC. O campo **Responsável** identifica quem acompanha ou executa a ação e não é preenchido por dedução. A Clara não envia mensagens. Estados Concluído sem decisão, data de resolução e verificação confirmada continuam a aparecer como pendentes de validação. Registos sem data são assinalados, não contados como trabalho confirmado do período. Os registos sem hora são filtrados pela data e exigem atenção aos limites do período. As pendências são as atuais, incluindo assuntos antigos.

O botão **Ativar lembrete das 20h15** cria uma tarefa local do Windows, à sexta-feira, para apresentar um lembrete. Requer o Windows com fuso de Lisboa, sessão iniciada e computador disponível. O lembrete não abre dados nem gera o relatório com o cofre bloqueado: abre a Clara, desbloqueia e gera o resumo. Não usa IA ou tokens. A tarefa é independente do backup diário e pode ser desativada no mesmo ecrã.

## Recolha manual local (0.3.0)

Em **Imóveis**, as moradias e os apartamentos aparecem primeiro. Abre um imóvel e usa **Recolha manual e textos originais**:

1. Guarda as capturas originais numa pasta com a referência EGO. Usa **Ler uma captura** para extrair texto localmente no Windows (PNG/JPEG, até 30 MB). Capturas longas são divididas em faixas; secções fechadas ou texto fora da área visível não podem ser lidos. A Clara guarda nomes e texto extraído no cofre, não a imagem original.
2. Copia o título e a descrição para o idioma correto (PT/EN/FR/DE/ES). Confirma cada texto com a ficha. A cópia direta do texto é preferível ao OCR quando possível.
3. Indica as características assinaladas que confirmaste visualmente, uma por linha. A leitura de texto não identifica checkboxes.
4. Compara com o texto PT. As regras iniciais são conservadoras, têm cobertura limitada e devolvem a frase de origem; todas as diferenças exigem confirmação. Não provam que a característica esteja em falta. Quantidades são conferidas na frase, não preenchidas automaticamente. Textos sobre potencial, projetos ou negações são excluídos conservadoramente.
5. Regista as faltas de meios e anexos nas observações, guarda uma versão e exporta CSV para abrir no Excel. Cada gravação acrescenta uma versão ao cofre cifrado, incluída nos backups existentes. O original não é sobrescrito.

Não há consulta automática do eGO nem envio a serviços de IA. A visita virtual não faz parte dos requisitos. A otimização SEO e a comparação automática em outros idiomas ficam para uma fase posterior. A extração depende dos idiomas OCR instalados no Windows; se estiver indisponível, a introdução manual continua disponível.

A sidekick da Andreia para a presença dos imóveis nos portais: ajuda a detetar o que falta e a clarificar o que precisa de melhorar.

Aplicação desktop **local** para Windows 11. Sem servidor, sem cloud, sem IA, sem telemetria. Os dados ficam cifrados neste PC. As cópias de segurança, também cifradas, vão para a pasta **Clara Backups** do Google Drive da conta de trabalho.

A especificação completa fica fora deste repositório.

**Estado do desenvolvimento:** fundação existente e ciclo operacional implementado em código: imóveis, publicações, checklist-base, auditoria, problemas, edição manual e QA. Importação EGO `.xlsm`, `.xlsx` e CSV com pré-visualização incluída. A compilação e os testes nativos desta alteração têm de passar antes de distribuir um novo instalador. Pedidos consolidados e importação de prioridades continuam para as fases seguintes.

## Imóveis, auditoria e importação EGO

Em **Imóveis**, adiciona um imóvel pela referência EGO ou escolhe **Importar do EGO**. A referência é texto, com preservação dos zeros iniciais. Adicionar manualmente uma referência já existente abre esse imóvel. Arquivar preserva publicações e histórico; reativar mantém a identidade.

Na importação, escolhe explicitamente a folha e pré-visualiza antes de confirmar. São necessárias as colunas Referência, Natureza, Disponibilidade, Concelho e Data de alteração. Datas: DD/MM/AAAA ou AAAA-MM-DD, ou célula de data do Excel. CSV em UTF-8, separado por vírgulas ou ponto e vírgula. Limites: 20 MB de ficheiro, 128 MB descomprimidos, 10 000 linhas e 1 000 colunas Excel.

Os preços e a data de criação são ignorados. Descrições só são guardadas por opção explícita em cada importação, com confirmação de autorização; desligar essa opção preserva descrições anteriormente guardadas. Macros não são executadas. Fórmulas nas colunas importadas e referências numéricas no Excel são assinaladas como erro. Converte referências em texto no ficheiro de origem para conservar os zeros. Referências repetidas e datas inválidas bloqueiam toda a importação, sem gravação parcial. Repetir a mesma importação não duplica imóveis; imóveis ausentes e o seu arquivo são preservados. Uma alteração aos imóveis depois da pré-visualização obriga a pré-visualizar novamente.

Cada imóvel pode ter uma publicação por destino, com referência e URL próprias. A pesquisa encontra referências EGO e referências associadas aos destinos. URL desconhecida é permitida no registo, mas o QA exige a URL pública https guardada. A app não abre nem edita os portais.

Seleciona uma publicação e inicia uma auditoria. A checklist-base v1 contém boas práticas, sem as apresentar como regras obrigatórias do portal. As regras específicas continuam por confirmar e o Health Score fica **Não configurado**. Completude indica conformes/avaliados; cobertura indica avaliados/aplicáveis e mostra os itens por verificar. Não aplicável e não conforme exigem uma observação. O rascunho da auditoria é guardado na base cifrada a cada alteração; confirma a indicação de gravação antes de fechar. Concluir guarda uma nova versão e cria problemas a partir dos itens não conformes.

Em cada problema, regista apenas uma edição que já realizaste manualmente no EGO ou portal, com campos/idiomas e motivo. O problema fica com QA pendente. Depois da observação do anúncio público, regista URL, resultado e evidência: aprovação resolve, falha reabre, não verificável mantém a pendência. Uma nova edição ou alteração à publicação exige novo QA e preserva o anterior. A data registada é a da confirmação na Clara. Agendamento de reverificação após feed e preparação de textos ficam para uma evolução posterior.

### Validação desta alteração

- `npm run build:web`: tipos e compilação da interface.
- `cargo test --workspace --release --locked`: inclui testes de identidade, relações, arquivo, QA, rollback sem histórico, importação, XLSM sintético e restauro cifrado do ciclo/rascunho.
- `npm run verificar`: árvore de dependências sem bibliotecas de rede proibidas. `calamine`, `csv` e `zip` leem os ficheiros localmente; `url` valida a sintaxe e não efetua pedidos.
- O workflow **Validar desenvolvimento** cria um instalador de teste nos ramos `desenvolvimento-*`, sem publicar no ramo de instaladores nem alterar a instalação da utilizadora.
- Um teste de interface com comandos Tauri simulados verifica navegação, pesquisa, rascunho, ciclo de QA, erros de importação e composição em modo claro/escuro. Esse teste não prova persistência nativa nem substitui os testes Rust ou a utilização no Windows.

Antes de usar dados reais mantém-se pendente a observação de rede do WebView2 (AC23). O levantamento das regras reais dos portais também continua pendente.

---

## 1. Instalar a Clara

1. Faz duplo clique em **`Clara-instalador.exe`** (na pasta `C:\Projetos\Clara`).
2. Se o Windows perguntar, confirma que queres instalar.
3. A Clara fica no menu Iniciar. O programa vai para `%LOCALAPPDATA%\Clara`; os teus dados ficam à parte, em `%LOCALAPPDATA%\Clara-Dados`.

Não precisas de instalar mais nada. O instalador é criado e testado automaticamente num Windows real (GitHub Actions) a partir deste código.

Para atualizar a Clara mais tarde, basta correr o instalador novo por cima: os dados não são tocados.

## 2. Desinstalar

Definições do Windows → Aplicações → Clara → Desinstalar. Os dados em `%LOCALAPPDATA%\Clara-Dados` e os backups no Google Drive **não** são apagados.

## 3. Primeira utilização

1. Abre **Clara** no menu Iniciar → **Começar do zero**.
2. Cria a palavra-passe (mínimo 12 caracteres; uma frase é o ideal).
3. Escreve a **chave de recuperação** em papel e confirma os dois blocos pedidos. Guarda o papel fora do PC, junto dos códigos de recuperação da conta Google de trabalho.
4. **Configuração → Backups**:
   1. **Escolher pasta** → a pasta `Clara Backups` na unidade do Google Drive da conta de trabalho.
   2. Marca a confirmação de que é a conta de trabalho.
   3. **Ativar** a tarefa das 22h.
   4. **Fazer backup agora** e depois **Testar restauro** nessa cópia.
   5. **Testar a tarefa agora**: a Clara bloqueia-se e pede ao Windows para correr a tarefa. Espera uns segundos, desbloqueia e confirma em **Hoje** que o último backup foi feito "pela tarefa agendada".

Até confirmares que podes guardar dados reais, usa apenas dados de teste.

## 4. Como funciona a segurança

- **Base cifrada** (SQLCipher, AES-256) em `%LOCALAPPDATA%\Clara-Dados`, fora do OneDrive e do Google Drive.
- A chave da base é aleatória e fica guardada **duas vezes, sempre trancada**: pela palavra-passe e pela chave de papel (Argon2id + XChaCha20-Poly1305). Sem uma das duas, os ficheiros são ilegíveis. Ao bloquear, a chave é apagada da memória.
- **Bloqueio automático** ao fim de 15 minutos sem atividade (configurável em Segurança).
- **Histórico** que não pode ser editado nem apagado (a própria base recusa) e com eventos encadeados por hashes: uma alteração feita por fora é detetada em **Histórico → Verificar integridade**.
- **Backups `.clarabak`**: base cifrada + chaves trancadas + verificação SHA-256. Restauram num PC novo só com a palavra-passe da altura ou com a chave de papel.
- **Backup das 22h**: com a Clara desbloqueada, é ela que faz a cópia; fechada ou bloqueada, o Agendador do Windows corre `clara.exe --scheduled-backup`, que copia os ficheiros já cifrados **sem os abrir e sem a palavra-passe**. Se o PC estiver desligado, corre quando o ligares. O PC não é acordado.
- **Rotação**: a cópia mais recente de cada um dos últimos 7 dias e de cada uma das últimas 4 semanas. Só são apagados ficheiros com o padrão `clara-AAAA-MM-DD_HHMMSS.clarabak`.
- **Sem rede**: nenhuma biblioteca de rede nas dependências (verificado em cada `npm run compilar` por `scripts/verificar-rede.mjs`), CSP restritiva, interface sem acesso a ficheiros, shell ou rede, sem recursos remotos.

### Riscos residuais (honestos)

- O **WebView2** é da Microsoft e pode fazer pedidos próprios (SmartScreen, atualizações do runtime). A Clara não os controla. Medir antes de usar dados reais (AC23).
- Com a Clara **desbloqueada**, quem estiver ao teu PC vê os dados. Bloqueia quando te afastares.
- Um PC com **malware** pode ler o que está no ecrã ou o que escreves. A cifragem protege contra perda e roubo, não contra um PC comprometido.
- Se perderes a palavra-passe **e** a chave de papel, os dados e os backups ficam ilegíveis para sempre.
- Depois de mudares a palavra-passe ou gerares uma nova chave de papel, as cópias **antigas** continuam a abrir só com as credenciais antigas. Guarda o papel antigo cerca de 4 semanas.

## 5. Recuperar depois de perder ou avariar o PC

1. Instala a Clara no PC novo com o instalador (passo 1).
2. Instala o Google Drive para computador com a conta de trabalho e espera que a pasta **Clara Backups** sincronize.
3. Abre a Clara → **Restaurar de um backup** → escolhe o `.clarabak` mais recente.
4. Desbloqueia com a palavra-passe da altura da cópia ou com a chave de papel.
5. Volta a escolher a pasta e a ativar a tarefa das 22h.

## 6. Desenvolvimento (só para quem programa)

Para compilar localmente são precisos: Visual Studio Build Tools (C++), Rust, Node.js LTS e Strawberry Perl. Para usar a Clara, nada disto é necessário: basta o instalador.

```powershell
npm run abrir      # abre a Clara em modo de desenvolvimento (dados em %LOCALAPPDATA%\Clara-Dados-dev)
npm run testar     # testes do núcleo
npm run verificar  # verificação de dependências de rede
```

O modo de desenvolvimento usa **outra pasta de dados** (`Clara-Dados-dev`), por isso nunca mistura testes com os dados reais.

### Estrutura

```text
crates/clara-core/     Núcleo em Rust, sem interface e sem rede
  src/keys.rs          Chave mestra, palavra-passe, Argon2id, XChaCha20-Poly1305
  src/recovery.rs      Chave de recuperação (8 blocos, com verificação de erros de cópia)
  src/vault.rs         Abrir, bloquear, criar; bloqueio de processo
  src/db.rs            SQLCipher e verificações de integridade
  src/migrations.rs    Migrações numeradas (migrations/*.sql)
  src/history.rs       Histórico imutável e encadeado
  src/catalog.rs       Os 23 destinos
  src/backup.rs        .clarabak, rotação, verificação, restauro, modo agendado
  src/schedule.rs      Hora das 22h (Lisboa, com mudança de hora) e XML da tarefa
src-tauri/             Camada fina da app: comandos, bloqueio por inatividade, tarefa do Windows
src/                   Interface (React + TypeScript), em PT-PT
scripts/               Verificação de rede e instalação
```

### Critérios de aceitação cobertos no slice 1

| Critério | Como é verificado |
|---|---|
| AC13: histórico imutável, correção por compensação, alteração e evento na mesma transação | Testes `history::tests` |
| AC14: fechar, reabrir e restaurar preserva relações e eventos | Testes `vault::tests` e `backup::tests::backup_verify_restore_roundtrip`; teste completo da app |
| AC22: base e backups cifrados; interface sem acesso a comandos genéricos | Testes `db_file_is_not_plain_sqlite`, ficheiro `.clarabak` ilegível; `capabilities/default.json` |
| AC25: dados fora de pastas sincronizadas; restauro cifrado testado; chave separada dos dados | `%LOCALAPPDATA%\Clara-Dados`; chave mestra nunca gravada em claro (`keyfile_contains_no_master_key`) |

Foi também corrido um teste completo da app real (criar, chave de papel, destinos, backup, testar restauro, bloquear, palavra-passe errada, restaurar com a chave de papel, verificar histórico), numa máquina Linux de testes.

### Verificações no Windows

Cada alteração ao código é compilada e testada num Windows real (`.github/workflows/windows.yml`): todos os testes, criação e remoção de uma tarefa no Agendador, instalação silenciosa e arranque em modo agendado.

Ainda por fazer antes de dados reais: observação de rede do WebView2 (AC23).
