import React from 'react';
import { Entradas } from './Entradas.js';
import type { Account, Category, PaymentMethod, Transaction, User } from '../../types/index.js';

export interface IncomeManagerProps {
  householdId: string;
  currentUser: User;
  accounts: Account[];
  categories: Category[];
  transactions: Transaction[];
  paymentMethods: PaymentMethod[];
  onRefresh: () => void;
}

export const IncomeManager: React.FC<IncomeManagerProps> = (props) => {
  return <Entradas {...props} />;
};

export { Entradas };
