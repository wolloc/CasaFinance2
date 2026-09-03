import { processLedger, type FinancialResource, type LedgerEvent } from './ledger.js';

/**
 * Regras financeiras puras do Casa Finance.
 *
 * Valores entram e saem da fronteira deste módulo em reais, mas todos os
 * cálculos são executados em centavos para evitar resíduos de ponto flutuante.
 */

export type PostingStatus = 'effective' | 'planned';

type BaseEntry = {
  id: string;
  amount: number;
  status: PostingStatus;
};

export type FinancialEntry =
  | (BaseEntry & { type: 'income'; accountId: string })
  | (BaseEntry & { type: 'expense'; accountId: string })
  | (BaseEntry & { type: 'transfer'; sourceAccountId: string; destinationAccountId: string })
  | (BaseEntry & { type: 'card_purchase'; cardId: string })
  | (BaseEntry & { type: 'invoice_payment'; sourceAccountId: string; cardId: string });

export interface FinancialPositionInput {
  accountBalances: Readonly<Record<string, number>>;
  invoiceBalances?: Readonly<Record<string, number>>;
  entries: readonly FinancialEntry[];
}

export interface FinancialPosition {
  accountBalances: Record<string, number>;
  invoiceBalances: Record<string, number>;
  bankAssets: number;
  cardLiabilities: number;
  netWorth: number;
  income: number;
  expenses: number;
  result: number;
}

export interface ResponsibilityShare {
  memberId: string;
  amount: number;
}

export interface SettlementExpense {
  id: string;
  amount: number;
  buyerId: string;
  paymentInstrumentOwnerId: string;
  /** Pessoa cujo recurso próprio efetivamente saiu ou sairá para liquidar a obrigação. */
  effectiveFunderId: string;
  fundingStatus: PostingStatus;
  responsibilities: readonly ResponsibilityShare[];
}

export interface MemberSettlement {
  memberId: string;
  funded: number;
  responsibility: number;
  balance: number;
}

export interface Commitment {
  /** Identidade estável da ocorrência/parcela; usada para impedir dupla contagem. */
  id: string;
  amount: number;
  competenceMonth: string;
  kind: 'fixed_bill' | 'installment';
  status: PostingStatus;
}

export interface Projection {
  realBalance: number;
  plannedCommitments: number;
  projectedBalance: number;
}

const toCents = (value: number): number => {
  if (!Number.isFinite(value)) throw new Error('O valor deve ser um número finito.');
  return Math.round(value * 100);
};

const fromCents = (value: number): number => value / 100;

const assertPositiveAmount = (amount: number): number => {
  const cents = toCents(amount);
  if (cents <= 0) throw new Error('O valor deve ser maior que zero.');
  return cents;
};

/** Divide o total e coloca um centavo de resíduo nas primeiras parcelas. */
export function splitInstallments(total: number, count: number): number[] {
  if (!Number.isInteger(count) || count <= 0) {
    throw new Error('A quantidade de parcelas deve ser um inteiro positivo.');
  }

  const totalCents = assertPositiveAmount(total);
  const base = Math.floor(totalCents / count);
  const residue = totalCents % count;

  return Array.from({ length: count }, (_, index) => fromCents(base + (index < residue ? 1 : 0)));
}

/**
 * Calcula saldos realizados, obrigações de cartão e resultado, ignorando
 * lançamentos previstos. Transferências e pagamentos de fatura não afetam o
 * resultado. Uma compra no cartão afeta despesa e fatura, nunca a conta.
 */
