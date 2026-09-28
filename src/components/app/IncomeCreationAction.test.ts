import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const creationSource=await readFile(new URL('./IncomeCreationAction.tsx',import.meta.url),'utf8');
const ledgerSource=await readFile(new URL('./IncomeLedgerScreen.tsx',import.meta.url),'utf8');
const transactionsScreenSource=await readFile(new URL('./TransactionsScreen.tsx',import.meta.url),'utf8');
const appSource=await readFile(new URL('./CasaFinanceApp.tsx',import.meta.url),'utf8');
const serviceSource=await readFile(new URL('../../finance/incomeFacts.ts',import.meta.url),'utf8');
const productSpec=await readFile(new URL('../../../docs/product-spec-v2.md',import.meta.url),'utf8');

test('income creation uses its dedicated canonical command instead of the generic expense creator',()=>{
 assert.match(serviceSource,/create_income_fact_idempotent/);
 assert.doesNotMatch(serviceSource,/create_financial_transaction|createHouseholdTransaction/);
 assert.match(transactionsScreenSource,/mode === 'income'.*IncomeLedgerScreen/s);
});

test('Nova Entrada is quick capture opened by the global action, not a permanent form',()=>{
 assert.match(appSource,/openIncomeCreation/);
 assert.match(appSource,/setIncomeCreateRequestId\(value=>value\+1\);setScreen\('income'\)/);
 assert.match(ledgerSource,/openRequestId=\{createRequestId\}/);
 assert.match(creationSource,/if\(!open\)return null/);
 assert.match(creationSource,/role="dialog"/);
 assert.match(creationSource,/text-2xl font-black/);
});

test('new income keeps technical nature internal while category remains optional and user-facing',()=>{
 for(const value of ['Quem recebe?','Onde entrou?','De onde vem?','Categoria'])assert.match(creationSource,new RegExp(value.replace('?','\\?')));
 assert.doesNotMatch(creationSource,/>Tipo<select/);
 assert.doesNotMatch(creationSource,/>Confiança<select/);
 assert.match(creationSource,/Categoria <span[^>]*>\(opcional\)/);
 assert.match(creationSource,/const inferredIncomeNature:IncomeNature/);
 assert.match(creationSource,/categoryId:categoryId\|\|null/);
 assert.match(serviceSource,/categoryId:string\|null/);
 assert.match(serviceSource,/p_beneficiary_member_id/);
 assert.match(serviceSource,/p_planned_destination_account_id/);
 assert.match(serviceSource,/p_income_nature/);
});

test('income UX preserves forecast versus realized cash and neutral-flow boundary',()=>{
 assert.match(creationSource,/isFuture/);
 assert.match(creationSource,/settleHouseholdIncome/);
 assert.match(productSpec,/Não são renda: transferência, refund, recebimento de recebível, empréstimo tomado, resgate de principal e acerto/);
 assert.match(creationSource,/data é futura.*prevista/s);
 assert.match(creationSource,/data é hoje ou anterior.*recebida/s);
});
