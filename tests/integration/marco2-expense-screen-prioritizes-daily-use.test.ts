import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source=await readFile(new URL('../../src/components/app/TransactionsScreen.tsx',import.meta.url),'utf8');
const wizard=await readFile(new URL('../../src/components/app/NewExpenseWizard.tsx',import.meta.url),'utf8');
const setup=await readFile(new URL('../../src/components/auth/HouseholdTransactionsSetup.tsx',import.meta.url),'utf8');

test('daily expense screen keeps creation and monthly list without a parallel toolbox',()=>{
 assert.match(source,/<NewExpenseWizard/);
 assert.match(source,/<ExpenseMonthBrowser/);
 assert.doesNotMatch(source,/Precisa fazer algo diferente\?/);
 assert.match(source,/Histórico, correções e ações especiais ficam ligados a este lançamento/);
 assert.doesNotMatch(source,/Precisa fazer algo diferente\?/);
});

test('contextual intents remain reachable when the financial engine asks for action',()=>{
 assert.match(source,/projectionExpenseIntent && <ForecastExpenseReviewCard/);
 assert.match(source,/recurringIntent && <RecurringExpenseCommitmentCenter/);
 assert.match(source,/directExpenseIntent && <DirectExpensePaymentAction/);
});

test('transaction detail owns correction history and valid per-item actions',()=>{
 assert.match(source,/Detalhe do gasto/);
 assert.match(source,/focusTransactionId=\{detailTransactionId\}/);
 assert.match(setup,/focusTransactionId/);
 for(const value of ['Histórico','Editar','Registrar estorno'])assert.match(setup,new RegExp(value));
 for(const action of ['ExternalExpensePaymentAction','PartialDirectRefundAction','CardRefundAction','PostPaymentCardRefundAction','ExpenseRoleCorrectionAction']) assert.match(source,new RegExp('<'+action+' initialTransactionId=\\{detailTransactionId\\}'));
 assert.match(source,/Outras ações deste gasto/);
 assert.match(source,/detailActionsOpen/);
 assert.doesNotMatch(source,/CardPixExpenseAction/);
 assert.match(wizard,/paymentChoice === 'card_pix'/);
});

test('navigation shell adds no direct financial write',()=>{assert.doesNotMatch(source,/\.rpc\(|\.insert\(|\.update\(|\.delete\(/);});
