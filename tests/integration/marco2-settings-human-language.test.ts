import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../../src/components/app/SettingsScreen.tsx', import.meta.url), 'utf8');

test('settings explains the Casa structure in user language and preserves core destinations', () => {
  assert.match(source, /Organize a Casa, as pessoas e as regras de cadastro/);
  assert.match(source, /Como o dinheiro é organizado/);
  for(const destination of ['Casa e membros','Contas, cartões e posição inicial','Categorias','Recorrências','Minha conta']) assert.ok(source.includes(destination), `${destination} must remain reachable`);
});

test('settings preserves household invite and account contextual review', () => {
  assert.match(source, /HouseholdInvitationSettings/);
  assert.match(source, /consumeAccountReviewIntent/);
  assert.match(source, /initialAccountId=\{accountReview\?\.accountId\?\?null\}/);
});

test('recurring management is reachable from Ajustes using the existing canonical components',()=>{
  assert.match(source,/RecurringExpenseManagement/);
  assert.match(source,/RecurringIncomeManagement/);
  assert.match(source,/setArea\('recurring'\)/);
  assert.doesNotMatch(source,/\.rpc\(|\.insert\(|\.update\(|\.delete\(/);
});

test('Minha conta exposes the authenticated identity and explicit sign out',()=>{
  assert.match(source,/user\?\.email/);
  assert.match(source,/onClick=\{signOut\}/);
  assert.match(source,/Sair da conta/);
});
