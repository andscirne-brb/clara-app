import { useEffect, useRef, useState, type ReactNode } from "react";
import { api, type Inventory, type PropertyInput, type Listing, type ListingInput, type Portal, type Audit, type AuditItem, type Issue, type ImportPreview } from "../api";
import { Btn, Card, CheckLine, Field, Notice } from "../components";
import { formatDateTime } from "../format";

const EMPTY: PropertyInput = { ego_ref: "", nature: "", municipality: "", availability: "", ego_modified: "" };
export const CHECKLIST = [
  ["identificacao", "Identificação e URL"], ["fotografias", "Fotografias"], ["alt", "Textos alternativos, se suportados"],
  ["descricao", "Descrição"], ["titulo", "Título"], ["video", "Vídeo, se aplicável"], ["planta", "Planta, se aplicável"],
  ["caracteristicas", "Características"], ["idiomas", "Idiomas aplicáveis"], ["consistencia", "Consistência EGO e portal"], ["publico", "Experiência pública"],
];
const stateLabel: Record<string, string> = { detetado: "Detetado", qa_pendente: "QA pendente", resolvido: "Resolvido", reaberto: "Reaberto" };
function Select({ label, value, onChange, children, disabled = false }: { label: string; value: string; onChange: (s: string) => void; children: ReactNode; disabled?: boolean }) {
  return <label className="field"><span>{label}</span><select value={value} onChange={e => onChange(e.target.value)} disabled={disabled}>{children}</select></label>;
}
function Memo({ label, value, onChange, required = false }: { label: string; value: string; onChange: (s: string) => void; required?: boolean }) {
  return <label className="field"><span>{label}</span><textarea value={value} onChange={e => onChange(e.target.value)} rows={3} required={required} maxLength={4000} /></label>;
}

