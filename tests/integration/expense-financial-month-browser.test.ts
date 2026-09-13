import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const service=await readFile(new URL('../../src/finance/expenseMonthViews.ts',import.meta.url),'utf8');
const browser=await readFile(new URL('../../src/components/app/ExpenseMonthBrowser.tsx',import.meta.url),'utf8');
const screen=await readFile(new URL('../../src/components/app/TransactionsScreen.tsx',import.meta.url),'utf8');

test('mês financeiro usa o read model canônico de compromissos e não a data da compra',()=>{
 assert.match(service,/from\('financial_commitment_positions'\)/);
 assert.match(service,/eq\('economic_type','expense'\)/);
 assert.match(service,/eq\('financial_month',monthStart\(month\)\)/);
 assert.match(service,/source_installment_id/);
 assert.doesNotMatch(service,/insert\(|update\(|delete\(|\.rpc\(/);
});

test('visão avançada pela compra lê o fato econômico original sem reescrever nada',()=>{
 assert.match(service,/from\('transactions'\)/);
 assert.match(service,/gte\('transaction_date',monthStart\(month\)\)/);
 assert.match(service,/lt\('transaction_date',nextMonthStart\(month\)\)/);
 assert.match(browser,/Gastos realizados/);
 assert.match(browser,/Compras parceladas aparecem uma vez/);
});

test('Gastos prioriza o navegador mensal e explica que parcela não é nova despesa',()=>{
 const month=screen.indexOf('<ExpenseMonthBrowser');
 const operational=screen.indexOf('<HouseholdTransactionsSetup');
 assert.ok(month>=0,'financial month browser must be present');
 assert.ok(operational>month,'financial month must appear before operational history');
 assert.match(browser,/Compromissos do mês/);
 assert.match(browser,/Item da fatura; o pagamento não vira outro gasto/);
 assert.match(browser,/border-orange-500/);
 assert.match(screen,/Histórico e correções/);
});

test('falha de leitura mensal limpa linhas e exige retry sem mutação',()=>{
 assert.match(browser,/setFinancialRows\(\[\]\);setEconomicRows\(\[\]\);setError\(true\)/);
 assert.match(browser,/Nenhum valor antigo foi mantido na tela/);
 assert.match(browser,/setRefreshVersion\(value=>value\+1\)/);
 assert.doesNotMatch(browser,/\.rpc\(|\.insert\(|\.update\(|\.delete\(/);
});
