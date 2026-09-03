import assert from 'node:assert/strict';
import test from 'node:test';
import { processLedger, type FinancialResource, type LedgerEvent } from './ledger.js';
import { projectDashboardFromLedger } from './dashboard.js';

const resources: FinancialResource[] = [
  { id: 'bank-a', kind: 'account', ownerMemberId: 'a' },
  { id: 'bank-b', kind: 'account', ownerMemberId: 'b' },
  { id: 'card', kind: 'credit_card', ownerMemberId: 'a' },
  { id: 'investment', kind: 'investment', ownerMemberId: 'a' },
  { id: 'loan', kind: 'loan' }
];

test('dashboard derives every financial indicator from ledger postings and classifications', () => {
  const events: LedgerEvent[] = [
    { id: 'salary', type: 'income', amount: 2_000, status: 'realized', competenceMonth: '2026-09', destinationResourceId: 'bank-a' },
    { id: 'planned-income', type: 'income', amount: 300, status: 'projected', competenceMonth: '2026-09', destinationResourceId: 'bank-a' },
    { id: 'groceries', type: 'expense', amount: 200, status: 'realized', competenceMonth: '2026-09', sourceResourceId: 'bank-a' },
    { id: 'card-purchase', type: 'expense', amount: 500, status: 'realized', competenceMonth: '2026-09', sourceResourceId: 'card' },
    { id: 'rent', type: 'expense', amount: 700, status: 'projected', competenceMonth: '2026-09', sourceResourceId: 'bank-b' },
    { id: 'transfer', type: 'transfer', amount: 100, status: 'realized', competenceMonth: '2026-09', sourceResourceId: 'bank-a', destinationResourceId: 'bank-b' },
    { id: 'invest', type: 'investment_deposit', amount: 250, status: 'realized', competenceMonth: '2026-09', sourceResourceId: 'bank-a', investmentResourceId: 'investment' },
    { id: 'loan', type: 'loan_disbursement', amount: 1_000, status: 'realized', competenceMonth: '2026-09', destinationResourceId: 'bank-b', loanResourceId: 'loan' }
  ];
  const snapshot = projectDashboardFromLedger(processLedger(resources, events), resources);

  assert.deepEqual(snapshot, {
    realizedIncome: 2_000,
    projectedIncome: 300,
    realizedExpenses: 700,
    projectedExpenses: 700,
    cardInvoices: 500,
    realCashBalance: 2_550,
    realizedMonthlyResult: 1_300,
    projectedCommitments: 1_200,
    projectedEndBalance: 1_650,
    accountAndInvestmentAssets: 2_800,
    loanObligations: 1_000
  });
});

test('invoice payment changes cash and liability without duplicating income or expense', () => {
  const events: LedgerEvent[] = [
    { id: 'purchase', type: 'expense', amount: 400, status: 'realized', competenceMonth: '2026-09', sourceResourceId: 'card' },
    { id: 'payment', type: 'credit_card_payment', amount: 400, status: 'realized', competenceMonth: '2026-09', sourceResourceId: 'bank-a', cardResourceId: 'card' }
  ];
  const snapshot = projectDashboardFromLedger(processLedger(resources, events), resources, { openingBalances: { 'bank-a': 1_000 } });

  assert.equal(snapshot.realizedExpenses, 400);
  assert.equal(snapshot.realizedIncome, 0);
  assert.equal(snapshot.cardInvoices, 0);
  assert.equal(snapshot.realCashBalance, 600);
});
