# Clara

A sidekick da Andreia para a presença dos imóveis nos portais: ajuda a detetar o que falta e a clarificar o que precisa de melhorar.

Aplicação desktop **local** para Windows 11. Sem servidor, sem cloud, sem IA, sem telemetria. Os dados ficam cifrados neste PC. As cópias de segurança, também cifradas, vão para a pasta **Clara Backups** do Google Drive da conta de trabalho.

A especificação completa fica fora deste repositório.

**Estado:** slice 1 (Fundação) concluído. Imóveis, auditorias, pedidos e prioridades chegam nos slices seguintes.

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
