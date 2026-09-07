import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const service=await readFile(new URL('../../src/finance/cardOverview.ts',import.meta.url),'utf8');
const screen=await readFile(new URL('../../src/components/app/InvoicesScreen.tsx',import.meta.url),'utf8');

test('visão de cartão usa modelos canônicos de exposição saúde e responsabilidade',()=>{
 assert.match(service,/financial_card_health_positions/);
 assert.match(service,/financial_member_card_positions/);
 assert.match(service,/member_responsibility_exposure/);
 assert.doesNotMatch(service,/\.rpc\(/);
});

test('cartão mostra limite exposição futuro disponível saúde e responsabilidade sem duplicar despesa',()=>{
 for(const text of ['Limite contratado','Fatura atual','Depois desta fatura','Total comprometido','Limite disponível','De quem são os gastos que compõem esse valor?'])assert.ok(screen.includes(text));
 assert.match(screen,/healthLabel/);
 assert.match(screen,/member_responsibilities/);
});

test('limite continua separado da capacidade de caixa',()=>{
 assert.match(screen,/Limite é crédito; não é dinheiro disponível da Casa/);
 assert.match(screen,/o Casa não transforma limite em caixa/);
 assert.doesNotMatch(screen,/available_limit.*projected|projected.*available_limit/s);
});

test('falha na releitura limpa cartões e faturas antes de retry',()=>{
 assert.match(screen,/\.catch\(\(\)=>\{setRows\(\[\]\);setCards\(\[\]\);setError\(true\);\}\)/);
 assert.match(screen,/Tentar novamente/);
});
