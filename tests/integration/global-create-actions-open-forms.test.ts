import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const app=await readFile(new URL('../../src/components/app/CasaFinanceApp.tsx',import.meta.url),'utf8');
const screen=await readFile(new URL('../../src/components/app/TransactionsScreen.tsx',import.meta.url),'utf8');
const wizard=await readFile(new URL('../../src/components/app/NewExpenseWizard.tsx',import.meta.url),'utf8');
const income=await readFile(new URL('../../src/components/app/IncomeLedgerScreen.tsx',import.meta.url),'utf8');

test('Nova despesa gera nova intenção e abre diretamente a jornada guiada',()=>{
 assert.match(app,/setExpenseCreateRequestId\(value=>value\+1\);setScreen\('expenses'\)/);
 assert.match(app,/TransactionsScreen mode="expense" createRequestId=\{expenseCreateRequestId\}/);
 assert.match(screen,/<NewExpenseWizard openRequestId=\{createRequestId\}/);
 assert.match(wizard,/openRequestId <= 0 \|\| openRequestId === handledRequestId/);
 assert.match(wizard,/setOpen\(true\)/);
 assert.doesNotMatch(screen,/setShowNature|chooseExpense|chooseLoan/);
});

test('Nova despesa segue duas etapas e não expõe horário de pagamento',()=>{
 assert.match(wizard,/O que aconteceu\?/);
 assert.match(wizard,/Sobre o valor/);
 assert.match(wizard,/Etapa \{step\} de 2/);
 assert.match(wizard,/Quem fez esse gasto\?/);
 assert.match(wizard,/Com o que gastou\?/);
 assert.match(wizard,/Quem assume esse gasto\?/);
 assert.match(wizard,/Como foi pago\?/);
 assert.doesNotMatch(wizard,/datetime-local|Quando o dinheiro saiu\?/);
});

test('Nova entrada leva ao fluxo canônico de entradas',()=>{
 assert.match(app,/onIncome=\{\(\)=>setScreen\('income'\)\}/);
 assert.match(screen,/mode === 'income'\) return <IncomeLedgerScreen/);
 assert.match(income,/<IncomeCreationAction onCreated=\{refresh\}\/>/);
});
