import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';

const home=fs.readFileSync('src/components/app/CasaHomeScreen.tsx','utf8');
const income=fs.readFileSync('src/components/app/IncomeLedgerScreen.tsx','utf8');

test('Home does not discard canonical dashboard reads when recurrence maintenance fails',()=>{
 assert.match(home,/try\{await ensureRecurringExpenseHorizon/);
 assert.match(home,/catch\(error\)\{console\.warn\('Casa Finance: não foi possível atualizar o horizonte de despesas recorrentes/);
 assert.match(home,/const nextDashboard=await getFinancialDashboard/);
});

test('Income ledger still reads canonical income facts when recurrence maintenance fails',()=>{
 assert.match(income,/try\{await ensureRecurringIncomeHorizon/);
 assert.match(income,/catch\(error\)\{console\.warn\('Casa Finance: não foi possível atualizar o horizonte de rendas recorrentes/);
 assert.match(income,/const \[transactions,movement\]=await Promise\.all/);
});
