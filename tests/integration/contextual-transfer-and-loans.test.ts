import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const adjustment=await readFile(new URL('../../src/components/app/NewAdjustmentScreen.tsx',import.meta.url),'utf8');
const row=await readFile(new URL('../../src/components/app/ResourceActionRow.tsx',import.meta.url),'utf8');
const hub=await readFile(new URL('../../src/components/app/SettlementHub.tsx',import.meta.url),'utf8');
const loan=await readFile(new URL('../../src/components/app/LoanAdjustment.tsx',import.meta.url),'utf8');
const app=await readFile(new URL('../../src/components/app/CasaFinanceApp.tsx',import.meta.url),'utf8');

test('selected resource opens transfer as a direct form with the source already contextualized',()=>{
  assert.match(row,/Transferir deste recurso/);
  assert.match(adjustment,/contextualTransfer=resourceIntent\?\.kind==='transfer'/);
  assert.match(adjustment,/Saiu de/);
  assert.match(adjustment,/transferSource\.name/);
  assert.match(adjustment,/Entrou em/);
  assert.match(adjustment,/>Valor</);
  assert.match(adjustment,/>Quando</);
  assert.match(adjustment,/\{!contextualEntry&&<button[\s\S]*?← Outras opções<\/button>\}/);
});

test('borrowing from a resource reuses LoanAdjustment with taken direction and selected destination account',()=>{
  assert.match(row,/Pegar dinheiro emprestado/);
  assert.match(app,/action\.kind==='loan'/);
  assert.match(adjustment,/initialDirection=\{resourceIntent\?\.kind==='loan'\?'taken'/);
  assert.match(adjustment,/initialAccountId=\{resourceIntent\?\.kind==='loan'\?resourceIntent\.accountId/);
  assert.match(loan,/initialAccountId/);
  assert.match(loan,/setAccountId\(initialAccountId\)/);
  assert.match(loan,/createLoanPrincipal/);
  assert.match(loan,/contextualBank/);
  assert.match(loan,/selectedAccount\.institution/);
  assert.match(loan,/credor e esta conta como destino/);
});

test('Values with people exposes explicit lending and borrowing intents',()=>{
  assert.match(hub,/Peguei emprestado/);
  assert.match(hub,/Emprestei dinheiro/);
  assert.match(hub,/kind:'loan',direction:'taken'/);
  assert.match(hub,/kind:'loan',direction:'granted'/);
  assert.match(adjustment,/settlementIntent\?\.kind==='loan'\?'loan'/);
  assert.match(loan,/Emprestei dinheiro/);
  assert.match(loan,/Peguei emprestado/);
});

test('old granted-loan route is gone instead of preserving a parallel journey',()=>{
  assert.doesNotMatch(app,/loan-granted/);
  assert.doesNotMatch(app,/openGrantedLoan/);
});


test('loan form derives description, removes free-text noise and does not fake installments',()=>{
  assert.match(loan,/const description = direction === 'taken'/);
  assert.doesNotMatch(loan,/>Descrição</);
  assert.doesNotMatch(loan,/Observação \(opcional\)/);
  assert.match(loan,/principal parcelado ainda depende do cronograma canônico/);
  assert.match(loan,/Multa só nasce se houver atraso real/);
});
