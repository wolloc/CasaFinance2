import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../../src/components/auth/HouseholdTransactionsSetup.tsx', import.meta.url), 'utf8');

test('fluxo principal limpa contexto crítico quando a releitura falha', () => {
  assert.match(source, /const clearLoadedContext = \(\) => \{/);
  assert.match(source, /setTransactions\(\[\]\).*setCategories\(\[\]\).*setAccounts\(\[\]\).*setCards\(\[\]\).*setParties\(\[\]\)/s);
  assert.match(source, /setEditing\(null\).*setFormOpen\(false\).*setHistoryTransaction\(null\)/s);
  assert.match(source, /catch \{ clearLoadedContext\(\); setLoadError\(/);
});

test('nenhuma mutação principal usa contexto stale', () => {
  assert.match(source, /const save = async[\s\S]*?if \(loadError \|\| loading\)/);
  assert.match(source, /const cancel = async[\s\S]*?if \(loadError \|\| loading\)/);
  assert.match(source, /const refund = async[\s\S]*?if \(loadError \|\| loading\)/);
  assert.match(source, /disabled=\{loading \|\| Boolean\(loadError\)\}/);
  assert.match(source, /formOpen && !loadError && !loading/);
});

test('erro de leitura exige retry explícito antes de voltar a operar', () => {
  assert.match(source, /Nenhuma alteração será registrada até uma nova leitura válida/);
  assert.match(source, /onClick=\{\(\) => void refresh\(\)\}/);
  assert.match(source, />Tentar novamente<\/button>/);
});
