import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { EVENT_EFFECTS, processLedger, type FinancialResource, type LedgerEvent } from './ledger.js';

const resources: FinancialResource[] = [
  { id: 'bank-w', kind: 'account', ownerMemberId: 'wallace' },
  { id: 'bank-g', kind: 'account', ownerMemberId: 'guilherme' },
  { id: 'wallet-w', kind: 'wallet', ownerMemberId: 'wallace' },
  { id: 'va-g', kind: 'benefit', ownerMemberId: 'guilherme' },
  { id: 'card-w', kind: 'credit_card', ownerMemberId: 'wallace' },
  { id: 'card-g', kind: 'credit_card', ownerMemberId: 'guilherme' },
  { id: 'investment', kind: 'investment', ownerMemberId: 'wallace' },
  { id: 'loan', kind: 'loan' }
];
const base = { status: 'realized' as const, competenceMonth: '2026-09' };

describe('motor único de movimentações', () => {
  it('documenta os efeitos de todos os dez tipos de evento', () => {
    assert.deepEqual(Object.keys(EVENT_EFFECTS), [
      'income', 'expense', 'transfer', 'credit_card_payment', 'investment_deposit',
      'investment_withdrawal', 'loan_disbursement', 'loan_payment', 'adjustment', 'refund'
    ]);
    assert.equal(EVENT_EFFECTS.transfer.affectsMonthlyResult, false);
    assert.equal(EVENT_EFFECTS.credit_card_payment.affectsInvoice, true);
    assert.equal(EVENT_EFFECTS.expense.entersCoupleSettlement, true);
  });

  it('receita e despesa direta afetam caixa, resultado e derivam financiador da origem', () => {
    const events: LedgerEvent[] = [
      { ...base, id: 'income', type: 'income', amount: 500, destinationResourceId: 'bank-w' },
      { ...base, id: 'expense', type: 'expense', amount: 100, sourceResourceId: 'bank-g', responsibilities: [{ memberId: 'wallace', amount: 100 }] }
    ];
    const result = processLedger(resources, events, ['wallace', 'guilherme']);
    assert.deepEqual(result.realizedBalances, { 'bank-w': 500, 'bank-g': -100 });
    assert.equal(result.realizedResult, 400);
    assert.equal(result.effectiveFunderByEvent.expense, 'guilherme');
    assert.deepEqual(result.realizedSettlement.map(({ memberId, balance }) => [memberId, balance]), [['wallace', -100], ['guilherme', 100]]);
  });

  it('transferência gera duas pernas vinculadas sem resultado ou patrimônio líquido', () => {
    const result = processLedger(resources, [{ ...base, id: 'transfer', type: 'transfer', amount: 75, sourceResourceId: 'bank-w', destinationResourceId: 'wallet-w' }]);
    assert.deepEqual(result.postings.map(({ eventId, amount }) => [eventId, amount]), [['transfer', -75], ['transfer', 75]]);
    assert.equal(result.realizedResult, 0);
    assert.equal(Object.values(result.realizedBalances).reduce((sum, value) => sum + value, 0), 0);
  });

  it('compra no cartão reconhece despesa e obrigação, mas não inventa financiador', () => {
    const event: LedgerEvent = { ...base, id: 'purchase', type: 'expense', amount: 120, sourceResourceId: 'card-w', responsibilities: [{ memberId: 'guilherme', amount: 120 }] };
    const result = processLedger(resources, [event], ['wallace', 'guilherme']);
    assert.deepEqual(result.realizedBalances, { 'card-w': 120 });
    assert.equal(result.realizedResult, -120);
    assert.deepEqual(result.effectiveFunderByEvent, {});
    assert.equal(result.realizedSettlement[1].responsibility, 0);
    assert.equal(result.projectedSettlement[1].responsibility, 120);
    assert.equal(result.projectedSettlement[0].funded, 0);
  });

  it('pagamento de fatura liquida obrigação, não repete despesa e usa titular da conta pagadora', () => {
    const event: LedgerEvent = { ...base, id: 'payment', type: 'credit_card_payment', amount: 120, sourceResourceId: 'bank-g', cardResourceId: 'card-w', responsibilities: [{ memberId: 'wallace', amount: 120 }] };
    const result = processLedger(resources, [event], ['wallace', 'guilherme']);
    assert.deepEqual(result.realizedBalances, { 'bank-g': -120, 'card-w': -120 });
    assert.equal(result.realizedResult, 0);
    assert.equal(result.effectiveFunderByEvent.payment, 'guilherme');
    assert.equal(result.realizedSettlement[1].balance, 120);
  });

  it('mantém comprador, titular do cartão, financiador e responsável como papéis independentes', () => {
    const purchase: LedgerEvent = {
      ...base,
      id: 'wallace-purchase-on-g-card',
      type: 'expense',
      amount: 240,
      sourceResourceId: 'card-g',
      responsibilities: [{ memberId: 'wallace', amount: 240 }]
    };
    const beforePayment = processLedger(resources, [purchase], ['wallace', 'guilherme']);
    assert.equal(beforePayment.realizedBalances['bank-w'] ?? 0, 0);
    assert.equal(beforePayment.realizedBalances['bank-g'] ?? 0, 0);
    assert.equal(beforePayment.realizedExpenses, 240);
    assert.deepEqual(beforePayment.effectiveFunderByEvent, {});

    const paidByGuilherme = processLedger(resources, [purchase, {
      ...base,
      id: 'invoice-paid-by-g',
      type: 'credit_card_payment',
      amount: 240,
      sourceResourceId: 'bank-g',
      cardResourceId: 'card-g',
      responsibilities: [{ memberId: 'wallace', amount: 240 }]
    }], ['wallace', 'guilherme']);
    assert.equal(paidByGuilherme.realizedBalances['bank-g'], -240);
    assert.equal(paidByGuilherme.effectiveFunderByEvent['invoice-paid-by-g'], 'guilherme');
    assert.deepEqual(paidByGuilherme.realizedSettlement.map(({ balance }) => balance), [-240, 240]);

    const paidByWallace = processLedger(resources, [purchase, {
      ...base,
      id: 'invoice-paid-by-w',
      type: 'credit_card_payment',
      amount: 240,
      sourceResourceId: 'bank-w',
      cardResourceId: 'card-g',
      responsibilities: [{ memberId: 'wallace', amount: 240 }]
    }], ['wallace', 'guilherme']);
    assert.equal(paidByWallace.realizedBalances['bank-w'], -240);
    assert.equal(paidByWallace.effectiveFunderByEvent['invoice-paid-by-w'], 'wallace');
    assert.deepEqual(paidByWallace.realizedSettlement.map(({ balance }) => balance), [0, 0]);
  });

  it('aporte e resgate apenas movem patrimônio entre caixa e investimento', () => {
    const events: LedgerEvent[] = [
      { ...base, id: 'deposit', type: 'investment_deposit', amount: 200, sourceResourceId: 'bank-w', investmentResourceId: 'investment' },
      { ...base, id: 'withdrawal', type: 'investment_withdrawal', amount: 50, investmentResourceId: 'investment', destinationResourceId: 'bank-w' }
    ];
    const result = processLedger(resources, events);
    assert.deepEqual(result.realizedBalances, { 'bank-w': -150, investment: 150 });
    assert.equal(result.realizedResult, 0);
  });

  it('empréstimo cria caixa e obrigação; pagamento separa principal e encargos', () => {
    const events: LedgerEvent[] = [
      { ...base, id: 'loan-in', type: 'loan_disbursement', amount: 1_000, destinationResourceId: 'bank-w', loanResourceId: 'loan' },
      { ...base, id: 'loan-out', type: 'loan_payment', amount: 110, principalAmount: 100, chargeAmount: 10, sourceResourceId: 'bank-w', loanResourceId: 'loan' }
    ];
    const result = processLedger(resources, events);
    assert.deepEqual(result.realizedBalances, { 'bank-w': 890, loan: 900 });
    assert.equal(result.realizedResult, -10);
  });

  it('ajuste exige efeito de resultado explícito', () => {
    const neutral = processLedger(resources, [{ ...base, id: 'adjust', type: 'adjustment', amount: 20, resourceId: 'bank-w', direction: 'increase', resultEffect: 'none' }]);
    assert.equal(neutral.realizedBalances['bank-w'], 20);
    assert.equal(neutral.realizedResult, 0);
  });

  it('estorno cria evento reversível e rastreável sem apagar o original', () => {
    const events: LedgerEvent[] = [
      { ...base, id: 'original', type: 'expense', amount: 30, sourceResourceId: 'va-g', responsibilities: [{ memberId: 'wallace', amount: 30 }] },
      { ...base, id: 'refund', type: 'refund', amount: 30, reversesEventId: 'original' }
    ];
    const result = processLedger(resources, events, ['wallace', 'guilherme']);
    assert.equal(result.postings.length, 2);
    assert.deepEqual(result.postings.map(({ eventId }) => eventId), ['original', 'refund']);
    assert.equal(result.realizedBalances['va-g'], 0);
    assert.equal(result.realizedResult, 0);
    assert.deepEqual(result.realizedSettlement.map(({ balance }) => balance), [0, 0]);
  });

  it('mantém realizado e projeção em visões separadas', () => {
    const events: LedgerEvent[] = [
      { ...base, id: 'now', type: 'expense', amount: 10, sourceResourceId: 'bank-w' },
      { ...base, id: 'future', type: 'expense', status: 'projected', amount: 25, sourceResourceId: 'bank-w' }
    ];
    const result = processLedger(resources, events);
    assert.equal(result.realizedBalances['bank-w'], -10);
    assert.equal(result.projectedBalances['bank-w'], -35);
    assert.equal(result.realizedResult, -10);
    assert.equal(result.projectedResult, -35);
  });

  it('rejeita inconsistências contábeis e de responsabilidade', () => {
    assert.throws(() => processLedger(resources, [{ ...base, id: 'bad-loan', type: 'loan_payment', amount: 100, principalAmount: 80, chargeAmount: 10, sourceResourceId: 'bank-w', loanResourceId: 'loan' }]));
    assert.throws(() => processLedger(resources, [{ ...base, id: 'bad-split', type: 'expense', amount: 100, sourceResourceId: 'bank-w', responsibilities: [{ memberId: 'wallace', amount: 90 }] }], ['wallace']));
  });
});
