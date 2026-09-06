import { HouseholdTransactionsSetup } from '../auth/HouseholdTransactionsSetup.js';
import type { TransactionKind } from '../../finance/householdTransactions.js';
import { IncomeReceiptAction } from './IncomeReceiptAction.js';

export function TransactionsScreen({ mode }: { mode: TransactionKind }) {
  return <div className="space-y-5">
    {mode === 'income' && <IncomeReceiptAction />}
    <HouseholdTransactionsSetup embedded mode={mode} />
  </div>;
}
