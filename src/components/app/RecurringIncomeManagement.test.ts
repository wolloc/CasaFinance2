import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const ui = await readFile(new URL('./RecurringIncomeManagement.tsx', import.meta.url), 'utf8');
const ledger = await readFile(new URL('./IncomeLedgerScreen.tsx', import.meta.url), 'utf8');
const service = await readFile(new URL('../../finance/recurringIncome.ts', import.meta.url), 'utf8');

test('series management is exposed inside Entradas', () => {
  assert.match(ledger, /RecurringIncomeManagement/);
  assert.match(ui, /Gerenciar rendas recorrentes/);
  assert.match(ui, /Alterar futuro/);
  assert.match(ui, /Encerrar/);
});

test('future revision and closure use dedicated canonical RPCs', () => {
  assert.match(service, /rpc\('revise_recurring_income_rule'/);
  assert.match(service, /rpc\('close_recurring_income_rule'/);
  assert.doesNotMatch(service, /update_basic_transaction|create_financial_transaction/);
});

test('UX makes prospective-only semantics explicit and requires a reason', () => {
  assert.match(ui, /Mudanças valem somente daqui para frente/);
  assert.match(ui, /não reescreve meses anteriores nem recebimentos já realizados/);
  assert.match(ui, /Conte por que a série está mudando\. Isso fica no histórico/);
  assert.match(ui, /Só o futuro foi recalculado; ocorrências anteriores ficaram intactas/);
});
