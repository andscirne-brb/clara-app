import { useEffect, useMemo, useState } from "react";
import { api, type Portal } from "../api";
import { Notice, ToggleSwitch } from "../components";
import { grupoLabel, kindLabel, rulesLabel } from "../format";

export function Portals() {
  const [items, setItems] = useState<Portal[]>([]);
  const [q, setQ] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    api.portals().then(setItems).catch((e) => setError(e.message));
  }, []);

  const shown = useMemo(() => {
    const t = q.trim().toLowerCase();
    return t ? items.filter((p) => p.name.toLowerCase().includes(t) || p.id.includes(t)) : items;
  }, [items, q]);

  const on = items.filter((p) => p.monitoring_enabled).length;

  return (
    <div className="page">
      <header className="page-head">
        <p className="eyebrow">Configuração</p>
        <h1>Destinos</h1>
        <p className="lead">
          Os {items.length} destinos onde os imóveis podem aparecer. Os destinos "Só via EGO" recebem os anúncios do EGO e não se editam no portal. Grupo e regras ficam por confirmar até ao
          levantamento das regras. {on} com monitorização ligada.
        </p>
      </header>

      <div className="toolbar">
        <label className="search">
          <span className="visually-hidden">Procurar destino</span>
          <input type="search" placeholder="Procurar destino" value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
      </div>

      {error && <Notice tone="error">{error}</Notice>}

      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th scope="col">Destino</th>
              <th scope="col">Tipo</th>
              <th scope="col">Grupo</th>
              <th scope="col">Regras</th>
              <th scope="col">Monitorização</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((p) => (
              <tr key={p.id}>
                <th scope="row">
                  {p.name}
                  <span className="muted small block mono">{p.id}</span>
                </th>
                <td>{kindLabel[p.kind] ?? p.kind}</td>
                <td>
                  <select
                    className="inline-select"
                    aria-label={`Grupo de ${p.name}`}
                    value={p.grupo}
                    disabled={saving === p.id}
                    onChange={async (e) => {
                      setSaving(p.id);
                      setError(null);
                      try {
                        const updated = await api.setGroup(p.id, e.target.value);
                        setItems((all) => all.map((x) => (x.id === p.id ? updated : x)));
                      } catch (err) {
                        setError((err as Error).message);
                      } finally {
                        setSaving(null);
                      }
                    }}
                  >
                    {Object.entries(grupoLabel).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                </td>
                <td>
                  <span className="pill">{rulesLabel[p.rules_status] ?? p.rules_status}</span>
                </td>
                <td>
                  <ToggleSwitch
                    label={`Monitorização de ${p.name}`}
                    checked={p.monitoring_enabled}
                    disabled={saving === p.id}
                    onChange={async (v) => {
                      setSaving(p.id);
                      setError(null);
                      try {
                        const updated = await api.setMonitoring(p.id, v);
                        setItems((all) => all.map((x) => (x.id === p.id ? updated : x)));
                      } catch (e) {
                        setError((e as Error).message);
                      } finally {
                        setSaving(null);
                      }
                    }}
                  />
                </td>
              </tr>
            ))}
            {shown.length === 0 && (
              <tr>
                <td colSpan={5} className="muted">
                  Nenhum destino com “{q}”.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