export function calculateFinancialPosition(input: FinancialPositionInput): FinancialPosition {
  const resources = new Map<string, FinancialResource>();
  Object.keys(input.accountBalances).forEach((id) => resources.set(id, { id, kind: 'account' }));
  Object.keys(input.invoiceBalances ?? {}).forEach((id) => resources.set(id, { id, kind: 'credit_card' }));
  const ledgerEvents: LedgerEvent[] = input.entries.map((entry) => {
    const common = { id: entry.id, amount: entry.amount, status: entry.status === 'effective' ? 'realized' as const : 'projected' as const, competenceMonth: 'legacy' };
    switch (entry.type) {
      case 'income': resources.set(entry.accountId, resources.get(entry.accountId) ?? { id: entry.accountId, kind: 'account' }); return { ...common, type: 'income', destinationResourceId: entry.accountId };
      case 'expense': resources.set(entry.accountId, resources.get(entry.accountId) ?? { id: entry.accountId, kind: 'account' }); return { ...common, type: 'expense', sourceResourceId: entry.accountId };
      case 'transfer':
        resources.set(entry.sourceAccountId, resources.get(entry.sourceAccountId) ?? { id: entry.sourceAccountId, kind: 'account' });
        resources.set(entry.destinationAccountId, resources.get(entry.destinationAccountId) ?? { id: entry.destinationAccountId, kind: 'account' });
        return { ...common, type: 'transfer', sourceResourceId: entry.sourceAccountId, destinationResourceId: entry.destinationAccountId };
      case 'card_purchase': resources.set(entry.cardId, resources.get(entry.cardId) ?? { id: entry.cardId, kind: 'credit_card' }); return { ...common, type: 'expense', sourceResourceId: entry.cardId };
      case 'invoice_payment':
        resources.set(entry.sourceAccountId, resources.get(entry.sourceAccountId) ?? { id: entry.sourceAccountId, kind: 'account' });
        resources.set(entry.cardId, resources.get(entry.cardId) ?? { id: entry.cardId, kind: 'credit_card' });
        return { ...common, type: 'credit_card_payment', sourceResourceId: entry.sourceAccountId, cardResourceId: entry.cardId };
    }
  });
  const ledger = processLedger([...resources.values()], ledgerEvents);
  const accounts = new Map(Object.entries(input.accountBalances).map(([id, value]) => [id, toCents(value) + toCents(ledger.realizedBalances[id] ?? 0)]));
  const invoices = new Map(Object.entries(input.invoiceBalances ?? {}).map(([id, value]) => [id, toCents(value) + toCents(ledger.realizedBalances[id] ?? 0)]));
  for (const [id, delta] of Object.entries(ledger.realizedBalances)) {
    const target = resources.get(id)?.kind === 'credit_card' ? invoices : accounts;
    if (!target.has(id)) target.set(id, toCents(delta));
  }
  for (const balance of invoices.values()) if (balance < 0) throw new Error('Pagamento maior que a obrigação do cartão.');
  const bankAssets = [...accounts.values()].reduce((sum, value) => sum + value, 0);
  const cardLiabilities = [...invoices.values()].reduce((sum, value) => sum + value, 0);

  return {
    accountBalances: Object.fromEntries([...accounts].map(([id, value]) => [id, fromCents(value)])),
    invoiceBalances: Object.fromEntries([...invoices].map(([id, value]) => [id, fromCents(value)])),
    bankAssets: fromCents(bankAssets),
    cardLiabilities: fromCents(cardLiabilities),
    netWorth: fromCents(bankAssets - cardLiabilities),
    income: ledger.realizedIncome,
    expenses: ledger.realizedExpenses,
    result: ledger.realizedResult
  };
}

/** Calcula quanto cada membro financiou menos sua responsabilidade econômica. */
export function calculateSettlement(
  memberIds: readonly string[],
  expenses: readonly SettlementExpense[],
  mode: PostingStatus = 'effective'
): MemberSettlement[] {
  const uniqueMembers = [...new Set(memberIds)];
  const balances = new Map(uniqueMembers.map((memberId) => [memberId, { funded: 0, responsibility: 0 }]));

  for (const expense of expenses) {
    const total = assertPositiveAmount(expense.amount);
    const responsibilityTotal = expense.responsibilities.reduce(
      (sum, share) => sum + assertPositiveAmount(share.amount),
      0
    );
    if (responsibilityTotal !== total) throw new Error(`Responsabilidades não fecham o valor da despesa ${expense.id}.`);

    if (expense.fundingStatus !== mode) continue;
    const funder = balances.get(expense.effectiveFunderId);
    if (!funder) throw new Error(`Financiador desconhecido na despesa ${expense.id}.`);
    funder.funded += total;

    for (const share of expense.responsibilities) {
      const member = balances.get(share.memberId);
      if (!member) throw new Error(`Responsável econômico desconhecido na despesa ${expense.id}.`);
      member.responsibility += toCents(share.amount);
    }
  }

  return uniqueMembers.map((memberId) => {
    const member = balances.get(memberId)!;
    return {
      memberId,
      funded: fromCents(member.funded),
      responsibility: fromCents(member.responsibility),
      balance: fromCents(member.funded - member.responsibility)
    };
  });
}

/** Soma cada compromisso previsto uma única vez, por ID e competência. */
export function calculateProjection(
  realBalance: number,
  competenceMonth: string,
  commitments: readonly Commitment[]
): Projection {
  const unique = new Map<string, Commitment>();
  for (const commitment of commitments) {
    if (commitment.status === 'planned' && commitment.competenceMonth === competenceMonth) {
      const previous = unique.get(commitment.id);
      if (previous && (previous.amount !== commitment.amount || previous.kind !== commitment.kind)) {
        throw new Error(`Compromisso duplicado e divergente: ${commitment.id}.`);
      }
      unique.set(commitment.id, commitment);
    }
  }

  const plannedCents = [...unique.values()].reduce((sum, item) => sum + assertPositiveAmount(item.amount), 0);
  const realCents = toCents(realBalance);
  return {
    realBalance: fromCents(realCents),
    plannedCommitments: fromCents(plannedCents),
    projectedBalance: fromCents(realCents - plannedCents)
  };
}
