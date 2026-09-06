import { HouseholdTransactionsSetup } from '../auth/HouseholdTransactionsSetup.js';
import type { TransactionKind } from '../../finance/householdTransactions.js';
import { IncomeLedgerScreen } from './IncomeLedgerScreen.js';

export function TransactionsScreen({ mode }: { mode: TransactionKind }) {
  if (mode === 'income') return <IncomeLedgerScreen />;
  return <HouseholdTransactionsSetup embedded mode={mode} />;
}
