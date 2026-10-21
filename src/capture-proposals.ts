import type {CaptureAudit} from './api';
export interface CaptureProposal {field:string;language:string;value:string;source:string;evidence:string;partial:boolean}
export interface CaptureAnalysis {proposals:CaptureProposal[];warnings:string[]}
export type AutoValues=Record<string,{value:string;partial:boolean}>;
export const visibleCaptureText=(text:string)=>text.split('\n').filter(l=>!l.startsWith('\u001eCLARA_DOCS_V1 ')).join('\n');
export const proposalKey=(p:CaptureProposal)=>`${p.field}:${p.language}`;
export function proposedValue(data:CaptureAudit,p:CaptureProposal):string {
 if(p.field==='description'||p.field==='title')return data.contents.find(c=>c.language===p.language)?.[p.field]??'';
 if(p.field==='selected_features')return data.selected_features.join('\n');
 return data.states[p.field]??'';
}
export function applyProposal(data:CaptureAudit,p:CaptureProposal):CaptureAudit {
 if(p.field==='description'||p.field==='title')return {...data,contents:data.contents.map(c=>c.language===p.language?{...c,[p.field]:p.value,reviewed:false}:c)};
 if(p.field==='selected_features')return {...data,selected_features:[...new Set([...data.selected_features,...p.value.split('\n')].filter(Boolean))],feature_list_reviewed:false};
 if((['D','E','K','L','N','O','P','Q','R','S'].includes(p.field)&&p.value==='Preenchido')||(['O','P','Q','R'].includes(p.field)&&p.value==='Em falta'))return {...data,states:{...data.states,[p.field]:p.value}};
 return data;
}
export function fillProposals(data:CaptureAudit,analysis:CaptureAnalysis,previous:AutoValues={}) {
 let next=data,filled=0;const auto={...previous};
 const groups=new Map<string,CaptureProposal[]>();for(const p of analysis.proposals)groups.set(proposalKey(p),[...(groups.get(proposalKey(p))??[]),p]);
 for(const [key,list]of groups){
  const complete=list.filter(p=>!p.partial),preferred=(list[0]?.field==='description'||list[0]?.field==='title')&&complete.length?complete:list;
  let p=preferred[0];if(!p)continue;
  if(p.field==='selected_features')p={...p,value:[...new Set(list.flatMap(v=>v.value.split('\n')).filter(Boolean))].join('\n'),partial:true};
  else if(new Set(preferred.map(v=>v.value.trim().toLocaleLowerCase())).size!==1)continue;
  const old=proposedValue(next,p);
  const confirmed=(p.field==='description'||p.field==='title')?next.contents.find(c=>c.language===p.language)?.reviewed:p.field==='selected_features'?next.feature_list_reviewed:false;
  const upgrade=previous[key]?.value===old&&previous[key]?.partial&&!p.partial;
  const extendFeatures=p.field==='selected_features'&&previous[key]?.value===old;
  if(confirmed||old.trim()&&!(upgrade||extendFeatures)||old===p.value)continue;
  const updated=applyProposal(next,p);if(updated!==next){next=updated;filled++;auto[key]={value:proposedValue(next,p),partial:p.partial};}
 }
 return {data:next,filled,auto};
}
