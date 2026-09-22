import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../../src/components/app/TransactionsScreen.tsx', import.meta.url), 'utf8');
const browser = await readFile(new URL('../../src/components/app/ExpenseMonthBrowser.tsx', import.meta.url), 'utf8');
const wizard = await readFile(new URL('../../src/components/app/NewExpenseWizard.tsx', import.meta.url), 'utf8');

test('Gastos deixa a leitura mensal como superfície principal e remove painel operacional paralelo', () => {
  assert.match(source, /<ExpenseMonthBrowser/);
  assert.match(source, /onOpenTransaction=\{setDetailTransactionId\}/);
  assert.match(source, /Detalhe do gasto/);
  assert.doesNotMatch(source, /Precisa fazer algo diferente\?/);
  assert.doesNotMatch(source, /Histórico e correções/);
  assert.doesNotMatch(source, /Formas especiais de pagar|Recebeu dinheiro de volta\?|Corrigir quem participou do gasto/);
});

test('ações que vêm de contexto financeiro continuam acessíveis sem painel legado', () => {
  assert.match(source, /projectionExpenseIntent && <ForecastExpenseReviewCard/);
  assert.match(source, /recurringIntent && <RecurringExpenseCommitmentCenter/);
  assert.match(source, /directExpenseIntent && <DirectExpensePaymentAction/);
});

test('toque no gasto abre detalhe auditável do próprio lançamento', () => {
  assert.match(browser, /role="button"/);
  assert.match(browser, /onOpenTransaction\?\.\(row\.id\)/);
  assert.match(source, /focusTransactionId=\{detailTransactionId\}/);
  assert.match(source, /Histórico e correções ficam ligados a este lançamento/);
});

test('navegação de mês é fluida e o card PIX continua no wizard principal', () => {
  assert.match(browser, /Mês anterior/);
  assert.match(browser, /Mês seguinte/);
  assert.match(browser, /type="month"/);
  assert.match(wizard, /paymentChoice === 'card_pix'/);
  assert.match(wizard, /createSimpleCardPixExpense/);
});

test('a reorganização de Gastos não adiciona escrita financeira',()=>{
  assert.doesNotMatch(source,/\.rpc\(|\.insert\(|\.update\(|\.delete\(/);
});
