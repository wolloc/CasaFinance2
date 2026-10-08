import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const service=await readFile(new URL('../../src/finance/expenseMonthViews.ts',import.meta.url),'utf8');
const browser=await readFile(new URL('../../src/components/app/ExpenseMonthBrowser.tsx',import.meta.url),'utf8');
const screen=await readFile(new URL('../../src/components/app/TransactionsScreen.tsx',import.meta.url),'utf8');
const period=await readFile(new URL('../../src/components/app/FinancialPeriodNavigator.tsx',import.meta.url),'utf8');
const search=await readFile(new URL('../../src/components/app/FinancialListSearch.tsx',import.meta.url),'utf8');
const categories=await readFile(new URL('../../src/components/app/FinancialCategoryBreakdown.tsx',import.meta.url),'utf8');

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
 assert.doesNotMatch(browser,/Parceladas aparecem uma vez/);
});

test('Gastos prioriza o navegador mensal e leva histórico/correções para o lançamento',()=>{
 const month=screen.indexOf('<ExpenseMonthBrowser');
 const contextualDetail=screen.indexOf('focusTransactionId={detailTransactionId}');
 assert.ok(month>=0,'financial month browser must be present');
 assert.ok(contextualDetail>month,'transaction detail must be contextual to the monthly list');
 assert.match(browser,/Compromissos do mês/);
 assert.doesNotMatch(browser,/Item da fatura; o pagamento não vira outro gasto/);
 assert.doesNotMatch(browser,/border-orange-500/);
 assert.doesNotMatch(browser,/Gasto recorrente/);
 assert.doesNotMatch(browser,/Ainda compromete \{money\(row\.remaining_amount\)\}/);
 assert.match(browser,/bg-violet-500\/15 font-semibold text-violet-200/);
 assert.match(browser,/FinancialPeriodNavigator/);
 assert.match(period,/Mês anterior/);
 assert.match(period,/Mês seguinte/);
 assert.match(browser,/pickerTitle="Escolher período"/);
 assert.match(screen,/Detalhe do gasto/);
 assert.match(screen,/focusTransactionId=\{detailTransactionId\}/);
 assert.doesNotMatch(screen,/Precisa fazer algo diferente\?/);
});

