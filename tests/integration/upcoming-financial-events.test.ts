import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const service=await readFile(new URL('../../src/finance/upcomingFinancialEvents.ts',import.meta.url),'utf8');
const component=await readFile(new URL('../../src/components/app/UpcomingFinancialEvents.tsx',import.meta.url),'utf8');
const home=await readFile(new URL('../../src/components/app/CasaHomeScreen.tsx',import.meta.url),'utf8');

test('próximos acontecimentos lê fontes canônicas e não cria fatos financeiros',()=>{
 for(const source of ['financial_commitment_positions','financial_true_income_positions','financial_card_invoice_positions','member_settlement_schedules'])assert.match(service,new RegExp(source));
 assert.doesNotMatch(service,/\.insert\(|\.update\(|\.delete\(|\.upsert\(|\.rpc\(/);
});

test('faturas materializadas substituem parcelas individuais no resumo próximo para evitar duplicidade',()=>{
 assert.match(service,/commitmentsByInvoice/);
 assert.match(service,/invoiceIds/);
 assert.match(service,/if\(invoiceIds\.has\(invoiceId\)\)continue/);
 assert.match(service,/kind:'invoice'/);
});

test('perspectiva individual usa responsabilidade e renda do próprio membro',()=>{
 assert.match(service,/financial_member_true_income_positions/);
 assert.match(service,/eq\('member_id',memberId\)/);
 assert.match(service,/financial_member_commitment_responsibility_positions/);
 assert.match(service,/remaining_responsibility_amount/);
});

test('Home mostra próximos sete dias como linha visual compacta e contextual',()=>{
 assert.match(home,/UpcomingFinancialEvents/);
 assert.match(component,/Próximos 7 dias/);
 assert.match(component,/Hoje/);
 assert.match(component,/Amanhã/);
 assert.match(component,/Ver fatura/);
 assert.match(component,/sem contar o mesmo compromisso duas vezes/);
});
