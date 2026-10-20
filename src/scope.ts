const obsoleteNotes=new Set(['Visita virtual: não aplicável em todos os imóveis, por decisão da responsável pelo levantamento.','Visita virtual: não aplicável ao levantamento.']);
export function cleanScopeNotes(notes:string):string{return notes.split('\n').filter(line=>!obsoleteNotes.has(line.trim())).join('\n').trim();}