test('falha de leitura mensal limpa linhas e exige retry sem mutação',()=>{
 assert.match(browser,/setFinancialRows\(\[\]\);setEconomicRows\(\[\]\)/);
 assert.match(browser,/Nenhum valor antigo foi mantido na tela/);
 assert.match(browser,/setRefreshVersion\(value=>value\+1\)/);
 assert.doesNotMatch(browser,/\.rpc\(|\.insert\(|\.update\(|\.delete\(/);
});

test('perspectiva individual preserva responsabilidade e valor original do gasto',()=>{
 const economicQuery=service.slice(service.indexOf('export async function listEconomicMonthExpenses'));
 assert.match(economicQuery,/\.eq\('economic_state','realized'\)/);
 assert.match(economicQuery,/from\('financial_transaction_positions'\)/);
 assert.match(economicQuery,/from\('economic_allocations'\)/);
 assert.match(economicQuery,/memberAmounts\.get\(row\.id\)/);
 assert.match(economicQuery,/original_amount:String\(row\.amount\)/);
 assert.match(economicQuery,/household_amount:String\(householdAmount\)/);
 assert.match(browser,/selectedMember\?'Sua parte'/);
 assert.match(browser,/valor original \{money\(original\)\}/);
 assert.match(service,/original_amount:row\.source_transaction_id/);
});

test('listas de Gastos carregam categoria visual e responsabilidade sem inferir comprador',()=>{
 assert.match(service,/categories\(name,type,icon,color\)/);
 assert.match(service,/responsible_member_id,responsible_party_id/);
 assert.match(browser,/getCategoryVisual/);
 assert.match(browser,/Dividido/);
 assert.match(browser,/Com outra pessoa/);
 assert.match(service,/financial_member_commitment_responsibility_positions/);
 assert.match(service,/memberAmounts\.get\(row\.id\)/);
});

test('salvar uma nova despesa invalida a lente mensal sem perder a perspectiva global',()=>{
 assert.match(browser,/refreshKey=0/);
 assert.match(browser,/\[household\?\.id,month,customRange,customRangeReady,rangeStart,rangeEnd,mode,perspective,refreshKey,refreshVersion\]/);
 assert.match(screen,/onOpenTransaction=\{\(transactionId,recurringRuleId\)=>\{setDetailTransactionId\(transactionId\);setDetailRecurringRuleId\(recurringRuleId\?\?null\)/);
 assert.match(screen,/setExpenseListVersion\(\(value\) => value \+ 1\)/);
});

test('Gastos mantém total da visão compacto e categorias sob demanda sem virar orçamento',()=>{
 assert.match(browser,/FinancialListSummaryCard tone="expense"/);
 assert.doesNotMatch(browser,/\{money\(realized\)\}<\/span> realizado/);
 assert.doesNotMatch(browser,/\{money\(remaining\)\}<\/span> comprometido/);
 assert.match(browser,/FinancialCategoryBreakdown/);
 assert.match(categories,/Ver categorias/);
 assert.match(categories,/<details/);
 assert.match(browser,/footer="Leitura dos gastos realizados; não é meta ou orçamento\."/);
 assert.match(browser,/row\.category\?\.name\?\.trim\(\)\|\|'Sem categoria'/);
 assert.match(browser,/FinancialMonthSummary[\s\S]*categories=\{financialSummary\.categories\}/);
 assert.match(browser,/function FinancialMonthSummary\(\{total,count,categories\}/);
 assert.match(browser,/count===1\?'lançamento':'lançamentos'/);
});

test('busca de Gastos usa apenas valores textuais definidos e não referencia helper inexistente',()=>{
 assert.doesNotMatch(browser,/sourceLabel\(row\)/);
 assert.match(browser,/row\.instrument_label\?\?instrumentLabel\(row\.instrument_kind\)\?\?''/);
});

test('extrato mensal permite buscar descrição categoria ou pessoa sem recalcular motor financeiro',()=>{
 assert.match(browser,/Buscar gastos deste período/);
 assert.match(browser,/Buscar compromisso/);
 assert.match(browser,/Buscar compra, categoria ou pessoa/);
 assert.match(browser,/filteredFinancialRows/);
 assert.match(browser,/filteredEconomicRows/);
 assert.match(browser,/responsibilityLabel/);
 assert.match(browser,/FinancialListSearch/);
 assert.match(search,/Limpar busca/);
 assert.match(browser,/setQuery\(''\)/);
});

test('perspectiva de morador usa responsabilidade econômica e mantém comprador como conceito separado',()=>{
 assert.match(browser,/FinancialPerspectiveSelector/);
 assert.match(service,/financial_member_commitment_responsibility_positions/);
 assert.match(service,/responsible_member_id/);
 assert.match(browser,/selectedMember/);
 assert.match(service,/financial_member_commitment_responsibility_positions/);
 assert.match(service,/memberAmounts\.get\(row\.id\)/);
});


test('Gastos usa lista de página inteira e leva a recorrência para o detalhe do lançamento',()=>{
 assert.match(browser,/return <section className="text-slate-100">/);
 assert.doesNotMatch(browser,/return <section className="rounded-2xl border border-slate-800 bg-slate-900\/60 p-4/);
 assert.match(service,/from\('recurring_occurrences'\)/);
 assert.match(service,/recurring_rule_id/);
 assert.match(screen,/<RecurringExpenseManagement focusRuleId=\{detailRecurringRuleId\}/);
 assert.match(screen,/focusRuleId=\{detailRecurringRuleId\}/);
 assert.doesNotMatch(screen,/>Recorrências<span/);
});
