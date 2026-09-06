import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const ui = await readFile(new URL('./ExpenseFinancialStory.tsx', import.meta.url), 'utf8');
const setup = await readFile(new URL('../auth/HouseholdTransactionsSetup.tsx', import.meta.url), 'utf8');

test('expense cards expose an expandable financial story', () => {
  assert.match(setup, /ExpenseFinancialStory/);
  for (const label of ['Responsabilidade', 'Pago por', 'Saiu de', 'Falta pagar', 'Acerto gerado']) assert.match(ui, new RegExp(label));
});

test('story is loaded lazily from the canonical read model', () => {
  assert.match(ui, /financial_expense_story_positions/);
  assert.match(ui, /const \[open, setOpen\]/);
  assert.match(ui, /if \(!next \|\| story \|\| !supabase\) return/);
});

test('UI distinguishes member funding, external payment and Casa cash', () => {
  assert.match(ui, /funding_breakdown/);
  assert.match(ui, /external_payment_breakdown/);
  assert.match(ui, /Ainda sem saída de caixa da Casa/);
  assert.match(ui, /presente/);
  assert.match(ui, /reembolso/);
});
