export type NewExpenseRecurrenceContext = {
  paymentChoice: 'account' | 'cash' | 'benefit' | 'card' | 'card_pix' | 'external';
  purchaseMode: 'single' | 'installments';
  hasPartyResponsibility: boolean;
};

export function recurringExpenseBlockReason(context: NewExpenseRecurrenceContext) {
  if (context.paymentChoice === 'benefit') {
    return 'Gastos em VA/VR/benefício não podem ativar recorrência. Registre cada uso quando ele acontecer.';
  }
  if (context.purchaseMode === 'installments' && (context.paymentChoice === 'card' || context.paymentChoice === 'card_pix')) {
    return 'Compra parcelada já possui compromissos próprios e não pode ser tratada como recorrência.';
  }
  if (context.paymentChoice === 'card_pix') {
    return 'A repetição de Pix por cartão precisa preservar principal e encargos como fatos separados; esse fluxo será habilitado pelo comando dedicado.';
  }
  if (context.paymentChoice === 'card') {
    return 'A repetição no cartão precisa entrar na fatura correta ao ser confirmada; esse fluxo será habilitado pelo comando dedicado.';
  }
  if (context.paymentChoice === 'external') {
    return 'Quem paga e uma eventual devolução precisam ser confirmados em cada ocorrência; pagamento por terceiro ainda não pode virar série automaticamente.';
  }
  if (context.hasPartyResponsibility) {
    return 'A parcela de responsabilidade de outra pessoa exige preservar o direito da Casa a receber em cada ocorrência; esse fluxo será habilitado com liquidação dedicada.';
  }
  return null;
}

export function recurringExpenseHorizonDate(startDate: string) {
  const [year, month, day] = startDate.split('-').map(Number);
  if (!year || !month || !day) throw new Error('Data inicial da recorrência inválida.');
  const horizon = new Date(Date.UTC(year + 1, month - 1, day));
  return horizon.toISOString().slice(0, 10);
}
