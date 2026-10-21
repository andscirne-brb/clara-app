# Instruções para quem continua o desenvolvimento da Clara

Este ficheiro serve qualquer assistente (Claude, ChatGPT/Codex) ou programador que pegue no trabalho. Ler primeiro `docs/ESTADO-E-PLANO.md`: diz onde está o projeto e qual é o próximo passo.

## Regras que não se quebram

1. **Confidencialidade (NDA).** Nunca usar dados reais da Janela no repositório, em testes, em exemplos ou em conversas com assistentes. Usar só dados sintéticos (`TESTE-001`, `Concelho Exemplo`). O repositório é público.
2. **A Clara não tem internet.** Não adicionar bibliotecas de rede, pedidos HTTP, telemetria nem atualizações automáticas. `scripts/verificar-rede.mjs` corre em cada compilação e falha se encontrar rede. Tudo o que precisa de internet vive no Apps Script do Google Sheet (pasta `apps-script/`), nunca na Clara.
3. **Custo zero.** Nenhum serviço pago.
4. **Nada é publicado nem enviado sozinho.** Emails ficam em rascunho. Os portais são editados à mão. O RightMove só se corrige no EGO.
5. **Não apagar dados nem histórico.** O histórico é só de acrescentar (encadeado por hash). Alterações à base de dados entram como nova migração em `crates/clara-core/migrations/`, numerada a seguir à última, e registada em `migrations.rs`.
6. **O Google Sheet é partilhado com a equipa.** Qualquer alteração ao Sheet (regras, proteções, colunas) precisa de autorização prévia da Andreia.

## Como se trabalha

- Ramo principal: `main`. Cada push para `main` compila no Windows (GitHub Actions) e publica o instalador no ramo `instaladores` (`Clara-instalador.exe` + `VERSAO.txt`). A Andreia só instala esse ficheiro: não instala ferramentas de programação.
- Trabalho maior: ramo `desenvolvimento-<tema>`, validado por `validacao.yml`, depois junta-se a `main`.
- Cada versão nova atualiza o número em `package.json`, `package-lock.json`, `src-tauri/tauri.conf.json`, `src-tauri/Cargo.toml` e `Cargo.lock`, e acrescenta uma secção no topo do `README.md`.
- Testes: `cargo test -p clara-core` e `npm run build`. Os testes que dependem do Windows (OCR, gravação no Excel) só correm na Actions.
- Textos da interface em português de Portugal, a tratar por "tu", frases curtas, sem travessões.
- No fim de cada sessão de trabalho, atualizar `docs/ESTADO-E-PLANO.md` (secção "Último ponto de situação") e fazer push, para outra pessoa ou assistente poder continuar.

## Mapa rápido do código

- `crates/clara-core/`: lógica e base de dados cifrada (SQLCipher). Módulos principais: `cycle` (imóveis, publicações, problemas, QA), `catalog` (destinos e grupos, incluindo `feed_only`), `ego_import`, `collection` e `capture_*` (recolha manual e capturas), `weekly` (levantamento e resumo semanal), `worklog`, `workbook_changes`, `company_profiles`, `backup`, `history`.
- `src-tauri/`: comandos Tauri (`commands.rs`, `*_commands.rs`) e scripts PowerShell fixos (`ocr.ps1`, `workbook-write.ps1`, `profiles-write.ps1`; os dados vão por stdin, nunca no texto do comando).
- `src/`: interface React (`screens/`, `api.ts`, `format.ts`).
- `apps-script/`: código do Apps Script do Google Sheet (corre na conta da Janela, não na Clara).
