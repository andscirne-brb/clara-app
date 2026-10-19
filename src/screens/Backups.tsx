import { useEffect, useState } from "react";
import { api, type BackupOverview, type SecretKind, type VerifyReport } from "../api";
import { Btn, Card, CheckLine, Notice, SecretDialog } from "../components";
import { formatBytes, formatDateTime } from "../format";

type Msg = { tone: "ok" | "error" | "info" | "warn"; text: string } | null;

export function Backups(props: { onLocked: (message: string) => void; refreshKey: number }) {
  const [ov, setOv] = useState<BackupOverview | null>(null);
  const [msg, setMsg] = useState<Msg>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [verifyTarget, setVerifyTarget] = useState<string | null>(null);
  const [report, setReport] = useState<VerifyReport | null>(null);
  const [restoreTarget, setRestoreTarget] = useState<{ fileName: string | null; label: string } | null>(null);

  const load = () => api.backupOverview().then(setOv).catch((e) => setMsg({ tone: "error", text: e.message }));
  useEffect(() => {
    void load();
  }, [props.refreshKey]);

  async function act(key: string, fn: () => Promise<Msg | void>) {
    setBusy(key);
    setMsg(null);
    try {
      const m = await fn();
      if (m) setMsg(m);
      await load();
    } catch (e) {
      setMsg({ tone: "error", text: (e as Error).message });
    } finally {
      setBusy(null);
    }
  }

  if (!ov) return <div className="page" />;
  const t = ov.task;

  return (
    <div className="page">
      <header className="page-head">
        <p className="eyebrow">Configuração</p>
        <h1>Backups</h1>
        <p className="lead">
          Uma cópia cifrada por dia às 22h, com a Clara aberta ou fechada. Fica a cópia mais recente de cada um dos
          últimos 7 dias e de cada uma das últimas 4 semanas. Quem envia para a cloud é o Google Drive, nunca a Clara.
        </p>
      </header>

      {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}

      <Card title="1. Pasta de destino">
        <div className="file-pick">
          <Btn busy={busy === "dir"} onPress={() => act("dir", async () => void (await api.pickBackupDir()))}>
            {ov.dir ? "Mudar pasta" : "Escolher pasta"}
          </Btn>
          <span className="path">{ov.dir ?? "Nenhuma pasta escolhida"}</span>
        </div>
        {ov.dir_problem && <Notice tone="error">{ov.dir_problem}</Notice>}
        {ov.dir && (
          <CheckLine checked={ov.dir_confirmed} onChange={(v) => act("confirm", () => api.confirmBackupDir(v))}>
            Confirmo que esta pasta é a <strong>Clara Backups</strong> na unidade do Google Drive da conta de
            trabalho, e não na conta pessoal.
          </CheckLine>
        )}
        {ov.dir && !ov.dir_confirmed && (
          <p className="muted small">A Clara não consegue confirmar sozinha a que conta Google pertence a pasta. Verifica o caminho acima.</p>
        )}
      </Card>

      <Card title="2. Backup diário às 22h">
        {!t.supported ? (
          <p className="muted">A tarefa agendada só existe no Windows.</p>
        ) : (
          <>
            <p>
              Estado:{" "}
              {t.installed && t.matches_current_exe ? (
                <span className="pill pill-ok">Ativa</span>
              ) : t.installed ? (
                <span className="pill pill-warn">Ativa, mas aponta para outra cópia da Clara</span>
              ) : (
                <span className="pill pill-warn">Não ativa</span>
              )}{" "}
              <span className="muted">Próxima: {ov.next_slot_local}</span>
            </p>
            <ul className="explain">
              <li>
                <strong>Clara aberta e desbloqueada:</strong> é ela que faz a cópia, sem te interromper.
              </li>
              <li>
                <strong>Clara fechada ou bloqueada:</strong> o Agendador do Windows copia o ficheiro, que já está cifrado,
                sem o abrir e sem a palavra-passe.
              </li>
              <li>
                <strong>PC desligado às 22h:</strong> a cópia é feita assim que o ligares. O PC não é acordado.
              </li>
            </ul>
            {t.installed && !t.matches_current_exe && t.command && (
              <Notice tone="warn">
                A tarefa aponta para <code>{t.command}</code>, mas esta Clara está em <code>{t.current_exe}</code>. Clica em
                “Ativar” para a corrigir.
              </Notice>
            )}
            <div className="row-start">
              <Btn
                variant="primary"
                busy={busy === "task"}
                isDisabled={!ov.dir}
                onPress={() => act("task", async () => (await api.taskInstall(), { tone: "ok", text: "Tarefa das 22h ativa." }))}
              >
                {t.installed ? "Ativar outra vez" : "Ativar"}
              </Btn>
              {t.installed && (
                <Btn
                  busy={busy === "run"}
                  onPress={() =>
                    act("run", async () => {
                      await api.lock();
                      await api.taskRunNow();
                      props.onLocked(
                        "Bloqueei a Clara e pedi ao Windows para correr a tarefa agora. Espera uns segundos e desbloqueia: o resultado aparece em Hoje e no Histórico.",
                      );
                    })
                  }
                >
                  Testar a tarefa agora
                </Btn>
              )}
              {t.installed && (
                <Btn
                  variant="ghost"
                  busy={busy === "rm"}
                  onPress={() => act("rm", async () => (await api.taskRemove(), { tone: "info", text: "Tarefa removida." }))}
                >
                  Desativar
                </Btn>
              )}
            </div>
            {!ov.dir && <p className="muted small">Escolhe primeiro a pasta de destino.</p>}
          </>
        )}
      </Card>

      <Card
        title="3. Cópias guardadas"
        actions={
          <Btn
            busy={busy === "now"}
            isDisabled={!ov.dir}
            onPress={() =>
              act("now", async () => {
                const r = await api.backupNow();
                return r.ok ? { tone: "ok", text: `Backup criado: ${r.file_name}` } : { tone: "error", text: r.error ?? "Falhou." };
              })
            }
          >
            Fazer backup agora
          </Btn>
        }
      >
        {ov.last_attempt && !ov.last_attempt.ok && (
          <Notice tone="error" title={`Última tentativa falhou (${formatDateTime(ov.last_attempt.finished_at)})`}>
            {ov.last_attempt.error}
          </Notice>
        )}
        {ov.files.length === 0 ? (
          <p className="muted">Ainda não há cópias nesta pasta.</p>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">Cópia</th>
                  <th scope="col">Tamanho</th>
                  <th scope="col">
                    <span className="visually-hidden">Ações</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {ov.files.map((f) => (
                  <tr key={f.file_name}>
                    <th scope="row">
                      {f.created_local}
                      <span className="muted small block mono">{f.file_name}</span>
                    </th>
                    <td>{formatBytes(f.bytes)}</td>
                    <td className="cell-actions">
                      <Btn variant="ghost" onPress={() => setVerifyTarget(f.file_name)}>
                        Testar restauro
                      </Btn>
                      <Btn variant="ghost" onPress={() => setRestoreTarget({ fileName: f.file_name, label: f.created_local })}>
                        Restaurar
                      </Btn>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {report && (
          <Notice tone={report.history_chain_ok ? "ok" : "error"} title={`Teste de restauro: ${report.file_name}`}>
            {report.history_chain_ok
              ? `A cópia abre e está íntegra. ${report.properties} imóveis, ${report.listings} publicações, ${report.issues} problemas, ${report.history_events} eventos no histórico, ${report.portals} destinos, esquema v${report.schema_version}. Nada foi alterado.`
              : `A cópia abre mas o histórico tem um problema: ${report.history_problem}`}
          </Notice>
        )}
      </Card>

      <Card title="4. Restaurar a partir de outro ficheiro">
        <p className="muted">Para uma cópia que não está na pasta acima, por exemplo vinda de outro PC.</p>
        <div>
          <Btn
            onPress={() =>
              act("pick", async () => {
                const f = await api.pickBackupFile();
                if (f) setRestoreTarget({ fileName: null, label: f });
              })
            }
          >
            Escolher ficheiro .clarabak
          </Btn>
        </div>
      </Card>

      <SecretDialog
        isOpen={!!verifyTarget}
        title="Testar restauro"
        intro={
          <p>
            A Clara abre <span className="mono small">{verifyTarget}</span> numa pasta temporária, só para leitura, confere a
            integridade e apaga a cópia temporária. Os teus dados atuais não mudam.
          </p>
        }
        confirmLabel="Testar"
        onCancel={() => setVerifyTarget(null)}
        onSubmit={async (kind: SecretKind, secret: string) => {
          setReport(await api.verifyBackup(verifyTarget, kind, secret));
          setVerifyTarget(null);
        }}
      />

      <SecretDialog
        isOpen={!!restoreTarget}
        danger
        title="Restaurar este backup?"
        intro={
          <>
            <p>
              Vais voltar ao estado de <strong>{restoreTarget?.label}</strong>. O que fizeste depois dessa cópia deixa de
              aparecer.
            </p>
            <p className="muted small">
              A base atual não é apagada: fica guardada numa pasta “antes-do-restauro” dentro dos dados da Clara. Depois
              tens de desbloquear com a palavra-passe da altura da cópia.
            </p>
          </>
        }
        confirmLabel="Verificar e restaurar"
        onCancel={() => setRestoreTarget(null)}
        onSubmit={async (kind, secret) => {
          await api.restoreBackup(restoreTarget!.fileName, kind, secret);
          setRestoreTarget(null);
          props.onLocked("Backup restaurado e verificado. Desbloqueia com a palavra-passe que usavas quando a cópia foi feita.");
        }}
      />
    </div>
  );
}
