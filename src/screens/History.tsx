import { useEffect, useState } from "react";
import { api, type ChainReport, type HistoryEvent } from "../api";
import { Btn, Notice } from "../components";
import { formatDateTime } from "../format";

const PAGE = 50;

export function History(props: { refreshKey: number }) {
  const [events, setEvents] = useState<HistoryEvent[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [check, setCheck] = useState<ChainReport | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .history(PAGE, offset)
      .then((r) => {
        setEvents(r.events);
        setTotal(r.total);
      })
      .catch((e) => setError(e.message));
  }, [offset, props.refreshKey]);

  return (
    <div className="page">
      <header className="page-head">
        <p className="eyebrow">Configuração</p>
        <h1>Histórico</h1>
        <p className="lead">
          As operações confirmadas e os eventos da Clara ficam registados aqui. Os rascunhos em edição não criam um evento por cada tecla. Cada evento está ligado ao anterior, por
          isso uma alteração feita por fora é detetada.
        </p>
      </header>

      <div className="toolbar">
        <Btn
          busy={busy}
          onPress={async () => {
            setBusy(true);
            try {
              setCheck(await api.verifyHistory());
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          Verificar integridade
        </Btn>
        <span className="muted">{total} eventos</span>
      </div>

      {check && (
        <Notice tone={check.ok ? "ok" : "error"}>
          {check.ok ? `Histórico íntegro: ${check.events} eventos verificados.` : `Problema encontrado: ${check.problem}`}
        </Notice>
      )}
      {error && <Notice tone="error">{error}</Notice>}

      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th scope="col">Quando</th>
              <th scope="col">O quê</th>
              <th scope="col">Quem</th>
            </tr>
          </thead>
          <tbody>
            {events.map((ev) => (
              <tr key={ev.id}>
                <td className="nowrap">{formatDateTime(ev.occurred_at)}</td>
                <td>
                  {ev.summary}
                  {ev.reason && <span className="muted small block">Motivo: {ev.reason}</span>}
                  {ev.redacted && <span className="muted small block">Conteúdo expurgado</span>}
                  <span className="muted small block mono">{ev.action}</span>
                </td>
                <td>{ev.actor === "andreia" ? "Andreia" : "Sistema"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="row-between">
        <Btn variant="ghost" isDisabled={offset === 0} onPress={() => setOffset(Math.max(0, offset - PAGE))}>
          Mais recentes
        </Btn>
        <span className="muted small">
          {total === 0 ? 0 : offset + 1} a {Math.min(offset + PAGE, total)} de {total}
        </span>
        <Btn variant="ghost" isDisabled={offset + PAGE >= total} onPress={() => setOffset(offset + PAGE)}>
          Mais antigos
        </Btn>
      </div>
    </div>
  );
}
