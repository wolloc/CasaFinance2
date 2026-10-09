import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const home=await readFile(new URL('../../src/components/app/CasaHomeScreen.tsx',import.meta.url),'utf8');
const upcoming=await readFile(new URL('../../src/components/app/UpcomingFinancialEvents.tsx',import.meta.url),'utf8');
const settlements=await readFile(new URL('../../src/components/app/SettlementHub.tsx',import.meta.url),'utf8');

test('member perspective keeps the same Home vocabulary instead of becoming a second Home',()=>{
  for(const value of ['Como estamos?','Entre vocês','HomeFinancialMap','Olhando pra frente']) assert.match(home,new RegExp(value));
  for(const old of ['Meus recursos','Meus cartões','O que mais pesou pra mim','Posição entre nós']) assert.doesNotMatch(home,new RegExp(old));
  assert.doesNotMatch(home,/Perspectiva: <strong/);
  assert.doesNotMatch(home,/perspectiveLabel=/);
});

test('resource hierarchy lives in one unified map',async()=>{const map=await readFile(new URL('../../src/components/app/HomeFinancialMap.tsx',import.meta.url),'utf8');for(const value of ["label:'Contas'","label:'Dinheiro'","label:'Benefícios'","label:'Investimentos e reservas'"])assert.match(map,new RegExp(value));assert.match(map,/>Contas</);assert.match(map,/>Cartões</);assert.match(map,/Pessoas e acertos/);});

test('Home sections avoid permanent explanatory copy when the card itself communicates the meaning',()=>{
  assert.doesNotMatch(upcoming,/sem contar o mesmo compromisso duas vezes/);
  assert.doesNotMatch(settlements,/Veja a posição entre vocês e os valores a receber ou pagar/);
  assert.doesNotMatch(home,/Compra parcelada entra uma vez pelo valor da compra/);
  assert.doesNotMatch(home,/não aumentam o saldo atual nem são somadas como riqueza futura acumulada/);
});
