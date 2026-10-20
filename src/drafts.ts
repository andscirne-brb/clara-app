// Queue lives above individual screens so navigation cannot silently drop writes.
const queues=new Map<string,Promise<void>>();
const failures=new Map<string,string>();
export function queueDraft(key:string,save:()=>Promise<void>):Promise<void>{
 const next=(queues.get(key)??Promise.resolve()).catch(()=>{}).then(save);
 queues.set(key,next);
 next.then(()=>{if(queues.get(key)===next){queues.delete(key);failures.delete(key)}},e=>{if(queues.get(key)===next){queues.delete(key);failures.set(key,(e as Error).message)}});
 return next;
}
export async function flushDrafts(){while(queues.size)await Promise.all([...queues.values()]);if(failures.size)throw Error('Há um rascunho por guardar. Volta ao imóvel e tenta guardar novamente.');}
export function hasPendingDrafts(){return queues.size>0||failures.size>0;}
