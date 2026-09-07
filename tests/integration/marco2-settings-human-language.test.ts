import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../../src/components/app/SettingsScreen.tsx', import.meta.url), 'utf8');

test('settings explains concepts in user language while preserving core destinations', () => {
  assert.match(source, /Organize as pessoas, contas, cartões e categorias/);
  assert.match(source, /Como o dinheiro é organizado/);
  assert.match(source, /Contas, cartões e posição inicial/);
  assert.match(source, /Categorias/);
});

test('settings still preserves household members and account contextual review', () => {
  assert.match(source, /Casa e membros/);
  assert.match(source, /consumeAccountReviewIntent/);
  assert.match(source, /initialAccountId=\{accountReview\?\.accountId\?\?null\}/);
});
