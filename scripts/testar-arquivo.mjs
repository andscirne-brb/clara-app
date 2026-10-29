import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';const c={};vm.createContext(c);for(const f of ['Codigo.gs','EstadoDocumental.gs','ArquivarPendencias.gs','ResumoSemanal.gs'])vm.runInContext(fs.readFileSync(new URL('../apps-script/clara/'+f,import.meta.url),'utf8'),c);
for(const sep of [',',';']){
 const f='=COUNTIFS(PendenciasEquipe[Estado]'+sep+'"<>Não aplicável")',n=c.arFormula_(f);assert.match(n,/<>Arquivado/);assert.equal(c.arFormula_(n),n);
 const g='=IF(COUNTIFS(PendenciasEquipe[Referência EGO]'+sep+'A10'+sep+'PendenciasEquipe[Estado]'+sep+'"Concluído")+COUNTIFS(PendenciasEquipe[Referência EGO]'+sep+'A10'+sep+'PendenciasEquipe[Estado]'+sep+'"Não aplicável")=COUNTIFS(PendenciasEquipe[Referência EGO]'+sep+'A10)'+sep+'"Concluído"'+sep+'"Por tratar")';const out=c.arFormula_(g);assert.match(out,/"Arquivado"/);assert.match(out,/"Arquivado"[,;]"Concluído"/);assert.equal(c.arFormula_(out),out);
 const p='=IF(AND(I6="Não aplicável"'+sep+'L6="")'+sep+'"Justificar N/A"'+sep+'"")';assert.match(c.arFormula_(p),/Justificar arquivo/);
}
assert(c.edPendenciaSubstituida_(['','','','','','','','','Arquivado']));assert.equal(c.edEstadoCompativel_('Digitalizado'),'Digitalizado');const r=['P1','TESTE001','Vídeo','Existe vídeo do imóvel?','','Nota mantida','Sara','Normal','Arquivado'];assert.equal(c.gestaoPendencia_(r,7,'Andreia').estado,'Arquivado');assert.equal(c.gestaoPendencia_(r,7,'Andreia').aguarda,'');
console.log('PASS arquivo: fechado sem dispensa documental, fórmulas idempotentes, conferência de motivo e gestão preservada.');

assert.equal(c.arFormulaApi_('=IF(A1="texto; preservado";"Sim";"Não")'),'=IF(A1="texto; preservado","Sim","Não")');
assert.equal(c.arFormulaApi_('=COUNTIFS(A:A,"<>Arquivado")'),'=COUNTIFS(A:A,"<>Arquivado")');
console.log('PASS escrita de fórmulas: separadores normalizados sem alterar textos.');
