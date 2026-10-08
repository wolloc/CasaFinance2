import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const wizard=await readFile(new URL('../../src/components/app/NewExpenseWizard.tsx',import.meta.url),'utf8');
const resourceChoice=await readFile(new URL('../../src/components/app/FinancialResourceChoice.tsx',import.meta.url),'utf8');

test('Nova Despesa starts payment selection from concrete registered resources',()=>{
  assert.match(wizard,/De onde saiu ou será cobrado\?/);
  assert.match(wizard,/spendableAccounts\.map\(account=>/);
  assert.match(wizard,/cards\.map\(card=>/);
  assert.match(wizard,/FinancialResourceChoice/);
  assert.match(wizard,/accountResourceMeta/);
  assert.match(wizard,/cardResourceMeta/);
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
  assert.match(wizard,/label="À vista"/);
  assert.match(wizard,/label="Parcelada"/);
  assert.match(wizard,/label="Pix"/);
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
  assert.match(wizard,/grid grid-cols-3 gap-2/);
  assert.match(resourceChoice,/min-h-\[58px\]/);
  assert.match(resourceChoice,/h-6 w-6/);
  assert.match(wizard,/account\.institution/);
  assert.match(wizard,/ownerLabel=\{meta\.ownerLabel\}/);
  assert.match(wizard,/card\.last_four/);
  assert.doesNotMatch(wizard,/Conta corrente · Pix \/ débito/);
  assert.doesNotMatch(wizard,/Poupança · Pix \/ débito/);
  assert.doesNotMatch(wizard,/const kind=account\.type==='cash'\?'Dinheiro'/);
});

test('step 2 shows a compact summary of the expense before financial choices',()=>{
  assert.match(wizard,/description \|\| 'Novo gasto'/);
  assert.match(wizard,/buyerMemberId/);
  assert.match(wizard,/toLocaleDateString\('pt-BR'\)/);
  assert.match(wizard,/>Editar<\/button>/);
});

test('responsibility selection explains the financial meaning without changing the contract',()=>{
  assert.match(wizard,/Este gasto fica por conta de/);
  assert.match(wizard,/O valor será dividido igualmente entre as pessoas da Casa/);
  assert.match(wizard,/Você vai definir quanto cabe a cada pessoa/);
});
 
test('card payment routes stay compact on mobile',()=>{
  assert.match(wizard,/grid grid-cols-3 gap-2/);
  assert.match(wizard,/label="À vista"/);
  assert.match(wizard,/label="Parcelada"/);
  assert.match(wizard,/label="Pix"/);
});


test('selected card keeps institution and holder context visible before choosing the purchase route',()=>{
  assert.match(wizard,/const selectedCard = cards\.find\(card=>card\.id===cardId\)/);
  assert.match(wizard,/meta\?\.institution/);
  assert.match(wizard,/meta\?\.ownerLabel/);
  assert.match(wizard,/Como esta operação ficou no cartão\?/);
});


test('Nova Despesa deixa clara a etapa atual e permite voltar aos detalhes sem criar uma nova etapa',()=>{
  assert.match(wizard,/Etapa \{step\} de 2/);
  assert.match(wizard,/>Detalhes</);
  assert.match(wizard,/>Financeiro</);
  assert.match(wizard,/aria-current=\{step === 1 \? 'step' : undefined\}/);
  assert.match(wizard,/if \(step === 2\) \{ setError\(null\); setStep\(1\); \}/);
});
