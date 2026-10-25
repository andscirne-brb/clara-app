import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';
const c={URL,AbortController,setTimeout,clearTimeout};vm.createContext(c);vm.runInContext(fs.readFileSync(new URL('../apps-script/clara/idealista-excel.js',import.meta.url),'utf8'),c);
const headers=['COD. IDEALISTA','REFERÊNCIA INTERNA','VISITAS NAS LISTAS','VISITAS EM DETALHES','COMPARTILHADO','ENVIOS EM ALERTAS','FAVORITOS','CONTACTOS'];
const rows=[headers,['101','TESTE-001',10,5,0,2,1,3],['102','TESTE-002',8,4,1,0,1,2]];
const d={tipo:'ranking',url:'https://www.idealista.pt/webtool/stats/loadImpactStats',periodo:{inicio:'2026-10-01',fim:'2026-10-30'},registos:[{id:'101',metricas:{visitasListas:10,visitasDetalhes:5,partilhas:0,alertas:2,favoritos:1,chamadas:1,mensagens:2}}]};
let out=c.converterRankingExcelIdealista(rows,d);assert.equal(out.registos.length,2);assert.equal(out.registos[0].metricas.chamadas,1);assert.equal(out.registos[1].metricas.chamadas,undefined);assert.equal(out.registos[1].metricas.contactos,2);
for(const mutate of [r=>r[0][0]='Outra',r=>r[2][0]='101',r=>r[1][7]=4,r=>r[2][3]=-1,r=>r[2][2]='8']){const copy=structuredClone(rows);mutate(copy);assert.throws(()=>c.converterRankingExcelIdealista(copy,d));}
assert.throws(()=>c.converterRankingExcelIdealista(rows,{...d,periodo:{}}));
/* Fixture BIFF8 sintética: fluxo normal CFB, SST, LABELSST, NUMBER, RK e MULRK. */
const rec=(id,data)=>{const h=Buffer.alloc(4);h.writeUInt16LE(id);h.writeUInt16LE(data.length,2);return Buffer.concat([h,data]);};
const u32=x=>{const b=Buffer.alloc(4);b.writeUInt32LE(x);return b;};
const bof=rec(0x809,Buffer.alloc(16)),bound=rec(0x85,Buffer.alloc(8));
const ss=Buffer.concat([u32(1),u32(1),Buffer.from([5,0,0]),Buffer.from('TESTE')]);const sst=rec(0xfc,ss),eof=rec(10,Buffer.alloc(0));
const ls=Buffer.alloc(10);ls.writeUInt32LE(0,6);const number=Buffer.alloc(14);number.writeUInt16LE(1,2);number.writeDoubleLE(42,6);
const rk=Buffer.alloc(10);rk.writeUInt16LE(2,2);rk.writeInt32LE((7<<2)|2,6);
const mul=Buffer.alloc(18);mul.writeUInt16LE(3,2);mul.writeInt32LE((8<<2)|2,6);mul.writeInt32LE((9<<2)|2,12);mul.writeUInt16LE(4,16);
const global=Buffer.concat([bof,bound,sst,eof]);bound.writeUInt32LE(global.length,4);const globals=Buffer.concat([bof,bound,sst,eof]);
const stream=Buffer.concat([globals,bof,rec(0xfd,ls),rec(0x203,number),rec(0x27e,rk),rec(0xbd,mul),eof]);
const fixture=Buffer.alloc(512*11);fixture.writeUInt32LE(0xe011cfd0);fixture.writeUInt32LE(0xe11ab1a1,4);fixture.writeUInt16LE(9,30);fixture.writeInt32LE(1,48);fixture.writeInt32LE(-2,60);fixture.writeInt32LE(-2,68);for(let i=0;i<109;i++)fixture.writeInt32LE(i? -1:0,76+i*4);
for(let i=0;i<128;i++)fixture.writeInt32LE(-1,512+i*4);fixture.writeInt32LE(-3,512);fixture.writeInt32LE(-2,516);for(let i=2;i<10;i++)fixture.writeInt32LE(i===9?-2:i+1,512+i*4);
Buffer.from('Workbook\0','utf16le').copy(fixture,1024);fixture.writeUInt16LE(18,1088);fixture[1090]=2;fixture.writeInt32LE(2,1140);fixture.writeUInt32LE(4096,1144);stream.copy(fixture,1536);
const parsed=c.lerXLSIdealista(fixture.buffer.slice(fixture.byteOffset,fixture.byteOffset+fixture.length));assert.deepEqual(Array.from(parsed[0]),['TESTE',42,7,8,9]);
assert.throws(()=>c.lerXLSIdealista(new ArrayBuffer(512)));const cycle=Buffer.from(fixture);cycle.writeInt32LE(2,520);assert.throws(()=>c.lerXLSIdealista(cycle.buffer.slice(cycle.byteOffset,cycle.byteOffset+cycle.length)));
/* O formulário oficial preenche os parâmetros ao clicar; restaurar submit mesmo em erro. */
let request,restored;const form={method:'get',getAttribute:()=> 'getXlsAdsRanking',querySelectorAll:()=>[{name:'fromDate',value:'01/10/2026'}]},original=()=>{};form.submit=original;
const link={textContent:'Exportar para Excel',getClientRects:()=>[1],closest:()=>form,click:()=>form.submit()};const doc={querySelectorAll:()=>[link]};
c.fetch=async url=>{request=url;restored=form.submit===original;return{ok:true,url,arrayBuffer:async()=>fixture.buffer.slice(fixture.byteOffset,fixture.byteOffset+fixture.length)}};
await assert.rejects(()=>c.recolherExcelIdealista(doc,d,{estado:()=>{}}));assert.equal(restored,true);assert.match(request,/getXlsAdsRanking\?fromDate=01%2F10%2F2026/);assert.equal(form.submit,original);
assert.equal(await c.recolherExcelIdealista({querySelectorAll:()=>[]},d,{estado:()=>{}}),d);
console.log('Idealista Excel: dados, CFB/BIFF8, coerência, agregados e restauro conferidos.');
