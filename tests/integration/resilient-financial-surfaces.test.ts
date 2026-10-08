import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';

const home=fs.readFileSync('src/components/app/CasaHomeScreen.tsx','utf8');
const statement=fs.readFileSync('src/components/app/MonthlyPositionStatement.tsx','utf8');
const map=fs.readFileSync('src/components/app/HomeFinancialMap.tsx','utf8');
const income=fs.readFileSync('src/components/app/IncomeLedgerScreen.tsx','utf8');

test('Home does not discard canonical dashboard reads when recurrence maintenance fails',()=>{
 assert.match(home,/try\{await ensureRecurringExpenseHorizon/);
 assert.match(home,/catch\(error\)\{console\.warn\('Casa Finance: não foi possível atualizar o horizonte de despesas recorrentes/);
 assert.match(home,/const nextDashboard=await getFinancialDashboard/);
});

test('Income ledger still reads canonical income facts when recurrence maintenance fails',()=>{
 assert.match(income,/try\{await ensureRecurringIncomeHorizon/);
 assert.match(income,/catch\(loadError\)\{console\.warn\('Casa Finance: não foi possível atualizar o horizonte de rendas recorrentes/);
 assert.match(income,/const\[transactions,movement\]=await Promise\.all/);
 assert.match(income,/from\('money_movements'\).*beneficiary_member_id/);
});

test('Dashboard preserves available canonical sections instead of failing all reads together',()=>{
 const dashboard=fs.readFileSync('src/finance/financialDashboard.ts','utf8');
 assert.match(dashboard,/FinancialDashboardAvailability/);
 assert.match(dashboard,/resources:!accountBalances\.error/);
 assert.match(dashboard,/if\(!Object\.values\(availability\)\.some\(Boolean\)/);
 assert.doesNotMatch(dashboard,/for\(const response of\[household,members,health,confidence,attention,projection,cards,settlements,accountBalances,guidance\]\)if\(response\.error\)throw response\.error/);
});

test('Home never turns an unavailable dashboard section into an apparent financial zero',()=>{
 assert.match(home,/Alguns dados não atualizaram agora/);
 assert.match(home,/unavailableLabels/);
 assert.match(home,/currentAvailable=\{currentCash\}/);
 assert.match(statement,/pode terminar o mês com/);
 assert.match(statement,/subjectLabel/);
 assert.match(home,/Não foi possível confirmar os saldos dos recursos da Casa/);
 assert.match(home,/Ainda não há resumo financeiro confirmado para este mês/);
 assert.doesNotMatch(home,/health\?\.current_cash\?\?resources\.availableCash/);
});

test('Home consolida a posição mensal e mantém classes de recursos distintas',()=>{
 assert.match(home,/MonthlyPositionStatement/);
 assert.match(statement,/Estamos tranquilos neste mês/);
 assert.match(statement,/pode terminar este mês com/);
 assert.match(statement,/Ainda entra/);
 assert.match(statement,/Ainda sai/);
 assert.match(statement,/O efetivo mostra o que já aconteceu\\. A projeção mostra o que ainda está previsto/);
 assert.match(map,/Onde está nosso dinheiro/);
 assert.match(map,/>Contas</);
 assert.match(map,/>Cartões</);
 assert.match(map,/Pessoas e acertos/);
 for(const value of ["label:'Contas'","label:'Dinheiro'","label:'Benefícios'","label:'Investimentos e reservas'"]) assert.match(map,new RegExp(value));
 assert.doesNotMatch(map,/label:'Dinheiro reservado'/);
});
