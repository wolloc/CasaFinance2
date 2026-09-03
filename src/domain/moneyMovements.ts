import type { Account, CreateMoneyMovementInput, MoneyMovement, MoneyMovementType } from '../types/index.js';

export const MOVEMENT_LABELS: Readonly<Record<MoneyMovementType, string>> = {
  income: 'Receita',
  transfer: 'Transferência',
  investment_deposit: 'Aporte',
  investment_withdrawal: 'Resgate',
  invoice_payment: 'Pagamento de Fatura',
  loan_disbursement: 'Empréstimo'
};

export interface MovementTotals {
  realizedIncome: number;
  projectedIncome: number;
  internalMovements: number;
  loansReceived: number;
}

export function calculateMovementTotals(movements: readonly MoneyMovement[]): MovementTotals {
  const cents = (value: number) => Math.round(value * 100);
  const total = movements.reduce((result, movement) => {
    if (movement.type === 'income') {
      if (movement.status === 'realized') result.realizedIncome += cents(movement.amount);
      else result.projectedIncome += cents(movement.amount);
    } else if (movement.type === 'loan_disbursement') {
      result.loansReceived += cents(movement.amount);
    } else {
      result.internalMovements += cents(movement.amount);
    }
    return result;
  }, { realizedIncome: 0, projectedIncome: 0, internalMovements: 0, loansReceived: 0 });
  return {
    realizedIncome: total.realizedIncome / 100,
    projectedIncome: total.projectedIncome / 100,
    internalMovements: total.internalMovements / 100,
    loansReceived: total.loansReceived / 100
  };
}

export function validateMoneyMovement(input: CreateMoneyMovementInput, accounts: readonly Account[]): void {
  if (!Number.isFinite(input.amount) || input.amount <= 0) throw new Error('Informe um valor maior que zero.');
  if (!input.description.trim()) throw new Error('Informe a descrição ou origem.');
  if (!/^\d{4}-\d{2}$/.test(input.competence_month)) throw new Error('Informe uma competência válida.');
  const account = (id?: string | null) => accounts.find((item) => item.id === id && item.is_active);
  if (input.type === 'income' && (!input.beneficiary_user_id || !account(input.destination_account_id) || !input.category_id)) {
    throw new Error('Receita exige beneficiário, conta de destino e categoria.');
  }
  if (input.type === 'transfer' && (!account(input.source_account_id) || !account(input.destination_account_id) || input.source_account_id === input.destination_account_id)) {
    throw new Error('Transferência exige contas de origem e destino diferentes.');
  }
  if (input.type === 'investment_deposit' && (!account(input.source_account_id) || !account(input.destination_account_id))) throw new Error('Aporte exige origem e investimento de destino.');
  if (input.type === 'investment_withdrawal' && (!account(input.source_account_id) || !account(input.destination_account_id))) throw new Error('Resgate exige investimento de origem e conta de destino.');
  if (input.type === 'invoice_payment' && (!account(input.source_account_id) || !input.card_id || !input.invoice_reference)) throw new Error('Pagamento exige conta bancária de origem e fatura.');
  if (input.type === 'loan_disbursement' && (!account(input.destination_account_id) || !input.loan?.lender || !input.loan.first_due_date || input.loan.installment_count < 1)) {
    throw new Error('Empréstimo exige conta, credor e cronograma.');
  }
}
