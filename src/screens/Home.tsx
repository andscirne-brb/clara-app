import { useEffect, useState } from "react";
import { api, type BackupOverview, type Portal } from "../api";
import { Btn, Card, Notice } from "../components";
import { formatBytes, formatDateTime, formatToday, timeAgo } from "../format";
import type { Page } from "../App";

export function Home(props: { go: (p: Page) => void; refreshKey: number }) {
  const [ov, setOv] = useState<BackupOverview | null>(null);
  const [portals, setPortals] = useState<Portal[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  const load = () => {
    api.backupOverview().then(setOv).catch(() => setOv(null));
    api.portals().then(setPortals).catch(() => setPortals([]));
  };
  useEffect(load, [props.refreshKey]);

  const monitored = portals.filter((p) => p.monitoring_enabled).length;
  const last = ov?.last_success;
  const attempt = ov?.last_attempt;
  const lastFailed = attempt && !attempt.ok && (!last || attempt.finished_at > last.finished_at);

  return (
    <div className="page">
      <header className="page-head">
        <p className="eyebrow">{formatToday()}</p>
        <h1>Hoje</h1>
      </header>

      {ov && !ov.dir && (
        <Notice tone="warn" title="Os backups ainda não estão configurados">
          Escolhe a pasta Clara Backups do Google Drive de trabalho para a Clara começar a fazer cópias às 22h.{" "}
          <button className="link" onClick={() => props.go("backups")}>
            Configurar agora
          </button>
        </Notice>
      )}
      {ov?.dir && lastFailed && (
        <Notice tone="error" title="O último backup falhou">
          {formatDateTime(attempt!.finished_at)}: {attempt!.error}
        </Notice>
      )}
      {ov?.dir && !lastFailed && last && ov.stale && (
        <Notice tone="warn" title="Há mais de 48 horas sem backup">
          Confirma que o Google Drive está aberto e faz um backup agora.
        </Notice>
      )}

      <div className="grid-2">
        <Card
          title="Último backup"
          actions={
            ov?.dir ? (
              <Btn
                busy={busy}
                onPress={async () => {
                  setBusy(true);
                  setMsg(null);
                  try {
                    const r = await api.backupNow();
                    setMsg(r.ok ? { tone: "ok", text: `Backup criado: ${r.file_name}` } : { tone: "error", text: r.error ?? "Falhou." });
                    load();
                  } catch (e) {
                    setMsg({ tone: "error", text: (e as Error).message });
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Fazer backup agora
              </Btn>
            ) : null
          }
        >
          {last ? (
            <dl className="facts">
              <div>
                <dt>Quando</dt>
                <dd>
                  {formatDateTime(last.finished_at)} <span className="muted">({timeAgo(last.finished_at)})</span>
                </dd>
              </div>
              <div>
                <dt>Feito</dt>
                <dd>{last.source === "app" ? "pela Clara aberta" : "pela tarefa agendada"}</dd>
              </div>
              <div>
                <dt>Ficheiro</dt>
                <dd className="mono small">
                  {last.file_name} · {formatBytes(last.bytes)}
                </dd>
              </div>
              <div>
                <dt>Próximo</dt>
                <dd>{ov?.next_slot_local}</dd>
              </div>
            </dl>
          ) : (
            <p className="muted">Ainda não foi feito nenhum backup.</p>
          )}
          {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}
        </Card>

        <Card title="Tarefa das 22h">
          {!ov ? null : !ov.task.supported ? (
            <p className="muted">Disponível apenas no Windows.</p>
          ) : ov.task.installed && ov.task.matches_current_exe ? (
            <p>
              <span className="pill pill-ok">Ativa</span> Faz a cópia mesmo com a Clara fechada. Se o PC estiver desligado,
              corre quando o ligares.
            </p>
          ) : ov.task.installed ? (
            <p>
              <span className="pill pill-warn">Aponta para outra cópia da Clara</span> Volta a ativá-la em Backups.
            </p>
          ) : (
            <p>
              <span className="pill pill-warn">Não ativa</span> Sem ela, só há backup quando a Clara está aberta às 22h.{" "}
              <button className="link" onClick={() => props.go("backups")}>
                Ativar
              </button>
            </p>
          )}
        </Card>

        <Card title="Destinos">
          <p className="big-number">
            {monitored}
            <span> de {portals.length} com monitorização ligada</span>
          </p>
          <div>
            <button className="link" onClick={() => props.go("destinos")}>
              Ver catálogo
            </button>
          </div>
        </Card>

        <Card title="Próximos passos da Clara">
          <p className="muted">
            Esta é a fundação: cofre, histórico e backups. Imóveis, auditorias, pedidos de materiais e prioridades chegam nos
            próximos passos.
          </p>
        </Card>
      </div>
    </div>
  );
}
