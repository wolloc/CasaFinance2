import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const home=await readFile(new URL('../../src/components/app/CasaHomeScreen.tsx',import.meta.url),'utf8');
const row=await readFile(new URL('../../src/components/app/ResourceActionRow.tsx',import.meta.url),'utf8');
const app=await readFile(new URL('../../src/components/app/CasaFinanceApp.tsx',import.meta.url),'utf8');
const adjustment=await readFile(new URL('../../src/components/app/NewAdjustmentScreen.tsx',import.meta.url),'utf8');
const investment=await readFile(new URL('../../src/components/app/InvestmentReserveAdjustment.tsx',import.meta.url),'utf8');
const expense=await readFile(new URL('../../src/components/app/NewExpenseWizard.tsx',import.meta.url),'utf8');
const adjustmentIntent=await readFile(new URL('../../src/finance/resourceAdjustmentIntent.ts',import.meta.url),'utf8');
const expenseIntent=await readFile(new URL('../../src/finance/resourceExpenseIntent.ts',import.meta.url),'utf8');

test('Home resources expose contextual actions instead of becoming new financial writes',()=>{
 assert.match(home,/ResourceActionRow/);
 assert.match(home,/onResourceAction/);
 assert.match(row,/Registrar despesa/);
 assert.match(row,/Transferir deste recurso/);
 assert.match(row,/Aportar ou resgatar/);
 assert.match(row,/Pegar dinheiro emprestado/);
 assert.match(row,/Editar recurso/);
 assert.doesNotMatch(row,/\.rpc\(|\.insert\(|\.update\(|\.delete\(/);
});

test('restricted benefits cannot offer transfer and patrimonial resources cannot offer expense',()=>{
 assert.match(row,/!patrimonial&&<button[^>]*>.*expense/s);
 assert.match(row,/!patrimonial&&!benefit&&<button[^>]*>.*transfer/s);
 assert.match(row,/patrimonial&&<button[^>]*>.*reserve/s);
});

test('resource actions route to existing canonical journeys',()=>{
 assert.match(app,/setResourceExpenseIntent/);
 assert.match(app,/openExpenseCreation\(\)/);
 assert.match(app,/setResourceAdjustmentIntent/);
 assert.match(app,/setAccountReviewIntent\(\{accountId:action\.accountId,source:'resource-edit'\}\)/);
 assert.match(app,/setAccountReviewIntent\(\{accountId:action\.accountId,source:'overdraft'\}\)/);
 assert.match(adjustment,/consumeResourceAdjustmentIntent/);
 assert.match(adjustment,/financial\.accounts\.some\(account=>account\.id===resourceIntent\.accountId\)/);
 assert.match(adjustment,/initialResourceId=\{resourceIntent\?\.kind==='reserve'/);
 assert.match(adjustment,/initialAccountId=\{resourceIntent\?\.kind==='loan'/);
 assert.match(adjustment,/initialDirection=\{resourceIntent\?\.kind==='loan'\?'taken'/);
 assert.match(investment,/initialResourceId/);
 assert.match(investment,/setInvestmentAccountId\(''\)/);
 assert.match(investment,/resourceRows\.some\(item=>item\.account_id===initialResourceId\)/);
 assert.match(expense,/consumeResourceExpenseIntent/);
 assert.match(expense,/account\.type === 'cash' \? 'cash' : account\.type === 'meal_benefit' \? 'benefit' : 'account'/);
});

test('resource intents are navigation-only and contain no write command',()=>{
 for(const source of [adjustmentIntent,expenseIntent]){
  assert.match(source,/Ephemeral navigation context only/);
  assert.doesNotMatch(source,/\.rpc\(|\.insert\(|\.update\(|\.delete\(|createResourceTransfer|createHouseholdTransaction/);
 }
});
