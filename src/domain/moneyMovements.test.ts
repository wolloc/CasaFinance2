import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateMovementTotals, validateMoneyMovement } from './moneyMovements.js';
import type { Account, MoneyMovement } from '../types/index.js';

const account = (id: string): Account => ({ id, household_id: 'h', owner_user_id: 'u', name: id, account_type: 'checking', initial_balance: 0, current_balance: 0, is_active: true, created_at: '', updated_at: '' });

test('totais não classificam transferências e empréstimos como receita', () => {
  const base = { id: 'x', household_id: 'h', created_by_user_id: 'u', description: 'x', competence_month: '2026-09', movement_date: '2026-09-03', status: 'realized', created_at: '' } as const;
  const movements: MoneyMovement[] = [
    { ...base, id: '1', type: 'income', amount: 100 },
    { ...base, id: '2', type: 'transfer', amount: 80 },
    { ...base, id: '3', type: 'loan_disbursement', amount: 500 }
  ];
  assert.deepEqual(calculateMovementTotals(movements), { realizedIncome: 100, projectedIncome: 0, internalMovements: 80, loansReceived: 500 });
});

test('pagamento de fatura exige origem e identificação da fatura', () => {
  assert.throws(() => validateMoneyMovement({ type: 'invoice_payment', amount: 200, description: 'Fatura', source_account_id: 'a', card_id: 'c', competence_month: '2026-09', movement_date: '2026-09-03', status: 'realized' }, [account('a')]), /fatura/i);
});
