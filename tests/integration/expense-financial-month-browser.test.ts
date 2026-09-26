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
 assert.match(browser,/Parceladas aparecem uma vez/);
});

test('Gastos prioriza o navegador mensal e leva histórico/correções para o lançamento',()=>{
 const month=screen.indexOf('<ExpenseMonthBrowser');
 const contextualDetail=screen.indexOf('focusTransactionId={detailTransactionId}');
 assert.ok(month>=0,'financial month browser must be present');
 assert.ok(contextualDetail>month,'transaction detail must be contextual to the monthly list');
 assert.match(browser,/Compromissos do mês/);
 assert.match(browser,/Item da fatura; o pagamento não vira outro gasto/);
 assert.match(browser,/border-orange-500/);
 assert.match(browser,/Mês anterior/);
 assert.match(browser,/Mês seguinte/);
 assert.match(browser,/Escolher mês/);
 assert.match(screen,/Detalhe do gasto/);
 assert.match(screen,/Histórico, correções e ações especiais ficam ligados a este lançamento/);
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
 assert.match(browser,/Sua parte · total da compra/);
 assert.match(browser,/compra \{money\(original\)\}/);
});

test('listas de Gastos carregam categoria visual e responsabilidade sem inferir comprador',()=>{
 assert.match(service,/categories\(name,type,icon,color\)/);
 assert.match(service,/responsible_member_id,responsible_party_id/);
 assert.match(browser,/getCategoryVisual/);
 assert.match(browser,/Dividido/);
 assert.match(browser,/Com outra pessoa/);
 assert.doesNotMatch(service,/buyer_member_id.*memberId|memberId.*buyer_member_id/s);
});

test('salvar uma nova despesa invalida a lente mensal sem perder a perspectiva global',()=>{
 assert.match(browser,/refreshKey=0/);
 assert.match(browser,/\[household\?\.id,month,mode,perspective,refreshKey,refreshVersion\]/);
 assert.match(screen,/<ExpenseMonthBrowser perspective=\{perspective\} onPerspectiveChange=\{onPerspectiveChange\} refreshKey=\{expenseListVersion\} onOpenTransaction=\{\(transactionId\)=>\{setDetailTransactionId\(transactionId\);setDetailActionsOpen\(false\)\}\} \/>/);
 assert.match(screen,/setExpenseListVersion\(\(value\) => value \+ 1\)/);
});

test('Gastos mantém total da visão compacto e categorias sob demanda sem virar orçamento',()=>{
 assert.match(browser,/Total da visão/);
 assert.match(browser,/realizado/);
 assert.match(browser,/comprometido/);
 assert.match(browser,/Ver categorias/);
 assert.match(browser,/<details/);
 assert.match(browser,/não é meta ou orçamento/);
 assert.match(browser,/row\.category\?\.name\?\.trim\(\)\|\|'Sem categoria'/);
});

test('extrato mensal permite buscar descrição categoria ou pessoa sem recalcular motor financeiro',()=>{
 assert.match(browser,/Buscar gastos deste mês/);
 assert.match(browser,/Buscar compromisso/);
 assert.match(browser,/Buscar compra, categoria ou pessoa/);
 assert.match(browser,/filteredFinancialRows/);
 assert.match(browser,/filteredEconomicRows/);
 assert.match(browser,/responsibilityLabel/);
 assert.match(browser,/Limpar busca/);
 assert.match(browser,/setQuery\(''\)/);
});

test('perspectiva de morador usa responsabilidade econômica e mantém comprador como conceito separado',()=>{
 assert.match(browser,/FinancialPerspectiveSelector/);
 assert.match(service,/financial_member_commitment_responsibility_positions/);
 assert.match(service,/responsible_member_id/);
 assert.match(browser,/selectedMember/);
 assert.doesNotMatch(service,/buyer_member_id.*memberId|memberId.*buyer_member_id/s);
});
