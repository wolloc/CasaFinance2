/**
 * Motor contábil único do Casa Finance.
 *
 * O ledger recebe eventos imutáveis e produz lançamentos de partida dobrada.
 * Valores públicos são em reais; internamente, sempre em centavos inteiros.
 */

export type LedgerEventType =
  | 'income'
  | 'expense'
  | 'transfer'
  | 'credit_card_payment'
  | 'investment_deposit'
  | 'investment_withdrawal'
  | 'loan_disbursement'
  | 'loan_payment'
  | 'adjustment'
  | 'refund';

export type LedgerStatus = 'realized' | 'projected';
export type ResourceKind = 'account' | 'wallet' | 'benefit' | 'credit_card' | 'investment' | 'loan';
export type LedgerBucket = 'cash' | 'investment' | 'credit_card_liability' | 'loan_liability';

export interface FinancialResource {
  id: string;
  kind: ResourceKind;
  /** Titular dos recursos. Cartões e empréstimos podem não ter titular econômico. */
  ownerMemberId?: string;
}

export interface EconomicResponsibility {
  memberId: string;
  amount: number;
}

interface EventBase {
  id: string;
  type: LedgerEventType;
  amount: number;
  status: LedgerStatus;
  competenceMonth: string;
  responsibilities?: readonly EconomicResponsibility[];
}

export type LedgerEvent =
  | (EventBase & { type: 'income'; destinationResourceId: string })
  | (EventBase & { type: 'expense'; sourceResourceId: string })
  | (EventBase & { type: 'transfer'; sourceResourceId: string; destinationResourceId: string })
  | (EventBase & { type: 'credit_card_payment'; sourceResourceId: string; cardResourceId: string })
  | (EventBase & { type: 'investment_deposit'; sourceResourceId: string; investmentResourceId: string })
  | (EventBase & { type: 'investment_withdrawal'; investmentResourceId: string; destinationResourceId: string })
  | (EventBase & { type: 'loan_disbursement'; destinationResourceId: string; loanResourceId: string })
  | (EventBase & { type: 'loan_payment'; sourceResourceId: string; loanResourceId: string; principalAmount: number; chargeAmount?: number })
  | (EventBase & { type: 'adjustment'; resourceId: string; direction: 'increase' | 'decrease'; resultEffect?: 'income' | 'expense' | 'none' })
  | (EventBase & { type: 'refund'; reversesEventId: string });

export interface LedgerPosting {
  eventId: string;
  resourceId: string;
  bucket: LedgerBucket;
  /** Positivo aumenta ativo/obrigação; negativo reduz. */
  amount: number;
  status: LedgerStatus;
}

export interface EventEffects {
  affectsMonthlyResult: boolean | 'conditional';
  affectsCashBalance: boolean | 'conditional';
  affectsNetWorth: boolean | 'conditional';
  affectsInvoice: boolean | 'conditional';
  entersCoupleSettlement: boolean | 'conditional';
}

/** Matriz explícita usada pela documentação, validação e interface. */
export const EVENT_EFFECTS: Readonly<Record<LedgerEventType, EventEffects>> = {
  income: { affectsMonthlyResult: true, affectsCashBalance: true, affectsNetWorth: true, affectsInvoice: false, entersCoupleSettlement: false },
  expense: { affectsMonthlyResult: true, affectsCashBalance: true, affectsNetWorth: true, affectsInvoice: true, entersCoupleSettlement: true },
  transfer: { affectsMonthlyResult: false, affectsCashBalance: true, affectsNetWorth: false, affectsInvoice: false, entersCoupleSettlement: false },
  credit_card_payment: { affectsMonthlyResult: false, affectsCashBalance: true, affectsNetWorth: false, affectsInvoice: true, entersCoupleSettlement: true },
  investment_deposit: { affectsMonthlyResult: false, affectsCashBalance: true, affectsNetWorth: false, affectsInvoice: false, entersCoupleSettlement: false },
  investment_withdrawal: { affectsMonthlyResult: false, affectsCashBalance: true, affectsNetWorth: false, affectsInvoice: false, entersCoupleSettlement: false },
  loan_disbursement: { affectsMonthlyResult: false, affectsCashBalance: true, affectsNetWorth: false, affectsInvoice: false, entersCoupleSettlement: false },
  loan_payment: { affectsMonthlyResult: true, affectsCashBalance: true, affectsNetWorth: true, affectsInvoice: false, entersCoupleSettlement: false },
  adjustment: { affectsMonthlyResult: 'conditional', affectsCashBalance: 'conditional', affectsNetWorth: 'conditional', affectsInvoice: 'conditional', entersCoupleSettlement: false },
  refund: { affectsMonthlyResult: 'conditional', affectsCashBalance: 'conditional', affectsNetWorth: 'conditional', affectsInvoice: 'conditional', entersCoupleSettlement: 'conditional' }
};

