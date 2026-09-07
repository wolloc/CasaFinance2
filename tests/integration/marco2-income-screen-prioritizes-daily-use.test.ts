import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../../src/components/app/IncomeLedgerScreen.tsx', import.meta.url), 'utf8');

test('income creation and ledger come before recurring administration', () => {
  const creation = source.indexOf('<IncomeCreationAction');
  const ledger = source.indexOf('<section className="space-y-3">');
  const advanced = source.indexOf('<details');
  assert.ok(creation >= 0 && ledger > creation && advanced > ledger);
  assert.match(source, /Recorrências e outras ações/);
});

test('contextual receipt stays visible when Home opens a delayed income', () => {
  assert.match(source, /initialMoneyMovementId&&<IncomeReceiptAction initialMoneyMovementId=\{initialMoneyMovementId\}/);
});

test('empty state explains what the user should expect', () => {
  assert.match(source, /Ainda não há entradas por aqui/);
  assert.match(source, /salário, aluguel, freelance ou outra renda verdadeira/);
});
