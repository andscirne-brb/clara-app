import { useCallback, useEffect, useRef, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { api, type AppStatus } from "./api";
import { Notice } from "./components";
import { RestoreFlow, Unlock, Welcome } from "./screens/Start";
import { Home } from "./screens/Home";
import { Portals } from "./screens/Portals";
import { Backups } from "./screens/Backups";
import { Security } from "./screens/Security";
import { History } from "./screens/History";
import { Properties } from "./screens/Properties";
import { Weekly } from "./screens/Weekly";

export type Page = "hoje" | "imoveis" | "resumo" | "destinos" | "backups" | "seguranca" | "historico";

const NAV: { group: string; items: { id: Page; label: string }[] }[] = [
  { group: "", items: [{ id: "hoje", label: "Hoje" }, { id: "imoveis", label: "Imóveis" }, { id: "resumo", label: "Resumo semanal" }] },
  {
    group: "Configuração",
    items: [
      { id: "destinos", label: "Destinos" },
      { id: "backups", label: "Backups" },
      { id: "seguranca", label: "Segurança" },
      { id: "historico", label: "Histórico" },
    ],
  },
];

export default function App() {
  const [status, setStatus] = useState<AppStatus | null>(null);
  const [fatal, setFatal] = useState<string | null>(null);
  const [page, setPage] = useState<Page>("hoje");
  const [lockMessage, setLockMessage] = useState<string | null>(null);
  const [restoring, setRestoring] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const lastTouch = useRef(0);

  const refresh = useCallback(async () => {
    try {
      setStatus(await api.status());
    } catch (e) {
      setFatal((e as Error).message);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const un1 = listen("clara://bloqueada", () => {
      setLockMessage("Bloqueei a Clara por inatividade. Os dados estão fechados.");
      void refresh();
    });
    const un2 = listen("clara://backup", () => setRefreshKey((k) => k + 1));
    return () => {
      void un1.then((f) => f());
      void un2.then((f) => f());
    };
  }, [refresh]);

  // Atividade: avisa o lado Rust no máximo a cada 30 s.
  useEffect(() => {
    if (!status?.unlocked) return;
    const onActivity = () => {
      const now = Date.now();
      if (now - lastTouch.current > 30_000) {
        lastTouch.current = now;
        void api.touch();
      }
    };
    window.addEventListener("pointerdown", onActivity);
    window.addEventListener("keydown", onActivity);
    window.addEventListener("wheel", onActivity, { passive: true });
    return () => {
      window.removeEventListener("pointerdown", onActivity);
      window.removeEventListener("keydown", onActivity);
      window.removeEventListener("wheel", onActivity);
    };
  }, [status?.unlocked]);

  if (fatal) {
    return (
      <main className="start">
        <div className="start-panel">
          <Notice tone="error" title="A Clara não conseguiu arrancar">
            {fatal}
          </Notice>
        </div>
      </main>
    );
  }
  if (!status) return <main className="start" aria-busy="true" />;

  if (restoring) {
    return (
      <RestoreFlow
        onCancel={() => setRestoring(false)}
        onDone={() => {
          setRestoring(false);
          setLockMessage("Backup restaurado. Desbloqueia com a palavra-passe da altura da cópia.");
          void refresh();
        }}
      />
    );
  }

  if (!status.initialized) {
    return (
      <Welcome
        onDone={() => {
          setPage("hoje");
          void refresh();
        }}
      />
    );
  }

  if (!status.unlocked) {
    return (
      <Unlock
        message={lockMessage}
        onRestore={() => setRestoring(true)}
        onDone={() => {
          setLockMessage(null);
          void refresh();
        }}
      />
    );
  }

  const onLocked = (message: string) => {
    setLockMessage(message);
    void refresh();
  };

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <img src="/clara.svg" alt="" width={32} height={32} />
          <span>Clara</span>
        </div>
        <nav aria-label="Principal">
          {NAV.map((g) => (
            <div className="nav-group" key={g.group || "main"}>
              {g.group && <p className="nav-label">{g.group}</p>}
              <ul>
                {g.items.map((it) => (
                  <li key={it.id}>
                    <button
                      className={`nav-item ${page === it.id ? "active" : ""}`}
                      aria-current={page === it.id ? "page" : undefined}
                      onClick={() => setPage(it.id)}
                    >
                      {it.label}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
        <div className="sidebar-foot">
          <button
            className="btn btn-ghost full"
            onClick={async () => {
              await api.lock();
              onLocked("Clara bloqueada.");
            }}
          >
            Bloquear
          </button>
          <p className="muted small">Bloqueia sozinha após {status.lock_minutes} min sem atividade.</p>
        </div>
      </aside>
      <div className="content">
        {page === "hoje" && <Home go={setPage} refreshKey={refreshKey} />}
        <div hidden={page !== "imoveis"}><Properties /></div>
        {page === "resumo" && <Weekly />}
        {page === "destinos" && <Portals />}
        {page === "backups" && <Backups onLocked={onLocked} refreshKey={refreshKey} />}
        {page === "seguranca" && <Security status={status} onChanged={refresh} />}
        {page === "historico" && <History refreshKey={refreshKey} />}
      </div>
    </div>
  );
}
