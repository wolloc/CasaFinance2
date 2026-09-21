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
 assert.match(income,/const \[transactions,movement,memberMovements\]=await Promise\.all/);
});


test('Dashboard preserves available canonical sections instead of failing all reads together',()=>{
 const dashboard=fs.readFileSync('src/finance/financialDashboard.ts','utf8');
 assert.match(dashboard,/FinancialDashboardAvailability/);
 assert.match(dashboard,/resources:!accountBalances\.error/);
 assert.match(dashboard,/if\(!Object\.values\(availability\)\.some\(Boolean\)\)/);
 assert.doesNotMatch(dashboard,/for\(const response of\[household,members,health,confidence,attention,projection,cards,settlements,accountBalances,guidance\]\)if\(response\.error\)throw response\.error/);
});

test('Home never turns an unavailable dashboard section into an apparent financial zero',()=>{
 assert.match(home,/Algumas análises não puderam ser confirmadas agora/);
 assert.match(home,/Saldo atual[\s\S]*Não confirmado/);
 assert.match(home,/Não foi possível confirmar os saldos dos recursos da Casa/);
 assert.match(home,/Não foi possível confirmar a projeção deste mês/);
 assert.doesNotMatch(home,/health\?\.current_cash\?\?resources\.availableCash/);
});


test('Home explains the financial equation and separates liquidity from patrimony',()=>{
 assert.match(home,/Quanto do dinheiro de agora já tem destino/);
 assert.match(home,/Já tem destino/);
 assert.match(home,/Livre depois deles/);
 assert.match(home,/Fluxo deste mês/);
 assert.match(home,/Onde está nosso dinheiro/);
 assert.match(home,/Disponibilidade e patrimônio continuam separados/);
 assert.match(home,/Recursos financeiros acompanhados/);
});
