import { HouseholdTransactionsSetup } from '../auth/HouseholdTransactionsSetup.js';
import type { TransactionKind } from '../../finance/householdTransactions.js';

export function TransactionsScreen({ mode }: { mode: TransactionKind }) {
  return <HouseholdTransactionsSetup embedded mode={mode} />;
}
