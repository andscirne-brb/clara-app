import { useEffect, useState } from "react";
import { api, type BackupOverview, type Portal,type WorkOverview } from "../api";
import { Btn, Card, Notice } from "../components";
import { formatBytes, formatDateTime, formatToday, timeAgo } from "../format";
import type { Page } from "../App";

export function Home(props: { go: (p: Page) => void; openProperty:(ref:string)=>void;refreshKey: number }) {
  const[work,setWork]=useState<WorkOverview|null>(null),[workError,setWorkError]=useState(''),[q,setQ]=useState(''),[kind,setKind]=useState('prioritarios');
  const [ov, setOv] = useState<BackupOverview | null>(null);
  const [portals, setPortals] = useState<Portal[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  const load = () => {
    api.backupOverview().then(setOv).catch(() => setOv(null));
    api.portals().then(setPortals).catch(() => setPortals([]));
    api.workOverview().then(setWork).catch(e=>setWorkError(e.message));
  };
  useEffect(load, [props.refreshKey]);

  const monitored = portals.filter((p) => p.monitoring_enabled).length;
  const last = ov?.last_success;
  const attempt = ov?.last_attempt;
  const lastFailed = attempt && !attempt.ok && (!last || attempt.finished_at > last.finished_at);
  const pending=work?.properties.filter(p=>p.pending.length)??[];
  const queue=(work?.properties??[]).filter(p=>(kind!=='prioritarios'||/moradia|apartamento/i.test(p.nature))&&(kind!=='pendentes'||p.pending.length>0)&&[p.reference,p.nature,p.municipality,...p.pending].join(' ').toLocaleLowerCase('pt-PT').includes(q.toLocaleLowerCase('pt-PT'))).sort((a,b)=>Number(b.pending.length>0)-Number(a.pending.length>0));

  return (
    <div className="page">
      <header className="page-head">
        <p className="eyebrow">{formatToday()}</p>
        <h1>Hoje</h1>
      </header>
      {workError&&<Notice tone="error">{workError}</Notice>}
      <Card title="O teu trabalho"><div className="row-start"><Btn variant="primary" onPress={()=>props.go('trabalho')}>Registar trabalho realizado</Btn><Btn onPress={()=>props.go('resumo')}>Preparar resumo semanal</Btn>{work?.last_property_ref&&<Btn onPress={()=>props.openProperty(work.last_property_ref!)}>Continuar {work.last_property_ref}</Btn>}</div><p className="muted">{work?.file_name?`Levantamento: ${work.file_name}`:'Liga o mesmo Excel em Resumo semanal para mostrar a lista de trabalho.'}</p>{work?.file_error&&<Notice tone="warn">{work.file_error}</Notice>}{work&&<p>{pending.length} {pending.length===1?"imóvel com assuntos pendentes":"imóveis com assuntos pendentes"} · {work.entries.filter(e=>!e.written_at&&!e.cancelled_at).length} registos locais por gravar no Excel.</p>}</Card>
      {!!work?.properties.length&&<Card title="Próximos imóveis"><div className="two-cols"><label className="field"><span>Pesquisar imóvel, concelho ou assunto</span><input value={q} onChange={e=>setQ(e.target.value)}/></label><label className="field"><span>Mostrar</span><select value={kind} onChange={e=>setKind(e.target.value)}><option value="prioritarios">Moradias e apartamentos</option><option value="pendentes">Com assuntos pendentes</option><option value="todos">Todos os imóveis</option></select></label></div><p className="muted">{queue.length} {queue.length===1?"imóvel encontrado":"imóveis encontrados"}. Mostram-se os primeiros 8, com assuntos pendentes em primeiro lugar. Os estados vêm do levantamento e não são novas verificações.</p><div className="stack">{queue.slice(0,8).map(p=><div key={p.reference} className="card"><strong>{p.reference} · {p.nature}</strong><p className="muted">{p.municipality} · {p.state}</p>{p.pending.length?<p>{p.pending[0]}{p.pending.length>1?` Mais ${p.pending.length-1} assuntos no levantamento.`:''}</p>:<p>Consultar a ficha e identificar a próxima verificação.</p>}<Btn onPress={()=>props.openProperty(p.reference)}>Abrir imóvel</Btn></div>)}</div></Card>}

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

        <Card title="Imóveis e auditoria">
          <p className="muted">
            Importa os imóveis do EGO ou adiciona o primeiro manualmente. Acompanha cada publicação desde a auditoria até à verificação pública.
          </p>
          <div><Btn onPress={() => props.go("imoveis")}>Abrir imóveis</Btn></div>
        </Card>
      </div>
    </div>
  );
}
