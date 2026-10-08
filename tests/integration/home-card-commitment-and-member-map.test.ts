import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

test('Home mostra mapa de dinheiro também na perspectiva individual e cartão segmenta compromisso por horizonte', () => {
  const home = read('src/components/app/HomeFinancialMap.tsx');
  const casa = read('src/components/app/CasaHomeScreen.tsx');

  assert.match(home, /Onde está nosso dinheiro\?/);
  assert.match(home, /perspective!==['"]household['"]/);
  assert.match(home, /bg-sky-300\/60/);
  assert.match(home, /bg-violet-300\/50/);
  assert.match(home, /current\/Number\(card\.credit_limit\|\|1\)/);
  assert.match(home, /future\/Number\(card\.credit_limit\|\|1\)/);

  // The heading lives inside the shared map so household and member
  // perspectives use the same component without duplicating it.
  assert.match(casa, /SafeHomeFinancialMap/);
  assert.match(casa, /resources=\{memberResources\}/);
  assert.doesNotMatch(casa, /<FinancialSectionHeading title="Onde está nosso dinheiro"/);
});
