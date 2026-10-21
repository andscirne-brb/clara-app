# Instruções para quem continua o desenvolvimento da Clara

Este ficheiro serve qualquer assistente (Claude, ChatGPT/Codex) ou programador que pegue no trabalho. Ler primeiro `docs/ESTADO-E-PLANO.md`: diz onde está o projeto e qual é o próximo passo.

## Obrigatório em todas as sessões (Claude e Codex)

A Andreia alterna entre o Claude e o ChatGPT/Codex, muitas vezes quando os créditos de um acabam a meio. Quem vem a seguir só sabe o que está no repositório. Por isso:

1. **No início:** ler este ficheiro e `docs/ESTADO-E-PLANO.md`; continuar a partir de "Próximo passo".
2. **Sempre que um passo fica concluído** (não só no fim): atualizar a secção "Último ponto de situação" de `docs/ESTADO-E-PLANO.md` (data, o que foi feito, o que ficou a meio, próximo passo, decisões da Andreia) e fazer commit e push para `main`.
3. **Trabalho a meio também vai para o repositório**: num ramo `desenvolvimento-<tema>` com push, e indicado no ponto de situação. Nada fica só no computador ou na conversa.
4. Código que corre fora do repositório (Apps Script, configurações do Sheet) é copiado para `apps-script/` sem IDs nem dados reais.
5. Decisões e regras de negócio novas ditas pela Andreia entram em `docs/ESTADO-E-PLANO.md` no mesmo commit.

## Decisão em vigor (21 out 2026)

A Clara passou a viver **dentro do Google Sheet** (Apps Script, menu "Clara", painel lateral, botão "Ler esta página"). A aplicação de Windows em `src/`, `src-tauri/` e `crates/` está **em pausa**: não desenvolver nela sem a Andreia pedir. Código novo vai para `apps-script/`. Detalhes em `docs/ESTADO-E-PLANO.md`.

## Regras que não se quebram

1. **Confidencialidade (NDA).** Nunca usar dados reais da Janela no repositório, em testes, em exemplos ou em conversas com assistentes. Usar só dados sintéticos (`TESTE-001`, `Concelho Exemplo`). O repositório é público.
2. **A aplicação de Windows não tem internet** (regra mantida enquanto existir). Não adicionar bibliotecas de rede, pedidos HTTP, telemetria nem atualizações automáticas. `scripts/verificar-rede.mjs` corre em cada compilação e falha se encontrar rede. Tudo o que precisa de internet vive no Apps Script do Google Sheet (pasta `apps-script/`), nunca na Clara.
3. **Custo zero.** Nenhum serviço pago.
4. **Nada é publicado nem enviado sozinho.** Emails ficam em rascunho. Os portais são editados à mão. O RightMove só se corrige no EGO.
5. **Não apagar dados nem histórico.** O histórico é só de acrescentar (encadeado por hash). Alterações à base de dados entram como nova migração em `crates/clara-core/migrations/`, numerada a seguir à última, e registada em `migrations.rs`.
6. **O Google Sheet é partilhado com a equipa.** Qualquer alteração à estrutura do Sheet (regras, proteções, colunas) precisa de autorização prévia da Andreia.
7. **Tudo o que é partilhado com a Janela e todas as pendências vão para o Google Sheet**, para a Sara consultar num só sítio. Pendências: separador "Pendências da equipa" (títulos na linha 5, dados a partir da linha 6), uma linha por assunto, ID sequencial `P0001`, sem duplicar referência + assunto, nunca escrever na coluna P (Conferência, fórmula). Valores em uso: Responsável "Por atribuir"; Prioridade "Normal" ou "Alta"; Estado "Por tratar", "A aguardar esclarecimento", "Concluído", "Não aplicável"; Onde corrigir "eGO", "eGO e portais"…; Verificação final "Por verificar" ou "Confirmado"; Aguarda análise de "Sara". Modelo em `apps-script/pendencias.gs`.

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
