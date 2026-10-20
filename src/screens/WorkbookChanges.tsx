import{useState}from'react';
import{api,type WorkbookReview,type WorkbookChange}from'../api';
import{Btn,Card,Notice}from'../components';
import{formatDateTime}from'../format';
export function WorkbookChanges({prepare}:{prepare:(reference:string,changes:WorkbookChange[])=>void}){
 const[review,setReview]=useState<WorkbookReview|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
 const run=async(fn:()=>Promise<void>)=>{setBusy(true);setError('');setMessage('');try{await fn()}catch(e){setError((e as Error).message)}finally{setBusy(false)}};
 const groups=new Map<string,WorkbookChange[]>();review?.changes.forEach(c=>groups.set(c.reference,[...(groups.get(c.reference)??[]),c]));
 return <Card title="Alterações detetadas no Excel"><p>A Clara compara os campos de registo da folha Levantamento pela referência do imóvel. Guarda o Excel e aguarda a sincronização antes de comparar. Não consulta o eGO nem usa IA.</p><p className="muted">Nesta fase, textos por idioma, pendências, indicadores e outras folhas não são comparados. Campos calculados e o histórico de alterações também ficam fora desta comparação.</p>
 {error&&<Notice tone="error">{error}</Notice>}{message&&<Notice tone="ok">{message}</Notice>}
 <Btn busy={busy} onPress={()=>void run(async()=>{setReview(await api.workbookChangesPreview())})}>Comparar levantamento guardado</Btn>
 {review&&<div className="stack"><p>Ficheiro: <strong>{review.file_name}</strong></p>{review.first_read?<Notice tone="info">Primeira leitura: guarda este ponto de partida. As alterações anteriores não podem ser reconstruídas automaticamente.</Notice>:<><p className="muted">Comparação com a leitura de {formatDateTime(review.baseline_at!)}. A data da leitura não é a data em que o trabalho foi realizado.</p><Notice tone="info">Uma alteração no Excel não confirma uma correção no eGO. Podes preparar um registo por imóvel com os valores já preenchidos e confirmar o trabalho no formulário.</Notice><p>{review.changes.length} campos alterados · {review.added.length} referências acrescentadas · {review.removed.length} referências retiradas.</p>
 {[...groups].map(([ref,changes])=><div className="card" key={ref}><h3>{ref}</h3>{changes.map(c=><div key={c.field}><strong>{c.field}</strong><p style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>Antes: {c.before||'(vazio)'}<br/>Agora: {c.after||'(vazio)'}</p></div>)}<Btn busy={busy} onPress={()=>prepare(ref,changes)}>Preparar registo deste imóvel</Btn></div>)}
 {review.added.length>0&&<p style={{overflowWrap:'anywhere'}}>Referências acrescentadas: {review.added.join(', ')}. A inclusão no levantamento não prova criação no eGO.</p>}{review.removed.length>0&&<p style={{overflowWrap:'anywhere'}}>Referências retiradas: {review.removed.join(', ')}. A ausência no levantamento não prova remoção no eGO.</p>}</>}
 <p className="muted">Confirmar preserva esta comparação no histórico do cofre e passa a usar esta leitura nas próximas comparações. Não escreve no Excel nem cria trabalhos realizados.</p><Btn busy={busy} variant="primary" onPress={()=>void run(async()=>{await api.workbookChangesAccept(review.token);setReview(null);setMessage('Leitura guardada no cofre. As próximas comparações partirão desta versão.')})}>{review.first_read?'Guardar ponto de partida':'Confirmar revisão e guardar esta leitura'}</Btn></div>}
 </Card>
}
