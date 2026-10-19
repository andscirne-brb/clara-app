import { useEffect, useState } from "react";
import { api, type CollectionData, type CollectionSnapshot, type CollectionSuggestion } from "../api";
import { Btn, Card, CheckLine, Field, Notice } from "../components";
import { formatDateTime } from "../format";
const languages = ["PT", "EN", "FR", "DE", "ES"];
const empty = (): CollectionData => ({ source: "eGO — consulta manual", contents: languages.map(language => ({ language, title: "", description: "", reviewed: false })), captures: [], selected_features: [], feature_list_reviewed: false, notes: "Visita virtual: não aplicável ao levantamento." });
function csvCell(value: string) { return `"${(/^[\s]*[=+@-]/.test(value) ? "'" + value : value).replaceAll('"', '""')}"`; }
export function Collection({ propertyId, reference }: { propertyId: string; reference: string }) {
 const [data, setData] = useState<CollectionData>(empty);
 const [versions, setVersions] = useState<CollectionSnapshot[]>([]);
 const [suggestions, setSuggestions] = useState<CollectionSuggestion[]>([]);
 const [busy, setBusy] = useState(false);
 const [loading, setLoading] = useState(true);
 const [error, setError] = useState("");
 const [message, setMessage] = useState("");
 const [language, setLanguage] = useState("PT");
 const [dirty, setDirty] = useState(false);
 useEffect(() => { let live = true; api.collectionList(propertyId).then(v => { if (live) { setVersions(v); setData(v[0]?.data ?? empty()); } }).catch(e => { if (live) setError(e.message); }).finally(() => { if (live) setLoading(false); }); return () => { live = false; }; }, [propertyId]);
 useEffect(() => { if (!dirty) return; const warn = (e: BeforeUnloadEvent) => e.preventDefault(); window.addEventListener("beforeunload", warn); return () => window.removeEventListener("beforeunload", warn); }, [dirty]);
 const edit = (next: CollectionData) => { setData(next); setDirty(true); setMessage(""); setSuggestions([]); };
 const run = async (fn: () => Promise<void>) => { setBusy(true); setError(""); try { await fn(); } catch (e) { setError((e as Error).message); } finally { setBusy(false); } };
 const current = data.contents.find(c => c.language === language)!;
 const content = (patch: Partial<typeof current>) => edit({ ...data, contents: data.contents.map(c => c.language === language ? { ...c, ...patch } : c) });
 const exportCsv = () => {
  const rows = [["Referência", "Origem", "Data da versão", "Idioma", "Título original", "Descrição original", "Texto revisto", "Observações"], ...data.contents.map(c => [reference, data.source, dirty ? "Rascunho não guardado" : versions[0]?.collected_at ?? "Rascunho", c.language, c.title, c.description, c.reviewed ? "Sim" : "Por verificar", data.notes]), [], ["Característica", "Frase de origem", "Resultado"], ...suggestions.map(s => [s.field, s.evidence, s.state])];
  const url = URL.createObjectURL(new Blob(["\ufeff" + rows.map(r => r.map(csvCell).join(";")).join("\r\n")], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a"); a.href = url; a.download = `Clara_${reference.replace(/[^\w-]/g, "_")}_recolha.csv`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
 };
 return <Card title="Recolha manual e textos originais">
  <p>Importa capturas feitas por ti ou cola o texto. A leitura é local, sem créditos de IA. Mantém as imagens originais numa pasta com a referência {reference}: a Clara guarda o nome e o texto extraído, não uma cópia da imagem.</p>
  {loading ? <p role="status">A abrir recolha…</p> : <div className="stack">
   {error && <Notice tone="error">{error}</Notice>}{message && <Notice tone="ok">{message}</Notice>}
   <Notice tone="info">O texto extraído pode conter erros, repetições e secções misturadas. Não identifica caixas assinaladas nem prova que um campo oculto esteja vazio. Confirma a referência e revê cada idioma antes de o usares.</Notice>
   <Field label="Origem da recolha (página / data consultada)" value={data.source} onChange={v => edit({ ...data, source: v })} />
   <div className="row-start"><Btn busy={busy} isDisabled={data.captures.length >= 30} onPress={() => void run(async () => { const capture = await api.collectionCapture(); if (capture) edit({ ...data, captures: [...data.captures, capture] }); })}>Ler uma captura</Btn><span className="muted">PNG/JPEG · até 30 MB · Windows</span></div>
   {data.captures.map((c, i) => <details key={`${i}:${c.name}`}><summary>{c.name} — texto para rever</summary><textarea aria-label={`Texto extraído de ${c.name}`} rows={10} value={c.text} readOnly /><Btn onPress={() => edit({ ...data, captures: data.captures.filter((_, j) => j !== i) })}>Retirar desta versão</Btn></details>)}
   <label className="field"><span>Idioma do texto original</span><select value={language} onChange={e => setLanguage(e.target.value)}>{languages.map(l => <option key={l}>{l}</option>)}</select></label>
   <Field label={`Título original ${language}`} value={current.title} onChange={v => content({ title: v, reviewed: false })} />
   <label className="field"><span>Descrição original {language}</span><textarea rows={8} maxLength={40000} value={current.description} onChange={e => content({ description: e.target.value, reviewed: false })} /></label>
   <CheckLine checked={current.reviewed} onChange={v => content({ reviewed: v })}>Conferi o título e a descrição {language} com a ficha, incluindo eventuais campos vazios.</CheckLine>
   <p className="muted">{data.contents.map(c => `${c.language}: ${c.reviewed ? "revisto" : "por verificar"}`).join(" · ")}</p>
   <label className="field"><span>Características assinaladas que confirmaste visualmente (uma por linha, com o nome do eGO)</span><textarea rows={5} value={data.selected_features.join("\n")} onChange={e => edit({ ...data, selected_features: e.target.value.split("\n") })} /></label>
   <CheckLine checked={data.feature_list_reviewed} onChange={v => edit({ ...data, feature_list_reviewed: v })}>Conferi a lista de características assinaladas deste imóvel.</CheckLine>
   <label className="field"><span>Observações e faltas de imagens, vídeo, planta, folheto ou documentos confirmadas na ficha</span><textarea rows={5} maxLength={20000} value={data.notes} onChange={e => edit({ ...data, notes: e.target.value })} /></label>
   <div className="row-start"><Btn busy={busy} onPress={() => void run(async () => { setSuggestions(await api.collectionSuggestions(data)); setMessage("Comparação concluída. As diferenças são propostas para confirmação; não alteram o eGO nem o levantamento."); })}>Comparar características com o texto PT</Btn><Btn variant="primary" busy={busy} onPress={() => void run(async () => { const version = await api.collectionSave(propertyId, data); setVersions([version, ...versions]); setDirty(false); setMessage("Nova versão guardada no cofre local. As anteriores foram preservadas."); })}>Guardar versão original</Btn><Btn onPress={exportCsv}>Exportar para Excel (CSV)</Btn></div>
   <p className="muted">{dirty ? "Alterações por guardar. Guarda antes de sair deste imóvel." : "Sem alterações por guardar."} A comparação inicial usa regras PT; os cinco idiomas ficam arquivados para trabalho posterior.</p>
   {suggestions.length > 0 && <div className="table-wrap"><table className="table"><thead><tr><th>Característica</th><th>Frase de origem</th><th>Revisão necessária</th></tr></thead><tbody>{suggestions.map(s => <tr key={s.field}><th>{s.field}</th><td>{s.evidence}</td><td>{s.state}</td></tr>)}</tbody></table></div>}
   {versions.length > 0 && <details><summary>{versions.length} versão(ões) original(is) guardada(s)</summary>{versions.map(v => <details key={v.id}><summary>{formatDateTime(v.collected_at)} · {v.data.source}</summary>{v.data.contents.map(c => <section key={c.language}><h3>{c.language} · {c.title || "Sem título registado"}</h3><p className="preserve-lines">{c.description || "Sem descrição registada"}</p><p>{c.reviewed ? "Texto revisto" : "Por verificar"}</p></section>)}</details>)}</details>}
  </div>}
 </Card>;
}
