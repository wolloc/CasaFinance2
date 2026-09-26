import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const app=await readFile(new URL('../../src/components/app/CasaFinanceApp.tsx',import.meta.url),'utf8');
const home=await readFile(new URL('../../src/components/app/CasaHomeScreen.tsx',import.meta.url),'utf8');
const expenses=await readFile(new URL('../../src/components/app/ExpenseMonthBrowser.tsx',import.meta.url),'utf8');
const expenseService=await readFile(new URL('../../src/finance/expenseMonthViews.ts',import.meta.url),'utf8');
const income=await readFile(new URL('../../src/components/app/IncomeLedgerScreen.tsx',import.meta.url),'utf8');
const invoices=await readFile(new URL('../../src/components/app/InvoicesScreen.tsx',import.meta.url),'utf8');
const resources=await readFile(new URL('../../src/finance/memberResources.ts',import.meta.url),'utf8');

test('perspectiva financeira nasce no app e permanece entre Casa Gastos Entradas e Faturas',()=>{
 assert.match(app,/const\[perspective,setPerspective\]=useState<FinancialPerspective>\('household'\)/);
 for(const screen of ['CasaHomeScreen','TransactionsScreen mode="expense"','TransactionsScreen mode="income"','InvoicesScreen'])assert.match(app,new RegExp(screen));
 assert.match(app,/perspective=\{perspective\}/);
 assert.match(app,/onPerspectiveChange=\{setPerspective\}/);
});

test('perspectiva de gastos usa responsabilidade econômica e nunca comprador como atalho',()=>{
 assert.match(expenses,/responsibilityLabel/);
 assert.match(expenseService,/financial_member_commitment_responsibility_positions/);
 assert.match(expenseService,/economic_allocations/);
 assert.match(expenseService,/responsible_member_id/);
 assert.match(expenses,/Sua parte · valor original/);
 assert.doesNotMatch(expenseService,/buyer_member_id.*memberId|memberId.*buyer_member_id/s);
});

test('perspectiva de entradas usa beneficiário canônico',()=>{
 assert.match(income,/beneficiary_member_id/);
 assert.match(income,/beneficiariesByTransaction/);
 assert.match(income,/beneficiaries\.get\(row\.id\)\?\.includes\(perspective\)/);
 assert.match(income,/memberIds\.includes\(member\.id\)/);
 assert.doesNotMatch(income,/buyer_member_id/);
});

test('perspectiva de cartões mostra responsabilidade sem ratear limite do instrumento',()=>{
 assert.match(invoices,/member_responsibility_exposure/);
 assert.match(invoices,/Sua parte agora/);
 assert.match(invoices,/Sua parte futura/);
 assert.match(invoices,/O total da fatura continua sendo do cartão/);
 assert.doesNotMatch(invoices,/credit_limit\s*\/\s*2|available_limit\s*\/\s*2/);
});

test('recursos individuais usam alocação canônica de titularidade',()=>{
 assert.match(resources,/financial_account_member_allocations/);
 assert.match(resources,/allocation_ratio/);
 assert.match(home,/Meus recursos/);
 assert.match(home,/Sua parte/);
 assert.match(home,/attributed_amount/);
 assert.doesNotMatch(resources,/\/\s*2/);
});
