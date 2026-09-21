import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';

const bootstrap=fs.readFileSync('src/auth/householdBootstrap.ts','utf8');
const expense=fs.readFileSync('src/components/app/NewExpenseWizard.tsx','utf8');
const income=fs.readFileSync('src/components/app/IncomeCreationAction.tsx','utf8');
const setup=fs.readFileSync('src/components/auth/HouseholdFinancialSetup.tsx','utf8');
const home=fs.readFileSync('src/components/app/CasaHomeScreen.tsx','utf8');

test('authenticated household carries its canonical timezone',()=>{
  assert.match(bootstrap,/select\('id, name, timezone'\)/);
});

test('critical financial dates use the household clock instead of the device clock',()=>{
  for(const source of[expense,income,setup,home]) assert.match(source,/dateInTimeZone/);
  assert.doesNotMatch(expense,/getTimezoneOffset/);
  assert.doesNotMatch(home,/timeZone:'America\/Sao_Paulo'/);
});
