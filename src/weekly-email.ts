import type {WeeklyReport} from './api';
const escape=(text:string)=>text.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const paragraphs=(text:string)=>text.split('\n\n').map(p=>`<p>${escape(p).replace(/\n/g,'<br>')}</p>`).join('');
const cell=(items:string[],empty:string)=>items.length?`<ul style="margin:0;padding-left:18px">${items.map(s=>`<li>${escape(s)}</li>`).join('')}</ul>`:escape(empty);
export function weeklyEmailHtml(report:WeeklyReport):string {
 if(!report.properties?.length)return paragraphs(report.body);
 const td='border:1px solid #aab5b9;padding:10px;vertical-align:top;text-align:left';
 return `<div style="font-family:Arial,sans-serif;font-size:14px;color:#24383f">${paragraphs(report.intro??'')}<table style="border-collapse:collapse;width:100%"><thead><tr>${['Imóvel','Trabalho realizado / verificação','Pendentes / análise da Sara'].map(s=>`<th style="${td};background:#edf1f2">${s}</th>`).join('')}</tr></thead><tbody>${report.properties.map(p=>`<tr><th scope="row" style="${td}">${escape(p.reference)}</th><td style="${td}">${cell(p.work,'Sem trabalho datado neste período.')}</td><td style="${td}">${cell(p.pending,'Sem pendências registadas.')}</td></tr>`).join('')}</tbody></table>${paragraphs(report.closing??'')}</div>`;
}
