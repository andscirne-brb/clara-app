/* Seguimento atual: plantas em JPEG e letra energética; anexos antigos são histórico. */
const PF_CLASSES=['A+','A','B','B-','C','D','E','F','G'];
const PF_ENERGIA=['Por verificar','Em falta',...PF_CLASSES,'N/A'];
function pfCampos_(){return ED_CAMPOS.filter(x=>['planta','energia'].includes(x[0]));}
function pfOpcoes_(campo){return campo[0]==='energia'?PF_ENERGIA:ED_ESTADOS;}
function pfEnergia_(valor){valor=String(valor||'').trim();return PF_ENERGIA.includes(valor)?valor:'Por verificar';}
function pfEnergiaPreenchida_(estado){return PF_CLASSES.includes(estado)||estado==='N/A';}
function pfDocumentoDispensado_(r){
 if(['Concluído','Não aplicável','Arquivado'].includes(r[8]))return false;
 if(r[2]!=='Documentos')return false;
 const assunto=String(r[3]||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
 return /^(caderneta predial(?: \(anexo\))?|certificado energetico(?: \(anexo\))?|contrato (?:de )?mediacao(?: \(anexo\))?|licenca (?:de )?habitacao(?: \(anexo\))?|documentos obrigatorios sem ficheiro no ego|documentos na categoria errada no ego)$/.test(assunto);
}
function pfResumo_(ref,pend){return pend.filter(r=>r[1]===ref&&!['Concluído','Não aplicável','Arquivado'].includes(r[8])).map(r=>(r[6]||'Por atribuir')+': '+r[3]+' — '+r[8]+'.').join('\n')||'Sem pendências abertas.';}
function pfFormulas_(row){
 const a='A'+row,n='N'+row,s='S'+row,e='AJ'+row,v='V'+row;
 const faltasDoc=estado=>'COUNTIF('+n+';"'+estado+'")';
 const docEstados=['Em falta','Digitalizado','No dossiê > digitalizar','Falta no eGO > ver dossiê','Falta no eGO + dossiê','Categoria errada','Formato errado'];
 const z='=IF('+a+'="";"";COUNTIF(D'+row+':L'+row+';"Em falta")+'+docEstados.map(faltasDoc).join('+')+'+COUNTIF('+s+';"Em falta")+COUNTIF('+e+';"Em falta"))';
 const ab='=IF('+a+'="";"";COUNTIF(D'+row+':L'+row+';"Por verificar")+COUNTBLANK(D'+row+':L'+row+')+COUNTIF('+n+';"Por verificar")+COUNTBLANK('+n+')+COUNTIF('+s+';"Por verificar")+COUNTBLANK('+s+')+COUNTIF('+e+';"Por verificar")+COUNTBLANK('+e+'))';
 const labels=['Imagens','Alt-text','Descrição PT','Descrição EN','Descrição FR','Descrição DE','Descrição ES','Características','Vídeo'];
 let aa='=IF('+a+'="";"";'+labels.map((label,i)=>'IF('+String.fromCharCode(68+i)+row+'="Em falta";"'+label+'; ";"")').join('&');
 aa+='&IF(OR('+docEstados.map(st=>n+'="'+st+'"').join(';')+');"Planta; ";"")&IF('+s+'="Em falta";"Folheto; ";"")&IF('+e+'="Em falta";"Classe energética; ";""))';
 const y='=IF('+a+'="";"";IF(AC'+row+'<>"";"Rever referência";IF(AB'+row+'=12;"Por iniciar";IF(AB'+row+'>0;"Em curso";IF(AND(K'+row+'="Em falta";U'+row+'="");"Detalhar campos";IF(AND(D'+row+'="Preenchido";OR(T'+row+'="";T'+row+'=0));"Contar imagens";IF(AND(COUNTIF(D'+row+':L'+row+';"N/A")+COUNTIF('+n+';"N/A")+COUNTIF('+s+';"N/A")+COUNTIF('+e+';"N/A")>0;'+v+'="");"Justificar N/A";IF(W'+row+'="";"Falta data";"Verificado"))))))))';
 return [y,z,aa,ab];
}
