/* Leitor restrito CFB/BIFF8: apenas células de dados, nunca macros ou fórmulas. */
function lerXLSIdealista(buffer){
 const b=new Uint8Array(buffer),v=new DataView(b.buffer,b.byteOffset,b.byteLength),fail=()=>{throw Error('Formato Excel não reconhecido com segurança.');};
 if(b.length<512||b.length>4000000||v.getUint32(0,true)!==0xe011cfd0||v.getUint32(4,true)!==0xe11ab1a1||v.getUint16(30,true)!==9)fail();
 const sector=n=>{if(n<0||(n+2)*512>b.length)fail();return b.subarray((n+1)*512,(n+2)*512);},fat=[];
 if(v.getInt32(68,true)!==-2)fail();
 for(let i=0;i<109;i++){const n=v.getInt32(76+i*4,true);if(n>=0){const q=new DataView(sector(n).buffer,sector(n).byteOffset,512);for(let j=0;j<128;j++)fat.push(q.getInt32(j*4,true));}}
 const chain=(start,table,read,max)=>{let n=start,out=[],seen=new Set();while(n!==-2){if(n<0||seen.has(n)||seen.size>max)fail();seen.add(n);out.push(read(n));n=table[n];}return Uint8Array.from(out.flatMap(x=>Array.from(x)));};
 const dirs=chain(v.getInt32(48,true),fat,sector,100),dv=new DataView(dirs.buffer),entries=[];
 for(let i=0;i+128<=dirs.length;i+=128){let name='';for(let j=0;j<dv.getUint16(i+64,true)-2;j+=2)name+=String.fromCharCode(dv.getUint16(i+j,true));entries.push({name,type:dirs[i+66],start:dv.getInt32(i+116,true),size:dv.getUint32(i+120,true)});}
 const book=entries.find(e=>/^(Workbook|Book)$/.test(e.name)),root=entries.find(e=>e.type===5);if(!book||book.size>4000000)fail();let raw;
 if(book.size<4096){if(!root)fail();const mini=chain(root.start,fat,sector,8000),mf=chain(v.getInt32(60,true),fat,sector,100),mv=new DataView(mf.buffer),mt=[];for(let i=0;i<mf.length;i+=4)mt.push(mv.getInt32(i,true));raw=chain(book.start,mt,n=>mini.subarray(n*64,n*64+64),1000);}
 else raw=chain(book.start,fat,sector,8000);
 raw=raw.subarray(0,book.size);const r=new DataView(raw.buffer,raw.byteOffset,raw.length),strings=[],cells=[],sheets=[];let sheet=-1;
 const rk=x=>{let n;if(x&2)n=x>>2;else{const z=new DataView(new ArrayBuffer(8));z.setUint32(4,x&0xfffffffc,true);n=z.getFloat64(0,true);}return x&1?n/100:n;};
 for(let pos=0;pos+4<=raw.length;){const t=r.getUint16(pos,true),len=r.getUint16(pos+2,true),a=pos+4,end=a+len;if(end>raw.length)fail();
 if(t===0x2f||t===0x3c)fail();
 if(t===0x85)sheets.push(r.getUint32(a,true));
 if(sheets.includes(pos))sheet++;
 if(t===0xfc){let j=a+8;const count=r.getUint32(a+4,true);if(count>20000)fail();for(let k=0;k<count;k++){if(j+3>end)fail();const n=r.getUint16(j,true),f=raw[j+2];j+=3;let runs=0,ext=0;if(f&8){runs=r.getUint16(j,true);j+=2;}if(f&4){ext=r.getUint32(j,true);j+=4;}let s='';if(j+n*((f&1)?2:1)+runs*4+ext>end)fail();for(let c=0;c<n;c++)s+=String.fromCharCode(f&1?r.getUint16(j+c*2,true):raw[j+c]);j+=n*((f&1)?2:1)+runs*4+ext;strings.push(s);}}
 if(sheet===0){const row=len>=6?r.getUint16(a,true):0,col=len>=6?r.getUint16(a+2,true):0;const put=(c,x)=>{if(row>2000||c>30)fail();(cells[row]||(cells[row]=[]))[c]=x;};
 if(t===0xfd){const x=strings[r.getUint32(a+6,true)];if(x===undefined)fail();put(col,x);}else if(t===0x203)put(col,r.getFloat64(a+6,true));else if(t===0x27e)put(col,rk(r.getInt32(a+6,true)));else if(t===0xbd){const last=r.getUint16(end-2,true);for(let c=col;c<=last;c++)put(c,rk(r.getInt32(a+6+(c-col)*6,true)));}else if(t===6)throw Error('O Excel contém fórmulas; não foi importado.');}
 pos=end;
 }
 if(!cells.length)fail();return cells;
}
function converterRankingExcelIdealista(rows,d){
 const headers=['COD. IDEALISTA','REFERÊNCIA INTERNA','VISITAS NAS LISTAS','VISITAS EM DETALHES','COMPARTILHADO','ENVIOS EM ALERTAS','FAVORITOS','CONTACTOS'];
 if(!rows[0]||headers.some((h,i)=>String(rows[0][i]||'').trim()!==h)||rows[0].length!==8)throw Error('As colunas do Excel Idealista mudaram.');
 const ids=new Set(),records=rows.slice(1).filter(r=>r&&r.some(x=>x!==''&&x!=null)).map((r,i)=>{const id=String(r[0]||''),ref=String(r[1]||'');if(!/^\d+$/.test(id)||ids.has(id)||ref.length>100||r.length!==8||r.slice(2).some(x=>!Number.isSafeInteger(x)||x<0))throw Error('Linha inválida ou repetida no Excel.');ids.add(id);return{id,ref,posicao:i+1,metricas:{visitasListas:r[2],visitasDetalhes:r[3],partilhas:r[4],alertas:r[5],favoritos:r[6],contactos:r[7]}};});
 if(!records.length||records.length>1000||!d.periodo.inicio||!d.periodo.fim)throw Error('Excel sem dados ou período confirmado.');
 for(const visible of d.registos){const x=records.find(r=>r.id===visible.id),m=visible.metricas;if(!x||['visitasListas','visitasDetalhes','partilhas','alertas','favoritos'].some(k=>m[k]!==x.metricas[k])||m.chamadas+m.mensagens!==x.metricas.contactos)throw Error('O Excel não coincide com o ranking aberto. Volta a recolher.');Object.assign(x.metricas,{chamadas:m.chamadas,mensagens:m.mensagens});}
 return Object.assign({},d,{registos:records,cobertura:'Ranking completo exportado para Excel: '+records.length+' imóveis; inclui todas as páginas. Contactos agregados; chamadas e mensagens apenas nas linhas conferidas na página.',fonte:'Excel oficial Idealista'});
}
async function recolherExcelIdealista(doc,d,ui){
 const link=Array.from(doc.querySelectorAll('a')).find(a=>/Exportar para Excel/i.test(a.textContent)&&a.getClientRects().length),form=link&&link.closest('form');if(!form)return d;
 ui.estado('A obter o Excel oficial do ranking completo…');
 const original=form.submit,own=Object.prototype.hasOwnProperty.call(form,'submit');let target;
 const capture=()=>{const url=new URL(form.getAttribute('action'),d.url);if(url.origin!==new URL(d.url).origin||!url.pathname.endsWith('/getXlsAdsRanking')||String(form.method).toLowerCase()!=='get')throw Error('Exportação Idealista não reconhecida.');for(const e of form.querySelectorAll('input[name]'))if(!e.disabled)url.searchParams.append(e.name,e.value);target=url;};
 try{form.submit=capture;link.click();}finally{if(own)form.submit=original;else delete form.submit;}
 if(!target)throw Error('Não consegui iniciar a exportação Excel. Não usei uma leitura parcial.');
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);try{const response=await fetch(target.href,{credentials:'same-origin',cache:'no-store',signal:controller.signal});if(!response.ok||new URL(response.url).origin!==target.origin)throw Error('A exportação Excel falhou. Confirma a sessão no Idealista.');const out=converterRankingExcelIdealista(lerXLSIdealista(await response.arrayBuffer()),d);const after=recolherIdealista(doc,{url:d.url,lido:d.lido});if(JSON.stringify(after)!==JSON.stringify(d))throw Error('O período ou ranking mudou durante a exportação.');return out;}finally{clearTimeout(timer);}
}