export function Properties() {
  const [data, setData] = useState<Inventory>({ properties: [], listings: [], issues: [] });
  const [portals, setPortals] = useState<Portal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState("");
  const [archived, setArchived] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [newProperty, setNewProperty] = useState(false);
  const [input, setInput] = useState(EMPTY);
  const [importOpen, setImportOpen] = useState(false);
  const [listingForm, setListingForm] = useState<{ id: string | null; input: ListingInput } | null>(null);
  const [activeListing, setActiveListing] = useState<string | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const errorRef = useRef<HTMLDivElement>(null);
  const load = async () => { const [d, p] = await Promise.all([api.inventory(), api.portals()]); setData(d); setPortals(p); };
  useEffect(() => { load().catch(e => setError(e.message)).finally(() => setLoading(false)); }, []);
  useEffect(() => { if (error) errorRef.current?.focus(); }, [error]);
  const run = async (fn: () => Promise<void>) => {
    setBusy(true); setError(null); setMessage(null);
    try { await fn(); } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  };
  const property = data.properties.find(p => p.id === selected);
  const listings = data.listings.filter(l => l.property_id === selected);
  const term = q.trim().toLocaleLowerCase("pt-PT");
  const shown = data.properties.filter(p => p.archived === archived && ([p.ego_ref, p.nature, p.municipality, ...data.listings.filter(l => l.property_id === p.id).flatMap(l => [l.portal_ref, l.portal_name])].some(v => v.toLocaleLowerCase("pt-PT").includes(term))));
  const active = listings.find(l => l.id === activeListing);
  const openProperty = (id: string | null) => { setSelected(id); setActiveListing(null); setListingForm(null); setNewProperty(false); setError(null); setMessage(null); requestAnimationFrame(() => heading.current?.focus()); };
  return <div className="page inventory-page">
    <header className="page-head"><p className="eyebrow">Acompanhamento local</p><h1 ref={heading} tabIndex={-1}>{property ? property.ego_ref : "Imóveis"}</h1>
      <p className="lead">{property ? `${property.nature || "Natureza por indicar"} · ${property.municipality || "Concelho por indicar"} · ${property.availability || "Disponibilidade por confirmar"}` : "Começa com um imóvel ou importa a exportação do EGO. O EGO continua a ser a fonte oficial."}</p></header>
    {error && <div ref={errorRef} tabIndex={-1}><Notice tone="error">{error}</Notice></div>}
    {message && <Notice tone="ok">{message}</Notice>}
    {loading ? <p role="status">A carregar imóveis…</p> : property ? <>
      <div className="toolbar"><Btn onPress={() => openProperty(null)}>← Todos os imóveis</Btn><Btn busy={busy} onPress={() => void run(async () => { await api.propertyArchive(property.id, !property.archived); await load(); setMessage(property.archived ? "Imóvel reativado." : "Imóvel arquivado. As relações e o histórico foram preservados."); })}>{property.archived ? "Reativar imóvel" : "Arquivar imóvel"}</Btn></div>
      {property.archived && <Notice tone="info">Este imóvel está arquivado. As publicações e o histórico continuam disponíveis.</Notice>}
      <Card title="Publicações por destino" actions={<Btn onPress={() => { setListingForm({ id: null, input: { property_id: property.id, portal_id: portals.find(p => !listings.some(l => l.portal_id === p.id))?.id ?? "", portal_ref: "", url: "", visibility: "desconhecida", monitoring: true } }); setActiveListing(null); }} isDisabled={listings.length >= portals.length}>Adicionar publicação</Btn>}>
        {!listings.length ? <p className="muted">Ainda não há publicações. Adiciona o primeiro destino para começar a auditoria.</p> : <div className="listing-grid">{listings.map(l => {
          const open = data.issues.filter(i => i.listing_id === l.id && i.status !== "resolvido").length;
          return <button key={l.id} className={`listing-choice ${l.id === activeListing ? "selected" : ""}`} onClick={() => { setActiveListing(l.id); setListingForm(null); }}><strong>{l.portal_name}</strong><span className="mono">{l.portal_ref || "Referência por indicar"}</span><span className="muted">{l.visibility} · {open} pendência{open === 1 ? "" : "s"}</span></button>;
        })}</div>}
      </Card>
      {listingForm && <Card title={listingForm.id ? "Editar publicação" : "Nova publicação"}>
        <form className="stack" onSubmit={e => { e.preventDefault(); void run(async () => { const l = await api.listingSave(listingForm.id, listingForm.input); await load(); setActiveListing(l.id); setListingForm(null); setMessage("Publicação guardada."); }); }}>
          <Select label="Destino" value={listingForm.input.portal_id} disabled={!!listingForm.id} onChange={v => setListingForm({ ...listingForm, input: { ...listingForm.input, portal_id: v } })}>{portals.filter(p => p.id === listingForm.input.portal_id || !listings.some(l => l.portal_id === p.id)).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</Select>
          <div className="two-cols"><Field label="Referência neste portal" value={listingForm.input.portal_ref} onChange={v => setListingForm({ ...listingForm, input: { ...listingForm.input, portal_ref: v } })} /><Select label="Visibilidade observada" value={listingForm.input.visibility} onChange={v => setListingForm({ ...listingForm, input: { ...listingForm.input, visibility: v } })}>{["desconhecida", "ativa", "inativa", "retirada"].map(v => <option key={v} value={v}>{v}</option>)}</Select></div>
          <Field label="URL pública (https://)" value={listingForm.input.url} onChange={v => setListingForm({ ...listingForm, input: { ...listingForm.input, url: v } })} description="Pode ficar vazia enquanto não é conhecida. É obrigatória para o QA público." />
          <CheckLine checked={listingForm.input.monitoring} onChange={v => setListingForm({ ...listingForm, input: { ...listingForm.input, monitoring: v } })}>Acompanhar esta publicação</CheckLine>
          {listingForm.id && <Notice tone="info">Uma alteração à publicação exige nova revisão dos problemas já validados. O QA anterior fica no histórico.</Notice>}
          <div className="row-start"><Btn type="submit" variant="primary" busy={busy}>Guardar publicação</Btn><Btn onPress={() => setListingForm(null)}>Cancelar</Btn></div>
        </form>
      </Card>}
      {active && <ListingWorkspace key={`${active.id}:${active.revision}`} listing={active} issues={data.issues.filter(i => i.listing_id === active.id)} busy={busy} run={run} reload={load} onEdit={() => setListingForm({ id: active.id, input: active })} />}
      {property.original_description && <Card title="Descrição original do EGO"><p className="preserve-lines">{property.original_description}</p><p className="muted small">Fonte original importada por opção explícita. Não representa uma edição publicada.</p></Card>}
    </> : <>
      <div className="toolbar"><Btn variant="primary" onPress={() => { setNewProperty(true); setImportOpen(false); }}>Adicionar imóvel</Btn><Btn onPress={() => { setImportOpen(true); setNewProperty(false); }}>Importar do EGO</Btn></div>
      {newProperty && <Card title="Adicionar um imóvel"><form className="stack" onSubmit={e => { e.preventDefault(); void run(async () => { const p = await api.propertyCreate(input); await load(); setInput(EMPTY); openProperty(p.id); setMessage("Imóvel disponível. Se a referência já existia, foi aberto o registo existente."); }); }}>
        <Field label="Referência EGO" value={input.ego_ref} onChange={v => setInput({ ...input, ego_ref: v })} autoFocus description="Obrigatória. Preserva todos os zeros iniciais." />
        <div className="two-cols"><Field label="Natureza" value={input.nature} onChange={v => setInput({ ...input, nature: v })} /><Field label="Concelho" value={input.municipality} onChange={v => setInput({ ...input, municipality: v })} /></div>
        <Field label="Disponibilidade observada no EGO" value={input.availability} onChange={v => setInput({ ...input, availability: v })} /><div className="row-start"><Btn type="submit" variant="primary" busy={busy} isDisabled={!input.ego_ref.trim()}>Guardar imóvel</Btn><Btn onPress={() => setNewProperty(false)}>Cancelar</Btn></div>
      </form></Card>}
      {importOpen && <EgoImport onApplied={async () => { await load(); }} onClose={() => setImportOpen(false)} />}
      <div className="toolbar"><label className="search"><span className="visually-hidden">Pesquisar imóveis</span><input type="search" placeholder="Referência EGO, portal ou concelho" value={q} onChange={e => setQ(e.target.value)} /></label><CheckLine checked={archived} onChange={setArchived}>Mostrar arquivados</CheckLine><span className="muted small">{shown.length} imóvel{shown.length === 1 ? "" : "s"}</span></div>
      {!shown.length ? <Card title={q ? "Sem resultados" : archived ? "Sem imóveis arquivados" : "Começa pelo primeiro imóvel"}><p className="muted">{q ? "Experimenta a referência EGO ou uma referência associada a um portal." : "Podes acompanhar apenas os imóveis relevantes para o teu trabalho."}</p></Card> : <div className="table-wrap"><table className="table"><thead><tr><th>Referência EGO</th><th>Natureza</th><th>Concelho</th><th>Disponibilidade</th><th>Publicações</th></tr></thead><tbody>{shown.map(p => <tr key={p.id}><th scope="row"><button className="link mono" onClick={() => openProperty(p.id)}>{p.ego_ref}</button></th><td>{p.nature || "Por indicar"}</td><td>{p.municipality || "Por indicar"}</td><td>{p.availability || "Por confirmar"}</td><td>{data.listings.filter(l => l.property_id === p.id).length}</td></tr>)}</tbody></table></div>}
    </>}
  </div>;
}

function ListingWorkspace({ listing, issues, busy, run, reload, onEdit }: { listing: Listing; issues: Issue[]; busy: boolean; run: (fn: () => Promise<void>) => Promise<void>; reload: () => Promise<void>; onEdit: () => void }) {
  const [audits, setAudits] = useState<Audit[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [items, setItems] = useState<AuditItem[]>(CHECKLIST.map(([field]) => ({ field, state: "por_verificar", note: "" })));
  const [editingAudit, setEditingAudit] = useState(false);
  const [history, setHistory] = useState(false);
  const [draft, setDraft] = useState<AuditItem[] | null>(null);
  const [draftStatus, setDraftStatus] = useState("");
  const queue = useRef<Promise<void>>(Promise.resolve());
  const draftFailed = useRef(false);
  const updateItems = (next: AuditItem[]) => {
    setItems(next); setDraft(next); setDraftStatus("A guardar rascunho…");
    queue.current = queue.current.then(() => api.auditDraftSave(listing.id, next)).then(() => { draftFailed.current = false; setDraftStatus("Rascunho guardado na base cifrada."); }).catch(e => { draftFailed.current = true; setDraftStatus(""); setLoadError(`Rascunho por guardar: ${e.message}`); });
  };
  const load = async () => { const a = await api.audits(listing.id); setAudits(a); };
  useEffect(() => { load().catch(e => setLoadError(e.message)); api.auditDraft(listing.id).then(setDraft).catch(e => setLoadError(e.message)); }, [listing.id]);
  const latest = audits[0];
  const applicable = latest?.items.filter(i => i.state !== "nao_aplicavel").length ?? 0;
  const evaluated = latest?.items.filter(i => i.state === "conforme" || i.state === "nao_conforme").length ?? 0;
  const conforming = latest?.items.filter(i => i.state === "conforme").length ?? 0;
  return <>
    <Card title={listing.portal_name} actions={<Btn onPress={onEdit}>Editar publicação</Btn>}>
      <p className="path">{listing.url || "URL pública por indicar"}</p><p className="muted small">Referência {listing.portal_ref || "por indicar"} · versão {listing.revision} · monitorização {listing.monitoring ? "ligada" : "desligada"}</p>
      <Notice tone="info" title="Regras específicas do portal por confirmar">Checklist-base v1: boas práticas de revisão, sem mínimos de fotos, caracteres ou outros requisitos presumidos. Health Score: <strong>Não configurado</strong>.</Notice>
      {loadError && <Notice tone="error">{loadError}</Notice>}
      {latest && <><p>Completude observada: <strong>{evaluated ? `${conforming}/${evaluated}` : "N/D"}</strong> itens conformes entre os avaliados. Cobertura: <strong>{applicable ? `${evaluated}/${applicable}` : "N/D"}</strong>. Por verificar: <strong>{latest.items.filter(i => i.state === "por_verificar").length}</strong>.</p><p className="muted small">Última auditoria: {formatDateTime(latest.created_at)} · {latest.checklist_version} · publicação v{latest.listing_revision}{latest.listing_revision !== listing.revision ? " · anterior à versão atual" : ""}</p></>}
      {!editingAudit && <div className="row-start"><Btn variant="primary" onPress={() => { setItems(draft ?? (latest ? latest.items.map(i => ({ ...i })) : CHECKLIST.map(([field]) => ({ field, state: "por_verificar", note: "" })))); setEditingAudit(true); }}>{draft ? "Retomar rascunho" : "Nova auditoria"}</Btn>{audits.length > 0 && <Btn onPress={() => setHistory(!history)}>{history ? "Ocultar auditorias" : `Ver auditorias (${audits.length})`}</Btn>}</div>}
      {history && audits.map(a => <details key={a.id}><summary>{formatDateTime(a.created_at)} · {a.checklist_version} · publicação v{a.listing_revision}</summary><ul className="explain">{a.items.map(i => <li key={i.field}><strong>{CHECKLIST.find(([f]) => f === i.field)?.[1]}</strong>: {i.state.replaceAll("_", " ")}{i.note && ` · ${i.note}`}</li>)}</ul></details>)}
      {editingAudit && <form className="stack" onSubmit={e => { e.preventDefault(); void run(async () => { await queue.current; if (draftFailed.current) throw new Error("O rascunho não foi guardado. Tenta novamente antes de concluir."); await api.auditRecord(listing.id, items); setDraft(null); setDraftStatus(""); await Promise.all([load(), reload()]); setEditingAudit(false); }); }}>
        <p className="muted small">Cada auditoria concluída fica preservada. Alterações ao rascunho são guardadas localmente; confirma o estado antes de fechar.</p>
        <p className="small muted" role="status">{draftStatus}</p>
        {items.map((item, index) => <fieldset className="audit-item" key={item.field} disabled={busy}><legend>{CHECKLIST.find(([f]) => f === item.field)?.[1]}</legend><Select label="Resultado" value={item.state} onChange={state => updateItems(items.map((v, i) => i === index ? { ...v, state } : v))}><option value="por_verificar">Por verificar</option><option value="conforme">Conforme</option><option value="nao_conforme">Não conforme</option><option value="nao_aplicavel">Não aplicável</option></Select><Memo label={item.state === "nao_aplicavel" ? "Justificação obrigatória" : "Observação / fonte consultada"} value={item.note} required={item.state === "nao_aplicavel" || item.state === "nao_conforme"} onChange={note => updateItems(items.map((v, i) => i === index ? { ...v, note } : v))} /></fieldset>)}
        <div className="row-start"><Btn type="submit" variant="primary" busy={busy}>Concluir auditoria</Btn><Btn isDisabled={busy} onPress={() => setEditingAudit(false)}>Fechar rascunho</Btn></div>
      </form>}
    </Card>
    <Card title={`Problemas e QA (${issues.length})`}>{!issues.length ? <p className="muted">Os itens não conformes de uma auditoria geram problemas para acompanhar aqui.</p> : issues.map(issue => <IssueCard key={issue.id} issue={issue} listing={listing} busy={busy} run={run} reload={reload} />)}</Card>
  </>;
}

function IssueCard({ issue, listing, busy, run, reload }: { issue: Issue; listing: Listing; busy: boolean; run: (fn: () => Promise<void>) => Promise<void>; reload: () => Promise<void> }) {
  const [mode, setMode] = useState<"change" | "qa" | null>(null);
  const [location, setLocation] = useState("portal");
  const [fields, setFields] = useState(issue.title);
  const [reason, setReason] = useState("");
  const [url, setUrl] = useState(listing.url);
  const [result, setResult] = useState("nao_verificavel");
  const [note, setNote] = useState("");
  return <section className="issue-card"><div className="row-between"><h3>{issue.title}</h3><span className={`pill ${issue.status === "resolvido" ? "pill-ok" : "pill-warn"}`}>{stateLabel[issue.status] ?? issue.status}</span></div>
    {issue.change_reason && <p className="small">Última edição: {issue.change_reason}</p>}{issue.qa_note && <p className="small">Última verificação: {issue.qa_note}</p>}
    {!mode && <div className="row-start"><Btn onPress={() => setMode("change")}>Registar edição manual</Btn>{issue.change_id && <Btn onPress={() => { setUrl(listing.url); setMode("qa"); }}>Verificar no anúncio público</Btn>}</div>}
    {mode === "change" && <form className="stack" onSubmit={e => { e.preventDefault(); void run(async () => { await api.changeRecord(issue.id, location, fields, reason); await reload(); setReason(""); setMode(null); }); }}>
      <Notice tone="info">Confirma apenas uma edição que já fizeste manualmente. Este registo cria uma pendência de QA.</Notice>
      <Select label="Onde fizeste a edição?" value={location} onChange={setLocation}><option value="portal">Portal</option><option value="ego">EGO</option></Select><Field label="Campos e idiomas alterados" value={fields} onChange={setFields} /><Memo label="O que alteraste e porquê?" value={reason} onChange={setReason} required />
      <div className="row-start"><Btn type="submit" variant="primary" busy={busy}>Confirmar edição realizada agora</Btn><Btn onPress={() => setMode(null)}>Cancelar</Btn></div>
    </form>}
    {mode === "qa" && <form className="stack" onSubmit={e => { e.preventDefault(); void run(async () => { await api.qaRecord(issue.change_id!, result, url, note); await reload(); setNote(""); setMode(null); }); }}>
      <Notice tone="info">Abre o anúncio público no teu navegador e observa o resultado. Só a aprovação resolve este problema.</Notice>
      <Field label="URL pública observada" value={url} onChange={setUrl} /><Select label="Resultado da verificação" value={result} onChange={setResult}><option value="nao_verificavel">Não verificável, manter pendente</option><option value="aprovado">Aprovado</option><option value="falhou">Falhou, reabrir problema</option></Select><Memo label="Evidência observada ou motivo da impossibilidade" value={note} onChange={setNote} required />
      <div className="row-start"><Btn type="submit" variant="primary" busy={busy}>Registar verificação de agora</Btn><Btn onPress={() => setMode(null)}>Cancelar</Btn></div>
    </form>}
  </section>;
}

function EgoImport({ onApplied, onClose }: { onApplied: () => Promise<void>; onClose: () => void }) {
  const [picked, setPicked] = useState<{ file_name: string; sheets: string[] } | null>(null);
  const [sheet, setSheet] = useState("");
  const [includeDescription, setIncludeDescription] = useState(false);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const run = async (fn: () => Promise<void>) => { setBusy(true); setError(null); try { await fn(); } catch (e) { setError((e as Error).message); } finally { setBusy(false); } };
  const invalidate = () => { setPreview(null); setDone(null); setPage(0); };
  return <Card title="Importar imóveis do EGO">
    <p>Lê .xlsm, .xlsx ou CSV no teu PC. Não executa macros nem fórmulas. Os preços são ignorados. Imóveis ausentes do ficheiro mantêm-se na Clara.</p>
    {error && <Notice tone="error">{error}</Notice>}{done && <Notice tone="ok">{done}</Notice>}
    <div className="row-start"><Btn busy={busy} onPress={() => void run(async () => { invalidate(); const p = await api.egoPick(); setPicked(p); setSheet(p?.sheets[0] ?? ""); setIncludeDescription(false); })}>Escolher ficheiro</Btn><Btn isDisabled={busy} onPress={() => void run(async () => { await api.egoCancel(); onClose(); })}>Fechar importação</Btn></div>
    {picked && <><p className="path">{picked.file_name}</p><Select label="Folha a importar" value={sheet} disabled={busy} onChange={v => { setSheet(v); invalidate(); }}>{picked.sheets.map(s => <option key={s}>{s}</option>)}</Select>
      <CheckLine checked={includeDescription} disabled={busy} onChange={v => { setIncludeDescription(v); invalidate(); }}>Confirmo que tenho autorização para guardar a descrição original ao abrigo do NDA e quero incluí-la nesta importação.</CheckLine>
      <p className="muted small">Por defeito, a descrição não é guardada. Uma importação sem descrições preserva as que já existam na Clara.</p>
      <div><Btn busy={busy} isDisabled={!sheet} onPress={() => void run(async () => { invalidate(); setPreview(await api.egoPreview(sheet, includeDescription)); })}>Pré-visualizar sem gravar</Btn></div></>}
    {preview && <><Notice tone={preview.errors ? "warn" : "info"} title="Pré-visualização, ainda sem gravar">{preview.created} novos · {preview.updated} alterados · {preview.unchanged} iguais · {preview.errors} com erro.{preview.errors > 0 && " Corrige o ficheiro e volta a escolhê-lo. A importação fica bloqueada até todos os erros estarem resolvidos."}</Notice>
      <div className="table-wrap"><table className="table"><thead><tr><th>Linha</th><th>Referência EGO</th><th>Dados a importar</th><th>Resultado</th></tr></thead><tbody>{preview.rows.slice(page * 50, (page + 1) * 50).map(r => <tr key={r.row}><td>{r.row}</td><th scope="row" className="mono">{r.input.ego_ref || "Em falta"}</th><td>{r.input.nature}<span className="muted block">{r.input.municipality} · {r.input.availability}</span><span className="muted small block">Data EGO: {r.input.ego_modified || "Não indicada"}</span></td><td><strong>{r.status}</strong>{r.error && <span className="block">{r.error}</span>}{!!r.changes?.length && <details><summary>Ver alterações</summary><ul className="explain small">{r.changes.map((change, i) => <li key={i}>{change}</li>)}</ul></details>}</td></tr>)}</tbody></table></div>
      {preview.rows.length > 50 && <div className="row-between"><Btn isDisabled={!page} onPress={() => setPage(p => p - 1)}>Anterior</Btn><span>Página {page + 1} de {Math.ceil(preview.rows.length / 50)}</span><Btn isDisabled={(page + 1) * 50 >= preview.rows.length} onPress={() => setPage(p => p + 1)}>Seguinte</Btn></div>}
      <div><Btn variant="primary" busy={busy} isDisabled={preview.errors > 0} onPress={() => void run(async () => { const r = await api.egoApply(preview.token); setPreview(null); setPicked(null); setDone(`Importação concluída: ${r.created} novos, ${r.updated} alterados e ${r.unchanged} iguais. Nenhum imóvel foi apagado.`); await onApplied(); })}>Confirmar importação</Btn></div>
    </>}
  </Card>;
}
