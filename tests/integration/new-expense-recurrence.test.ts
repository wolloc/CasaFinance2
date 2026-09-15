import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { recurringExpenseBlockReason, recurringExpenseHorizonDate } from '../../src/finance/newExpenseRecurrence.ts';

const wizard = await readFile(new URL('../../src/components/app/NewExpenseWizard.tsx', import.meta.url), 'utf8');
const standaloneAction = await readFile(new URL('../../src/components/app/RecurringExpenseAction.tsx', import.meta.url), 'utf8');
const recurringService = await readFile(new URL('../../src/finance/recurringExpenses.ts', import.meta.url), 'utf8');
const recoveryService = await readFile(new URL('../../src/finance/newExpenseRecurrenceRecovery.ts', import.meta.url), 'utf8');
const commitmentCenter = await readFile(new URL('../../src/components/app/RecurringExpenseCommitmentCenter.tsx', import.meta.url), 'utf8');

test('Nova Despesa offers a recurrence only after the current economic fact', () => {
  assert.match(wizard, /Esse gasto se repete\?/);
  assert.match(wizard, /A despesa de hoje continua realizada uma única vez/);
  assert.match(wizard, /createRecurringExpenseFromTransaction/);
  assert.match(wizard, /transactionId: savedTransactionId/);
  assert.match(wizard, /ensureRecurringExpenseHorizon/);
  assert.match(wizard, /recurringStartDate <= today/);
});

test('partial recurrence failure persists and reconciles the saved fact without recreating it', () => {
  assert.match(wizard, /savePendingExpenseRecurrence\(recovery\)/);
  assert.match(wizard, /loadPendingExpenseRecurrence\(household\.id\)/);
  assert.match(wizard, /findRecurringExpenseRuleForTransaction/);
  assert.match(wizard, /Despesa já registrada/);
  assert.match(wizard, /o gasto não será cadastrado novamente/);
  assert.match(wizard, /!recurrenceRecovery && step === 1/);
  assert.match(wizard, /!recurrenceRecovery && step === 2/);
  assert.match(wizard, /Concluir recorrência/);
  assert.match(recurringService, /template_transaction_id/);
  assert.match(recurringService, /limit\(1\)\.maybeSingle\(\)/);
  assert.match(recoveryService, /localStorage/);
  assert.match(recoveryService, /pending-expense-recurrence/);
});

test('only simple card recurrence is enabled; unsupported financing remains blocked', () => {
  assert.match(recurringExpenseBlockReason({ paymentChoice: 'benefit', purchaseMode: 'single', hasPartyResponsibility: false }) ?? '', /não podem ativar recorrência/);
  assert.equal(recurringExpenseBlockReason({ paymentChoice: 'card', purchaseMode: 'single', hasPartyResponsibility: false }), null);
  assert.match(recurringExpenseBlockReason({ paymentChoice: 'card_pix', purchaseMode: 'single', hasPartyResponsibility: false }) ?? '', /principal e encargos/);
  assert.match(recurringExpenseBlockReason({ paymentChoice: 'external', purchaseMode: 'single', hasPartyResponsibility: false }) ?? '', /confirmados em cada ocorrência/);
  assert.match(recurringExpenseBlockReason({ paymentChoice: 'account', purchaseMode: 'single', hasPartyResponsibility: true }) ?? '', /direito da Casa a receber/);
  assert.match(recurringExpenseBlockReason({ paymentChoice: 'card', purchaseMode: 'installments', hasPartyResponsibility: false }) ?? '', /não pode ser tratada como recorrência/);
  assert.equal(recurringExpenseBlockReason({ paymentChoice: 'account', purchaseMode: 'single', hasPartyResponsibility: false }), null);
  assert.match(standaloneAction, /benefitAccountIds/);
  assert.match(standaloneAction, /account\.type==='meal_benefit'/);
  assert.match(standaloneAction, /!benefitAccountIds\.has\(row\.payment_instrument\.account_id\?\?''\)/);
  assert.match(standaloneAction, /row\.payment_instrument\?\.kind==='card'/);
  assert.match(standaloneAction, /row\.invoice_id!==null/);
  assert.match(commitmentCenter, /confirmRecurringCardExpenseOccurrence/);
});

test('projection horizon is one calendar year after the first occurrence', () => {
  assert.equal(recurringExpenseHorizonDate('2026-09-14'), '2027-09-14');
  assert.equal(recurringExpenseHorizonDate('2028-02-29'), '2029-03-01');
  assert.throws(() => recurringExpenseHorizonDate(''), /Data inicial/);
});
