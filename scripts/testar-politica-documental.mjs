import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';
const c={};vm.createContext(c);vm.runInContext("const ED_CAMPOS=[['caderneta','legado','Caderneta'],['certificado','legado','Certificado'],['contrato','legado','Contrato'],['licenca','legado','Licença'],['planta','Planta','Planta'],['energia','Classe energética','Classe energética']];const ED_ESTADOS=['Por verificar','Digitalizado','Preenchido'];",c);
vm.runInContext(fs.readFileSync(new URL('../apps-script/clara/RegrasTrabalho.gs',import.meta.url),'utf8'),c);
const row=(theme,subject,state)=>['P0001','TESTE10001',theme,subject,'prova','ação','Equipa','Normal',state,'','','resposta','resolução','','','','','nota'];
for(const subject of ['Caderneta Predial','Certificado Energético','Contrato de Mediação','Licença de Habitação','Documentos obrigatórios sem ficheiro no eGO'])assert(c.pfDocumentoDispensado_(row('Documentos',subject,'Digitalizado')));
for(const r of [row('Plantas','Planta','Digitalizado'),row('Energia','Classe energética','Em falta'),row('Documentos','Outro assunto','Por tratar'),row('Documentos','Certificado Energético','Concluído'),row('Documentos','Caderneta Predial','Arquivado')])assert(!c.pfDocumentoDispensado_(r));
assert.equal(c.pfEnergia_('Preenchido'),'Por verificar');assert.equal(c.pfEnergia_('Digitalizado'),'Por verificar');
for(const grade of ['A+','A','B','B-','C','D','E','F','G']){assert.equal(c.pfEnergia_(grade),grade);assert(c.pfEnergiaPreenchida_(grade));}
assert(!c.pfEnergiaPreenchida_('Em falta'));assert(c.pfEnergiaPreenchida_('N/A'));
assert.deepEqual(JSON.parse(JSON.stringify(c.pfCampos_())).map(x=>x[0]),['planta','energia']);
for(const f of c.pfFormulas_(10)){assert(!/O10|P10|Q10|R10/.test(f));assert(f.includes('AJ10'));let depth=0,quoted=false;for(const ch of f){if(ch==='"')quoted=!quoted;else if(!quoted){if(ch==='(')depth++;if(ch===')')depth--;assert(depth>=0);}}assert.equal(depth,0);assert(!quoted);}
assert(c.pfFormulas_(10)[0].includes('AB10=12'));
const before=[row('Documentos','Caderneta Predial','Arquivado'),row('Plantas','Planta','Digitalizado')],copy=JSON.stringify(before),summary=c.pfResumo_('TESTE10001',before);assert(!summary.includes('Caderneta'));assert(summary.includes('Planta'));assert.equal(JSON.stringify(before),copy);
console.log('PASS regras: arquivo seletivo, estados energéticos explícitos, histórico preservado, fórmulas sem anexos antigos e sem mutação das respostas.');
