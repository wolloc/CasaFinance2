import type { FinancialResource, LedgerResult } from './ledger.js';

export type DashboardScope = 'couple' | string;

export interface DashboardAccountingSnapshot {
  realizedIncome: number;
  projectedIncome: number;
  realizedExpenses: number;
  projectedExpenses: number;
  cardInvoices: number;
  realCashBalance: number;
  realizedMonthlyResult: number;
  projectedCommitments: number;
  projectedEndBalance: number;
  accountAndInvestmentAssets: number;
  loanObligations: number;
}

export interface DashboardPositionInput {
  /** Saldos no início da competência; o ledger aplica somente os postings pertinentes. */
  openingBalances?: Readonly<Record<string, number>>;
}

const money = (value: number): number => Math.round(value * 100) / 100;

/**
 * Read model contábil do dashboard. Toda fórmula fica nesta fronteira de domínio;
 * componentes React recebem este DTO pronto e apenas formatam os valores.
 */
export function projectDashboardFromLedger(
  ledger: LedgerResult,
  resources: readonly FinancialResource[],
  position: DashboardPositionInput = {}
): DashboardAccountingSnapshot {
  const opening = position.openingBalances ?? {};
  const balance = (resourceId: string, projected: boolean): number =>
    (opening[resourceId] ?? 0) +
    (projected ? ledger.projectedBalances[resourceId] : ledger.realizedBalances[resourceId] ?? 0);

  const realizedCash = resources
    .filter(({ kind }) => kind === 'account' || kind === 'wallet' || kind === 'benefit')
    .reduce((sum, resource) => sum + balance(resource.id, false), 0);
  const investments = resources
    .filter(({ kind }) => kind === 'investment')
    .reduce((sum, resource) => sum + balance(resource.id, false), 0);
  const cardInvoices = resources
    .filter(({ kind }) => kind === 'credit_card')
    .reduce((sum, resource) => sum + Math.max(0, balance(resource.id, true)), 0);
  const loans = resources
    .filter(({ kind }) => kind === 'loan')
    .reduce((sum, resource) => sum + Math.max(0, balance(resource.id, true)), 0);
  const futureIncome = Math.max(0, ledger.projectedIncome - ledger.realizedIncome);
  const futureExpenses = Math.max(0, ledger.projectedExpenses - ledger.realizedExpenses);
  const projectedCommitments = cardInvoices + futureExpenses;

  return {
    realizedIncome: money(ledger.realizedIncome),
    projectedIncome: money(futureIncome),
    realizedExpenses: money(ledger.realizedExpenses),
    projectedExpenses: money(futureExpenses),
    cardInvoices: money(cardInvoices),
    realCashBalance: money(realizedCash),
    realizedMonthlyResult: money(ledger.realizedResult),
    projectedCommitments: money(projectedCommitments),
    projectedEndBalance: money(realizedCash + futureIncome - projectedCommitments),
    accountAndInvestmentAssets: money(realizedCash + investments),
    loanObligations: money(loans)
  };
}
