import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createContext, runInContext } from 'node:vm';

const contexto = createContext({ URL });
runInContext(readFileSync(new URL('../Clara-extensao-0.5.2/carteira-ego.js', import.meta.url), 'utf8'), contexto);
const { lerPaginaCarteiraEgo, lerTotalDisponiveisEgo, percorrerCarteiraEgo } = contexto;
const lista = 'https://admin.egorealestate.com/egocore/realestates';
const doc = {
  querySelectorAll: () => [
    '/egocore/realestate/1',
    '/egocore/realestate/1?origem=lista',
    '/egocore/realestate/2/edit',
    'https://example.com/egocore/realestate/3'
  ].map(href => ({ getAttribute: () => href }))
};
assert.equal(lerPaginaCarteiraEgo(doc, lista).length, 1);
assert.equal(lerTotalDisponiveisEgo('553 Imóveis', 'Disponível, atualizados recentemente.'), 553);
assert.throws(() => lerTotalDisponiveisEgo('553 Imóveis', 'Em Prospecção'));
const primeira = { chave: '1', total: 3, fichas: [{id:'1'}, {id:'2'}], proxima: '2' };
const ultima = { chave: '2', total: 3, fichas: [{id:'2'}, {id:'3'}], fim: true };
assert.equal((await percorrerCarteiraEgo(cursor => cursor ? ultima : primeira)).length, 3);
await assert.rejects(percorrerCarteiraEgo(() => primeira), /repetiu/);
await assert.rejects(percorrerCarteiraEgo(cursor => cursor ? {...ultima, fichas: []} : primeira), /2 de 3/);
await assert.rejects(percorrerCarteiraEgo(cursor => cursor ? {...ultima, total: 4} : primeira), /total/);
console.log('Sete verificações da carteira eGO passaram.');
