import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const view = await readFile(new URL('../../src/finance/expenseMonthViews.ts', import.meta.url), 'utf8');
const screen = await readFile(new URL('../../src/components/app/ExpenseMonthBrowser.tsx', import.meta.url), 'utf8');
const summary = await readFile(new URL('../../src/components/app/FinancialListSummaryCard.tsx', import.meta.url), 'utf8');

test('economic expenses keep canonical date ordering and stable same-day ordering', () => {
  assert.match(view, /order\('transaction_date',\{ascending:false\}\)[\s\S]*order\('created_at',\{ascending:false\}\)/);
});

test('expense reads expose buyer and payment instrument without inferring responsibility', () => {
  assert.match(view, /buyer_member_id/);
  assert.match(view, /transaction_payment_instruments\(kind\)/);
  assert.match(view, /buyerMemberId/);
  assert.match(view, /instrumentKind/);
  assert.doesNotMatch(view, /buyer_member_id[^\n]+responsib/i);
});

test('expense list shows compact buyer and resource context', () => {
  assert.match(screen, /UserRound/);
  assert.match(screen, /instrumentLabel/);
  assert.match(screen, /CreditCard/);
  assert.match(screen, /Landmark/);
  assert.match(screen, /row\.buyer_member_id/);
  assert.match(screen, /row\.instrument_kind/);
});

test('expense totals keep stronger outgoing hierarchy through the shared summary', () => {
  assert.match(screen, /FinancialListSummaryCard tone="expense"/);
  assert.match(summary, /label='Total da visão'/);
  assert.match(summary, /mt-1 block text-2xl/);
  assert.match(summary, /border-rose-900\/40 bg-rose-950\/15 text-rose-200/);
});
