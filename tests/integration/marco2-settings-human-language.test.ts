import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source=await readFile(new URL('../../src/components/app/SettingsScreen.tsx',import.meta.url),'utf8');
const context=await readFile(new URL('../../src/context/SupabaseAuthContext.tsx',import.meta.url),'utf8');

test('settings stays concise while preserving core destinations',()=>{
 assert.match(source,/Sua Casa, pessoas e preferências/);
 for(const destination of ['Casa e membros','Contas e cartões','Categorias','Recorrências','Minha conta']) assert.ok(source.includes(destination),`${destination} must remain reachable`);
 assert.doesNotMatch(source,/Organize a Casa, as pessoas e as regras de cadastro/);
});

test('settings preserves household invite and account contextual review',()=>{
 assert.match(source,/HouseholdInvitationSettings/);
 assert.match(source,/consumeAccountReviewIntent/);
 assert.match(source,/initialAccountId=\{accountReview\?\.accountId\?\?null\}/);
});

test('recurring management remains reachable using canonical components',()=>{
 assert.match(source,/RecurringExpenseManagement/);
 assert.match(source,/RecurringIncomeManagement/);
 assert.match(source,/setArea\('recurring'\)/);
 const recurringSection=source.slice(source.indexOf("if(area==='recurring')"),source.indexOf("return <div className=\"space-y-6\">"));
 assert.doesNotMatch(recurringSection,/\.rpc\(|\.insert\(|\.update\(|\.delete\(/);
});

test('Minha conta exposes authenticated identity and explicit sign out',()=>{
 assert.match(source,/user\?\.email/);
 assert.match(source,/onClick=\{signOut\}/);
 assert.match(source,/Sair da conta/);
});

test('Casa e membros edits Casa and household-local member names',()=>{
 assert.match(source,/Editar nome da Casa/);
 assert.match(source,/\.from\('households'\)\.update\(\{name:nextName\}\)/);
 assert.match(source,/refreshHousehold/);
 assert.match(source,/renameHouseholdMember/);
 assert.match(context,/set_household_member_display_name/);
 assert.match(context,/display_name, profiles\(display_name/);
 assert.match(source,/memberNameMessage/);
 assert.match(source,/Não foi possível atualizar o nome deste membro\. Tente novamente\./);
});