export interface LedgerSettlementMember {
  memberId: string;
  funded: number;
  responsibility: number;
  balance: number;
}

export interface LedgerResult {
  postings: LedgerPosting[];
  realizedBalances: Record<string, number>;
  projectedBalances: Record<string, number>;
  realizedResult: number;
  projectedResult: number;
  realizedIncome: number;
  realizedExpenses: number;
  projectedIncome: number;
  projectedExpenses: number;
  realizedSettlement: LedgerSettlementMember[];
  projectedSettlement: LedgerSettlementMember[];
  effectiveFunderByEvent: Record<string, string>;
}

const cents = (value: number, allowZero = false): number => {
  if (!Number.isFinite(value)) throw new Error('O valor deve ser um número finito.');
  const result = Math.round(value * 100);
  if (allowZero ? result < 0 : result <= 0) throw new Error('O valor deve ser maior que zero.');
  return result;
};
const reais = (value: number): number => value / 100;

const bucketFor = (resource: FinancialResource): LedgerBucket => {
  if (resource.kind === 'investment') return 'investment';
  if (resource.kind === 'credit_card') return 'credit_card_liability';
  if (resource.kind === 'loan') return 'loan_liability';
  return 'cash';
};

const assertKind = (resource: FinancialResource, allowed: readonly ResourceKind[], eventId: string): void => {
  if (!allowed.includes(resource.kind)) throw new Error(`Recurso ${resource.id} incompatível com o evento ${eventId}.`);
};

