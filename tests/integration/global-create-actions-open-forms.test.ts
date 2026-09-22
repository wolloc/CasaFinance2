import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const app=await readFile(new URL('../../src/components/app/CasaFinanceApp.tsx',import.meta.url),'utf8');
const screen=await readFile(new URL('../../src/components/app/TransactionsScreen.tsx',import.meta.url),'utf8');
const wizard=await readFile(new URL('../../src/components/app/NewExpenseWizard.tsx',import.meta.url),'utf8');
const income=await readFile(new URL('../../src/components/app/IncomeLedgerScreen.tsx',import.meta.url),'utf8');

test('Nova despesa gera nova intenção e abre diretamente a jornada guiada',()=>{
 assert.match(app,/setExpenseCreateRequestId\(value=>value\+1\);setScreen\('expenses'\)/);
 assert.match(app,/TransactionsScreen mode="expense" perspective=\{perspective\} onPerspectiveChange=\{setPerspective\} createRequestId=\{expenseCreateRequestId\}/);
 assert.match(screen,/<NewExpenseWizard openRequestId=\{createRequestId\}/);
 assert.match(wizard,/openRequestId <= 0 \|\| openRequestId === handledRequestId/);
 assert.match(wizard,/setOpen\(true\)/);
 assert.doesNotMatch(screen,/setShowNature|chooseExpense|chooseLoan/);
});

test('Nova despesa preserva duas etapas sem expor textos de bastidor nem horário de pagamento',()=>{
 assert.doesNotMatch(wizard,/O que aconteceu\?/);
 assert.doesNotMatch(wizard,/Sobre o valor/);
 assert.doesNotMatch(wizard,/Etapa \{step\} de 2/);
 assert.match(wizard,/Quem fez esse gasto\?/);
 assert.match(wizard,/Com o que gastou\?/);
 assert.match(wizard,/Quem assume esse gasto\?/);
 assert.match(wizard,/Como foi pago\?/);
 assert.match(wizard,/type="date" max=\{today\}/);
 assert.match(wizard,/if \(date > today\) return setDate\(today\)/);
 assert.doesNotMatch(wizard,/Quem originou o gasto\. Isso não define/);
 assert.doesNotMatch(wizard,/Terceiro como responsável econômico, divisão personalizada e recorrência/);
 assert.doesNotMatch(wizard,/datetime-local|Quando o dinheiro saiu\?/);
});

test('Nova entrada abre captura contextual sem transformar a aba Entradas em formulário',()=>{
 assert.match(app,/setIncomeCreateRequestId\(value=>value\+1\);setScreen\('income'\)/);
 assert.match(app,/TransactionsScreen mode="income" perspective=\{perspective\} onPerspectiveChange=\{setPerspective\} createRequestId=\{incomeCreateRequestId\}/);
 assert.match(screen,/mode === 'income'\) return <ScreenErrorBoundary screenName="suas entradas"><IncomeLedgerScreen/);
 assert.match(screen,/createRequestId=\{createRequestId\}/);
 assert.match(income,/<IncomeCreationAction onCreated=\{refresh\} openRequestId=\{createRequestId\}\/>/);
});
