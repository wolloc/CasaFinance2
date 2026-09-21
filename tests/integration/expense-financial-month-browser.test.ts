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

test('Gastos realizados combina metadados do fato com o read model econômico canônico',()=>{
 const economicQuery=service.slice(service.indexOf('export async function listEconomicMonthExpenses'));
 assert.match(economicQuery,/from\('transactions'\)/);
 assert.match(economicQuery,/gte\('transaction_date',monthStart\(month\)\)/);
 assert.match(economicQuery,/lt\('transaction_date',nextMonthStart\(month\)\)/);
 assert.match(economicQuery,/from\('financial_transaction_positions'\)/);
 assert.match(economicQuery,/household_economic_amount/);
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
 assert.match(browser,/setFinancialRows\(\[\]\);setEconomicRows\(\[\]\)/);
 assert.match(browser,/Nenhum valor antigo foi mantido na tela/);
 assert.match(browser,/setRefreshVersion\(value=>value\+1\)/);
 assert.doesNotMatch(browser,/\.rpc\(|\.insert\(|\.update\(|\.delete\(/);
});

test('Gastos realizados mostra somente realized e usa a parcela atribuída aos membros, não o bruto',()=>{
 const economicQuery=service.slice(service.indexOf('export async function listEconomicMonthExpenses'));
 assert.match(economicQuery,/\.eq\('economic_state','realized'\)/);
 assert.doesNotMatch(economicQuery,/\['confirmed','realized'\]/);
 assert.match(economicQuery,/positions\.get\(row\.id\)\?\?row\.amount/);
 assert.doesNotMatch(economicQuery,/economic_allocations\(amount,responsible_member_id,responsible_party_id\)/);
});

test('salvar uma nova despesa invalida a lente mensal sem remount destrutivo',()=>{
 assert.match(browser,/refreshKey=0/);
 assert.match(browser,/\[household\?\.id,month,mode,refreshKey,refreshVersion\]/);
 assert.match(screen,/<ExpenseMonthBrowser refreshKey=\{expenseListVersion\} \/>/);
 assert.match(screen,/setExpenseListVersion\(\(value\) => value \+ 1\)/);
});


test('Gastos traz visão consolidada do mês sem transformar categorias em orçamento',()=>{
 assert.match(browser,/Visão dos compromissos/);
 assert.match(browser,/Já realizado\/pago/);
 assert.match(browser,/Ainda comprometido/);
 assert.match(browser,/Gasto realizado no mês/);
 assert.match(browser,/Por categoria/);
 assert.match(browser,/participação no gasto/);
 assert.match(browser,/Não representa meta ou orçamento planejado/);
 assert.match(browser,/row\.category\?\.name\?\.trim\(\)\|\|'Sem categoria'/);
});


test('extrato mensal permite buscar sem alterar os totais consolidados do mês',()=>{
 assert.match(browser,/Buscar gastos deste mês/);
 assert.match(browser,/Buscar compromisso/);
 assert.match(browser,/Buscar compra ou categoria/);
 assert.match(browser,/filteredFinancialRows/);
 assert.match(browser,/filteredEconomicRows/);
 assert.match(browser,/O resumo acima continua mostrando o mês inteiro/);
 assert.match(browser,/Limpar busca/);
 assert.match(browser,/setQuery\(''\)/);
});
