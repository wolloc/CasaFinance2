import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../../src/components/app/SettingsScreen.tsx', import.meta.url), 'utf8');
const auth = await readFile(new URL('../../src/context/SupabaseAuthContext.tsx', import.meta.url), 'utf8');

test('Ajustes usa navegação curta e humana sem esconder destinos essenciais', () => {
  assert.match(source, /Sua Casa, pessoas e preferências/);
  for(const destination of ['Casa e membros','Contas e cartões','Categorias','Recorrências','Minha conta']) assert.ok(source.includes(destination), `${destination} must remain reachable`);
  assert.doesNotMatch(source,/Organize a Casa, as pessoas e as regras de cadastro/);
});

test('Casa e membros permite editar o nome da Casa e o nome local dos membros',()=>{
  assert.match(source,/Editar nome da Casa/);
  assert.match(source,/\.from\('households'\)\.update\(\{name:nextName\}\)/);
  assert.match(source,/renameHouseholdMember/);
  assert.match(source,/Editar nome de/);
  assert.match(auth,/set_household_member_display_name/);
  assert.match(auth,/display_name, profiles\(display_name/);
});

test('settings preserves household invite and account contextual review', () => {
  assert.match(source, /HouseholdInvitationSettings/);
  assert.match(source, /consumeAccountReviewIntent/);
  assert.match(source, /initialAccountId=\{accountReview\?\.accountId\?\?null\}/);
});

test('recurring management remains reachable through canonical components',()=>{
  assert.match(source,/RecurringExpenseManagement/);
  assert.match(source,/RecurringIncomeManagement/);
  assert.match(source,/setArea\('recurring'\)/);
  const start=source.indexOf("if(area==='recurring')");
  const end=source.indexOf('return <div className="space-y-6">');
  const recurringSection=source.slice(start,end);
  assert.doesNotMatch(recurringSection,/\.rpc\(|\.insert\(|\.update\(|\.delete\(/);
});

test('Minha conta exposes authenticated identity and explicit sign out',()=>{
  assert.match(source,/user\?\.email/);
  assert.match(source,/onClick=\{signOut\}/);
  assert.match(source,/Sair da conta/);
});
