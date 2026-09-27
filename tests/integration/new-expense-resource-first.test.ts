import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const wizard=await readFile(new URL('../../src/components/app/NewExpenseWizard.tsx',import.meta.url),'utf8');

test('Nova Despesa starts payment selection from concrete registered resources',()=>{
  assert.match(wizard,/De onde saiu ou será cobrado\?/);
  assert.match(wizard,/spendableAccounts\.map\(account=>/);
  assert.match(wizard,/cards\.map\(card=>/);
  assert.match(wizard,/ResourceChoice/);
  assert.match(wizard,/accountResourceSubtitle/);
  assert.match(wizard,/cardResourceSubtitle/);
  assert.doesNotMatch(wizard,/label="Conta \/ Pix"/);
  assert.doesNotMatch(wizard,/Qual recurso foi usado\?/);
});

test('account resource derives the canonical payment choice from its type',()=>{
  assert.match(wizard,/account\.type === 'cash' \? 'cash' : account\.type === 'meal_benefit' \? 'benefit' : 'account'/);
  assert.match(wizard,/setAccountId\(account\.id\)/);
  assert.match(wizard,/setCardId\(''\)/);
});

test('card resource keeps purchase installment and card Pix routes inside the selected card',()=>{
  assert.match(wizard,/chooseCardResource/);
  assert.match(wizard,/Compra à vista/);
  assert.match(wizard,/Compra parcelada/);
  assert.match(wizard,/Pix com este cartão/);
  assert.match(wizard,/setPaymentChoice\('card_pix'\)/);
  assert.match(wizard,/O Pix foi parcelado\?/);
  assert.match(wizard,/createSimpleCardPixExpense/);
});

test('resource-first routing does not merge payment with economic responsibility',()=>{
  const responsibility=wizard.indexOf('Quem assume esse gasto?');
  const resource=wizard.indexOf('De onde saiu ou será cobrado?');
  assert.ok(responsibility>=0&&resource>responsibility);
  assert.match(wizard,/responsibilityAllocations/);
  assert.match(wizard,/buyerMemberId/);
  assert.match(wizard,/funderMemberId/);
});


test('resource cards stay compact and avoid redundant payment-mode labels',()=>{
  assert.match(wizard,/grid grid-cols-2 gap-2/);
  assert.match(wizard,/min-h-\[58px\]/);
  assert.match(wizard,/h-7 w-7/);
  assert.match(wizard,/account\.institution/);
  assert.match(wizard,/detail=\{meta\.detail\}/);
  assert.match(wizard,/card\.last_four/);
  assert.doesNotMatch(wizard,/Conta corrente · Pix \/ débito/);
  assert.doesNotMatch(wizard,/Poupança · Pix \/ débito/);
  assert.doesNotMatch(wizard,/const kind=account\.type==='cash'\?'Dinheiro'/);
});
