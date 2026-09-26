import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const settings = await readFile(new URL('../../src/components/app/SettingsScreen.tsx', import.meta.url), 'utf8');
const app = await readFile(new URL('../../src/components/app/CasaFinanceApp.tsx', import.meta.url), 'utf8');
const financial = await readFile(new URL('../../src/components/auth/HouseholdFinancialSetup.tsx', import.meta.url), 'utf8');

test('Ajustes usa casa como ícone da seção Casa e membros', () => {
  assert.match(settings, /House className="h-5 w-5"/);
  assert.doesNotMatch(settings, /Users className="h-5 w-5"/);
});

test('tocar na aba Ajustes remonta a raiz da experiência', () => {
  assert.match(app, /settingsRequestId/);
  assert.match(app, /const openSettings=\(\)=>\{setSettingsRequestId\(value=>value\+1\);setScreen\('settings'\);\};/);
  assert.match(app, /<SettingsScreen key=\{settingsRequestId\}\/?>/);
  assert.match(app, /id==='settings'\?openSettings\(\)/);
});

test('contas e recursos usam ícone semântico por natureza', () => {
  for (const icon of ['Banknote', 'Landmark', 'PiggyBank', 'Building2', 'Utensils', 'WalletCards']) {
    assert.match(financial, new RegExp(icon));
  }
  assert.match(financial, /accountIcons: Record<HouseholdAccountType/);
  assert.match(financial, /const AccountIcon=accountIcons\[item\.type\]/);
  assert.match(financial, /<AccountIcon className="mb-3 h-5 w-5 text-blue-400" \/>/);
});
