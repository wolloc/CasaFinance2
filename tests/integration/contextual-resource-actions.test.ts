import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const home=await readFile(new URL('../../src/components/app/CasaHomeScreen.tsx',import.meta.url),'utf8');
const map=await readFile(new URL('../../src/components/app/HomeFinancialMap.tsx',import.meta.url),'utf8');
const row=await readFile(new URL('../../src/components/app/ResourceActionRow.tsx',import.meta.url),'utf8');
const app=await readFile(new URL('../../src/components/app/CasaFinanceApp.tsx',import.meta.url),'utf8');
const adjustment=await readFile(new URL('../../src/components/app/NewAdjustmentScreen.tsx',import.meta.url),'utf8');
const investment=await readFile(new URL('../../src/components/app/InvestmentReserveAdjustment.tsx',import.meta.url),'utf8');
const adjustmentIntent=await readFile(new URL('../../src/finance/resourceAdjustmentIntent.ts',import.meta.url),'utf8');

test('Home resources expose contextual actions instead of becoming new financial writes',()=>{
 assert.match(map,/ResourceActionRow/);
 assert.match(map,/onResourceAction/);
 assert.doesNotMatch(row,/Registrar despesa/);
 assert.match(row,/Depositar em conta/);
 assert.match(row,/Transferir/);
 assert.match(row,/Sacar/);
 assert.match(row,/Aportar em investimento/);
 assert.match(row,/Resgatar/);
 assert.match(row,/Emprestar dinheiro/);
 assert.match(row,/Pegar emprestado/);
 assert.match(row,/Editar recurso/);
 assert.match(row,/ResourceIcon resource=\{resource\}/);
 assert.match(row,/Utensils/);
 assert.match(row,/PiggyBank/);
 assert.match(row,/Wallet/);
 assert.match(row,/resource\.institution/);
 assert.match(row,/resource\.ownerLabel/);
 assert.match(row,/detailLabel/);
 assert.match(map,/group\.rows\.sort/);
 assert.match(map,/grid grid-cols-2 gap-2 border-t/);
 assert.match(map,/>Contas</);
 assert.match(row,/useState\(false\)/);
 assert.match(row,/document\.addEventListener\('pointerdown'/);
 assert.match(row,/absolute left-1\/2 top-\[calc\(100%-6px\)\]/);
 assert.doesNotMatch(row,/\.rpc\(|\.insert\(|\.update\(|\.delete\(/);
});

test('resources expose only contextual movements; new expenses stay in the global FAB',()=>{
 assert.doesNotMatch(row,/act\('expense'\)|Registrar despesa/);
 assert.match(row,/cashLike&&!benefit&&!patrimonial/);
 assert.match(row,/bankLike&&!benefit&&!patrimonial/);
 assert.match(row,/patrimonial&&<>/);
 assert.match(row,/act\('deposit'\)/);
 assert.match(row,/act\('withdraw'\)/);
 assert.match(row,/act\('invest'\)/);
 assert.match(row,/act\('redeem'\)/);
});

test('resource actions route to existing canonical journeys',()=>{
 assert.doesNotMatch(app,/setResourceExpenseIntent/);
 assert.match(app,/setResourceAdjustmentIntent/);
 assert.match(app,/setAccountReviewIntent\(\{accountId:action\.accountId,source:'resource-edit'\}\)/);
 assert.match(app,/setAccountReviewIntent\(\{accountId:action\.accountId,source:'overdraft'\}\)/);
 assert.match(adjustment,/consumeResourceAdjustmentIntent/);
 assert.match(adjustment,/financial\.accounts\.some\(account=>account\.id===resourceIntent\.accountId\)/);
 assert.match(adjustment,/resourceSelection=resourceIntent/);
 assert.match(adjustment,/initialResourceId=\{resourceIntent&&\['invest','redeem'\]/);
 assert.match(adjustment,/initialTransactionalAccountId=\{resourceIntent\?\.kind==='invest'/);
 assert.match(adjustment,/initialDirection=\{resourceIntent\?\.kind==='loan-granted'\?'granted'/);
 assert.match(adjustment,/resourceIntent\?\.kind==='loan-taken'\?'taken'/);
 assert.match(investment,/initialResourceId/);
 assert.match(investment,/setInvestmentAccountId\(''\)/);
 assert.match(investment,/resourceRows\.some\(item=>item\.account_id===initialResourceId\)/);
});

test('resource intents are navigation-only and contain no write command',()=>{
 for(const source of [adjustmentIntent]){
  assert.match(source,/Ephemeral navigation context only/);
  assert.doesNotMatch(source,/\.rpc\(|\.insert\(|\.update\(|\.delete\(|createResourceTransfer|createHouseholdTransaction/);
 }
});
