import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const service=await readFile(new URL('../../src/finance/expenseMonthViews.ts',import.meta.url),'utf8');
const browser=await readFile(new URL('../../src/components/app/ExpenseMonthBrowser.tsx',import.meta.url),'utf8');

test('custom period keeps economic and financial clocks separate and canonical',()=>{
 const financial=service.slice(service.indexOf('export async function listFinancialPeriodExpenses'),service.indexOf('export async function listEconomicPeriodExpenses'));
 const economic=service.slice(service.indexOf('export async function listEconomicPeriodExpenses'));
 assert.match(financial,/from\('financial_commitment_positions'\)/);
 assert.match(financial,/gte\('financial_date',startDate\)/);
 assert.match(financial,/lte\('financial_date',endDate\)/);
 assert.doesNotMatch(financial,/transaction_date/);
 assert.match(economic,/from\('transactions'\)/);
 assert.match(economic,/gte\('transaction_date',startDate\)/);
 assert.match(economic,/lte\('transaction_date',endDate\)/);
});

test('Gastos period picker routes each lens to its matching period read',()=>{
 assert.match(browser,/customRange\?\(mode==='financial'\?listFinancialPeriodExpenses/);
 assert.match(browser,/listEconomicPeriodExpenses/);
 assert.match(browser,/Mês inteiro/);
 assert.match(browser,/Personalizado/);
 assert.match(browser,/Compromissos do período/);
 assert.match(browser,/data financeira canônica/);
 assert.match(browser,/data econômica do fato/);
});

test('period reads remain read-only and member responsibility stays canonical',()=>{
 const periodSource=service.slice(service.indexOf('export async function listFinancialPeriodExpenses'));
 assert.doesNotMatch(periodSource,/\.rpc\(|\.insert\(|\.update\(|\.delete\(/);
 assert.match(periodSource,/financial_member_commitment_responsibility_positions/);
 assert.match(periodSource,/economic_allocations/);
 assert.doesNotMatch(browser,/\.filter\([^\n]*financial_date/);
});


test('broad custom periods paginate base reads and batch metadata lookups',()=>{
 assert.match(service,/PERIOD_PAGE_SIZE=500/);
 assert.match(service,/\.range\(from,to\)/);
 assert.match(service,/chunkValues\(sourceTransactionIds\)/);
 assert.match(service,/chunkValues\(enrichedRows\.map\(row=>row\.commitment_key\)\)/);
 assert.match(service,/chunkValues\(transactions\.map\(row=>row\.id\)\)/);
});

test('incomplete custom dates cannot crash or query the Gastos surface',()=>{
 assert.match(browser,/validDate/);
 assert.match(browser,/customRangeReady/);
 assert.match(browser,/Escolha as datas/);
 assert.match(browser,/disabled=\{customRange&&!customRangeReady\}/);
 assert.match(browser,/if\(customRange&&!customRangeReady\)\{setFinancialRows\(\[\]\);setEconomicRows\(\[\]\)/);
});

test('allocation rows are paginated within each transaction batch',()=>{
 const economic=service.slice(service.indexOf('export async function listEconomicPeriodExpenses'));
 assert.match(economic,/collectPages<AllocationRow&\{amount:string\|number\}>/);
 assert.match(economic,/from\('economic_allocations'\)/);
 assert.match(economic,/\.order\('transaction_id',\{ascending:true\}\)/);
 assert.match(economic,/\.range\(from,to\)/);
});
