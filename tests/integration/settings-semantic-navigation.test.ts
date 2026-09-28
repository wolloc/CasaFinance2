import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const app = await readFile(new URL('../../src/components/app/CasaFinanceApp.tsx', import.meta.url), 'utf8');
const settings = await readFile(new URL('../../src/components/app/SettingsScreen.tsx', import.meta.url), 'utf8');
const financial = await readFile(new URL('../../src/components/auth/HouseholdFinancialSetup.tsx', import.meta.url), 'utf8');

test('main Ajustes tab remounts the settings hub when tapped again', () => {
  assert.match(app, /settingsRequestId/);
  assert.match(app, /const openSettings=\(\)=>\{setSettingsRequestId\(value=>value\+1\);setScreen\('settings'\);\}/);
  assert.match(app, /<SettingsScreen key=\{settingsRequestId\}\/>/);
  assert.match(app, /id==='settings'\?openSettings\(\)/);
});

test('Casa settings uses a home semantic icon while keeping member initials', () => {
  assert.match(settings, /SettingsLink icon=\{House\}/);
  assert.match(settings, /member\.display_name\.trim\(\)\.charAt\(0\)\.toUpperCase\(\)/);
});

test('financial resources use icons derived from their registered type', () => {
  for (const mapping of [
    'cash: Banknote',
    'checking: Landmark',
    'savings: PiggyBank',
    'investment: Building2',
    'meal_benefit: Utensils',
    'digital_wallet: WalletCards'
  ]) assert.match(financial, new RegExp(mapping));
  assert.match(financial, /const AccountIcon=accountIcons\[item\.type\]/);
  assert.match(financial, /<AccountIcon className="mb-3 h-5 w-5 text-blue-400" \/>/);
});


test('Ajustes abre conteúdo embutido em modal central sem casco de página',()=>{
  assert.match(settings,/flex items-center justify-center bg-slate-950\/75/);
  assert.match(settings,/HouseholdFinancialSetup[^>]*embedded/);
  assert.match(settings,/HouseholdCategoriesSetup embedded/);
  assert.match(settings,/FinancialPartiesSettings embedded/);
  assert.match(financial,/embedded\?\'text-slate-100\'/);
});