export function processLedger(
  resourcesInput: readonly FinancialResource[],
  events: readonly LedgerEvent[],
  memberIds: readonly string[] = []
): LedgerResult {
  const resources = new Map(resourcesInput.map((resource) => [resource.id, resource]));
  if (resources.size !== resourcesInput.length) throw new Error('IDs de recursos devem ser únicos.');
  const eventById = new Map<string, LedgerEvent>();
  const postings: LedgerPosting[] = [];
  const resultImpact = new Map<string, number>();
  const resultClassification = new Map<string, 'income' | 'expense'>();
  const effectiveFunderByEvent: Record<string, string> = {};
  const settlements = {
    realized: new Map(memberIds.map((id) => [id, { funded: 0, responsibility: 0 }])),
    projected: new Map(memberIds.map((id) => [id, { funded: 0, responsibility: 0 }]))
  };

  const resource = (id: string): FinancialResource => {
    const found = resources.get(id);
    if (!found) throw new Error(`Recurso desconhecido: ${id}.`);
    return found;
  };
  const post = (event: LedgerEvent, resourceId: string, amountInCents: number): void => {
    const target = resource(resourceId);
    postings.push({ eventId: event.id, resourceId, bucket: bucketFor(target), amount: reais(amountInCents), status: event.status });
  };
  const result = (event: LedgerEvent, amountInCents: number, classification?: 'income' | 'expense'): void => {
    resultImpact.set(event.id, amountInCents);
    if (classification) resultClassification.set(event.id, classification);
  };
  const validateResponsibilities = (event: LedgerEvent): void => {
    if (!event.responsibilities?.length) return;
    const total = event.responsibilities.reduce((sum, share) => sum + cents(share.amount), 0);
    if (total !== cents(event.amount)) throw new Error(`Responsabilidades não fecham o evento ${event.id}.`);
  };
  const settle = (event: LedgerEvent, funderId: string, status: LedgerStatus): void => {
    if (!event.responsibilities?.length) return;
    validateResponsibilities(event);
    const target = settlements[status];
    const funder = target.get(funderId);
    if (!funder) throw new Error(`Financiador desconhecido no evento ${event.id}.`);
    funder.funded += cents(event.amount);
    for (const share of event.responsibilities) {
      const member = target.get(share.memberId);
      if (!member) throw new Error(`Responsável econômico desconhecido no evento ${event.id}.`);
      member.responsibility += cents(share.amount);
    }
  };
  const registerResponsibilityOnly = (event: LedgerEvent, status: LedgerStatus): void => {
    if (!event.responsibilities?.length) return;
    validateResponsibilities(event);
    for (const share of event.responsibilities) {
      const member = settlements[status].get(share.memberId);
      if (!member) throw new Error(`Responsável econômico desconhecido no evento ${event.id}.`);
      member.responsibility += cents(share.amount);
    }
  };
  const reverseSettlement = (original: LedgerEvent): void => {
    if (!original.responsibilities?.length) return;
    const originalSource = original.type === 'expense' ? resource(original.sourceResourceId) : undefined;
    const status: LedgerStatus = original.type === 'expense' && originalSource?.kind === 'credit_card'
      ? 'projected'
      : original.status;
    const target = settlements[status];
    const funderId = effectiveFunderByEvent[original.id];
    if (funderId) {
      const funder = target.get(funderId);
      if (funder) funder.funded -= cents(original.amount);
    }
    for (const share of original.responsibilities) {
      const member = target.get(share.memberId);
      if (member) member.responsibility -= cents(share.amount);
    }
  };

  for (const event of events) {
    if (eventById.has(event.id)) throw new Error(`Evento duplicado: ${event.id}.`);
    const amount = cents(event.amount);
    eventById.set(event.id, event);

    switch (event.type) {
      case 'income':
        assertKind(resource(event.destinationResourceId), ['account', 'wallet', 'benefit'], event.id);
        post(event, event.destinationResourceId, amount); result(event, amount, 'income'); break;
      case 'expense': {
        const source = resource(event.sourceResourceId);
        if (source.kind === 'credit_card') {
          post(event, source.id, amount);
          // Compra no cartão é obrigação projetada no acerto, mesmo já reconhecida no resultado.
          registerResponsibilityOnly(event, 'projected');
        } else {
          assertKind(source, ['account', 'wallet', 'benefit'], event.id);
          post(event, source.id, -amount);
          if (!source.ownerMemberId && event.responsibilities?.length) throw new Error(`Origem ${source.id} não possui titular para derivar o financiador.`);
          if (source.ownerMemberId) { effectiveFunderByEvent[event.id] = source.ownerMemberId; settle(event, source.ownerMemberId, event.status); }
        }
        result(event, -amount, 'expense');
        break;
      }
      case 'transfer':
        assertKind(resource(event.sourceResourceId), ['account', 'wallet', 'benefit'], event.id);
        assertKind(resource(event.destinationResourceId), ['account', 'wallet', 'benefit'], event.id);
        if (event.sourceResourceId === event.destinationResourceId) throw new Error('Transferência exige recursos distintos.');
        post(event, event.sourceResourceId, -amount); post(event, event.destinationResourceId, amount); break;
      case 'credit_card_payment': {
        const source = resource(event.sourceResourceId);
        assertKind(source, ['account', 'wallet', 'benefit'], event.id);
        assertKind(resource(event.cardResourceId), ['credit_card'], event.id);
        post(event, source.id, -amount); post(event, event.cardResourceId, -amount);
        if (!source.ownerMemberId && event.responsibilities?.length) throw new Error(`Origem ${source.id} não possui titular para derivar o financiador.`);
        if (source.ownerMemberId) { effectiveFunderByEvent[event.id] = source.ownerMemberId; settle(event, source.ownerMemberId, event.status); }
        break;
      }
      case 'investment_deposit':
        assertKind(resource(event.sourceResourceId), ['account', 'wallet'], event.id);
        assertKind(resource(event.investmentResourceId), ['investment'], event.id);
        post(event, event.sourceResourceId, -amount); post(event, event.investmentResourceId, amount); break;
      case 'investment_withdrawal':
        assertKind(resource(event.investmentResourceId), ['investment'], event.id);
        assertKind(resource(event.destinationResourceId), ['account', 'wallet'], event.id);
        post(event, event.investmentResourceId, -amount); post(event, event.destinationResourceId, amount); break;
      case 'loan_disbursement':
        assertKind(resource(event.destinationResourceId), ['account', 'wallet'], event.id);
        assertKind(resource(event.loanResourceId), ['loan'], event.id);
        post(event, event.destinationResourceId, amount); post(event, event.loanResourceId, amount); break;
      case 'loan_payment': {
        const principal = cents(event.principalAmount, true);
        const charges = cents(event.chargeAmount ?? 0, true);
        if (principal + charges !== amount) throw new Error(`Principal e encargos não fecham o evento ${event.id}.`);
        assertKind(resource(event.sourceResourceId), ['account', 'wallet'], event.id);
        assertKind(resource(event.loanResourceId), ['loan'], event.id);
        post(event, event.sourceResourceId, -amount);
        if (principal) post(event, event.loanResourceId, -principal);
        if (charges) result(event, -charges, 'expense');
        break;
      }
      case 'adjustment': {
        const delta = event.direction === 'increase' ? amount : -amount;
        post(event, event.resourceId, delta);
        if (event.resultEffect === 'income') result(event, amount, 'income');
        if (event.resultEffect === 'expense') result(event, -amount, 'expense');
        break;
      }
      case 'refund': {
        const original = eventById.get(event.reversesEventId);
        if (!original || original.type === 'refund') throw new Error(`Evento original inválido para estorno ${event.id}.`);
        if (event.status !== original.status) throw new Error(`Estorno ${event.id} deve ter o mesmo status do evento original.`);
        if (cents(event.amount) !== cents(original.amount)) throw new Error(`Estorno ${event.id} deve reverter o valor integral do evento original.`);
        const originals = postings.filter((posting) => posting.eventId === original.id);
        for (const posting of originals) post(event, posting.resourceId, -cents(Math.abs(posting.amount)) * Math.sign(posting.amount));
        const originalImpact = resultImpact.get(original.id) ?? 0;
        result(event, -originalImpact, originalImpact < 0 ? 'income' : 'expense');
        reverseSettlement(original);
        break;
      }
    }
  }

  const balancesFor = (includeProjected: boolean): Record<string, number> => {
    const balances = new Map<string, number>();
    for (const posting of postings) {
      if (!includeProjected && posting.status === 'projected') continue;
      balances.set(posting.resourceId, (balances.get(posting.resourceId) ?? 0) + Math.round(posting.amount * 100));
    }
    return Object.fromEntries([...balances].map(([id, value]) => [id, reais(value)]));
  };
  const resultFor = (includeProjected: boolean): number => reais(events.reduce((sum, event) => {
    if (!includeProjected && event.status === 'projected') return sum;
    return sum + (resultImpact.get(event.id) ?? 0);
  }, 0));
  const totalFor = (classification: 'income' | 'expense', includeProjected: boolean): number => reais(events.reduce((sum, event) => {
    if ((!includeProjected && event.status === 'projected') || resultClassification.get(event.id) !== classification) return sum;
    return sum + Math.abs(resultImpact.get(event.id) ?? 0);
  }, 0));
  const settlementFor = (status: LedgerStatus): LedgerSettlementMember[] => memberIds.map((memberId) => {
    const member = settlements[status].get(memberId)!;
    return { memberId, funded: reais(member.funded), responsibility: reais(member.responsibility), balance: reais(member.funded - member.responsibility) };
  });

  return {
    postings,
    realizedBalances: balancesFor(false),
    projectedBalances: balancesFor(true),
    realizedResult: resultFor(false),
    projectedResult: resultFor(true),
    realizedIncome: totalFor('income', false),
    realizedExpenses: totalFor('expense', false),
    projectedIncome: totalFor('income', true),
    projectedExpenses: totalFor('expense', true),
    realizedSettlement: settlementFor('realized'),
    projectedSettlement: settlementFor('projected'),
    effectiveFunderByEvent
  };
}
