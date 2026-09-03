import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  calculateFinancialPosition,
  calculateProjection,
  calculateSettlement,
  splitInstallments,
  type SettlementExpense
} from './finance.js';

describe('regras contábeis do Casa Finance', () => {
  it('1. transferência entre contas mantém o patrimônio total', () => {
    const result = calculateFinancialPosition({
      accountBalances: { origem: 1_000, destino: 200 },
      entries: [{ id: 't1', type: 'transfer', amount: 350, status: 'effective', sourceAccountId: 'origem', destinationAccountId: 'destino' }]
    });
    assert.equal(result.bankAssets, 1_200);
    assert.equal(result.result, 0);
  });

  it('2. pagamento de fatura não cria nova despesa', () => {
    const result = calculateFinancialPosition({
      accountBalances: { banco: 1_000 },
      invoiceBalances: { cartao: 300 },
      entries: [{ id: 'p1', type: 'invoice_payment', amount: 300, status: 'effective', sourceAccountId: 'banco', cardId: 'cartao' }]
    });
    assert.equal(result.expenses, 0);
    assert.equal(result.result, 0);
  });

  it('3. compra parcelada soma exatamente o original, inclusive centavos', () => {
    const installments = splitInstallments(100, 3);
    assert.deepEqual(installments, [33.34, 33.33, 33.33]);
    assert.equal(Math.round(installments.reduce((sum, value) => sum + value, 0) * 100), 10_000);
  });

  it('4. despesa 50/50 gera metade para cada membro', () => {
    const result = calculateSettlement(['wallace', 'guilherme'], [{
      id: 'e1', amount: 80, buyerId: 'wallace', paymentInstrumentOwnerId: 'wallace', effectiveFunderId: 'wallace', fundingStatus: 'effective',
      responsibilities: [{ memberId: 'wallace', amount: 40 }, { memberId: 'guilherme', amount: 40 }]
    }]);
    assert.equal(result[0].responsibility, 40);
    assert.equal(result[1].responsibility, 40);
  });

  it('5. comprador, titular do meio e responsável podem ser pessoas diferentes', () => {
    const expense: SettlementExpense = {
      id: 'e2', amount: 90, buyerId: 'comprador', paymentInstrumentOwnerId: 'titular', effectiveFunderId: 'financiador', fundingStatus: 'effective',
      responsibilities: [{ memberId: 'responsavel', amount: 90 }]
    };
    const result = calculateSettlement(['comprador', 'titular', 'financiador', 'responsavel'], [expense]);
    assert.deepEqual(result.map(({ memberId, balance }) => [memberId, balance]), [
      ['comprador', 0], ['titular', 0], ['financiador', 90], ['responsavel', -90]
    ]);
  });

  it('6. despesa exclusiva de Wallace paga por Guilherme gera crédito e dívida corretos', () => {
    const result = calculateSettlement(['wallace', 'guilherme'], [{
      id: 'e3', amount: 125.45, buyerId: 'wallace', paymentInstrumentOwnerId: 'guilherme', effectiveFunderId: 'guilherme', fundingStatus: 'effective',
      responsibilities: [{ memberId: 'wallace', amount: 125.45 }]
    }]);
    assert.equal(result.find(({ memberId }) => memberId === 'guilherme')?.balance, 125.45);
    assert.equal(result.find(({ memberId }) => memberId === 'wallace')?.balance, -125.45);
  });

  it('7. compra no cartão aumenta fatura sem reduzir saldo bancário', () => {
    const result = calculateFinancialPosition({
      accountBalances: { banco: 1_000 }, invoiceBalances: { cartao: 0 },
      entries: [{ id: 'c1', type: 'card_purchase', amount: 120, status: 'effective', cardId: 'cartao' }]
    });
    assert.equal(result.accountBalances.banco, 1_000);
    assert.equal(result.invoiceBalances.cartao, 120);
    assert.equal(result.expenses, 120);
  });

  it('8. pagar fatura reduz só a conta escolhida e não duplica despesas', () => {
    const result = calculateFinancialPosition({
      accountBalances: { escolhida: 500, outra: 500 }, invoiceBalances: { cartao: 0 },
      entries: [
        { id: 'c2', type: 'card_purchase', amount: 200, status: 'effective', cardId: 'cartao' },
        { id: 'p2', type: 'invoice_payment', amount: 200, status: 'effective', sourceAccountId: 'escolhida', cardId: 'cartao' }
      ]
    });
    assert.deepEqual(result.accountBalances, { escolhida: 300, outra: 500 });
    assert.equal(result.invoiceBalances.cartao, 0);
    assert.equal(result.expenses, 200);
  });

  it('9. saldo real ignora lançamentos previstos', () => {
    const result = calculateFinancialPosition({
      accountBalances: { banco: 500 },
      entries: [{ id: 'f1', type: 'expense', amount: 100, status: 'planned', accountId: 'banco' }]
    });
    assert.equal(result.bankAssets, 500);
    assert.equal(result.expenses, 0);
  });

  it('10. projeção inclui conta fixa e parcela futura uma única vez', () => {
    const fixed = { id: 'fixa-2026-10', amount: 100, competenceMonth: '2026-10', kind: 'fixed_bill' as const, status: 'planned' as const };
    const installment = { id: 'parcela-2', amount: 50.01, competenceMonth: '2026-10', kind: 'installment' as const, status: 'planned' as const };
    const result = calculateProjection(1_000, '2026-10', [fixed, fixed, installment, installment]);
    assert.deepEqual(result, { realBalance: 1_000, plannedCommitments: 150.01, projectedBalance: 849.99 });
  });

  it('mantém obrigação de cartão apenas no acerto projetado antes do pagamento', () => {
    const expense: SettlementExpense = {
      id: 'card-expense', amount: 60, buyerId: 'wallace', paymentInstrumentOwnerId: 'guilherme', effectiveFunderId: 'guilherme', fundingStatus: 'planned',
      responsibilities: [{ memberId: 'wallace', amount: 60 }]
    };
    assert.deepEqual(calculateSettlement(['wallace', 'guilherme'], [expense]), [
      { memberId: 'wallace', funded: 0, responsibility: 0, balance: 0 },
      { memberId: 'guilherme', funded: 0, responsibility: 0, balance: 0 }
    ]);
    assert.equal(calculateSettlement(['wallace', 'guilherme'], [expense], 'planned')[1].balance, 60);
  });
});
