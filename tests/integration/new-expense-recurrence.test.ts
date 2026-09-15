import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { recurringExpenseBlockReason, recurringExpenseHorizonDate } from '../../src/finance/newExpenseRecurrence.ts';

const wizard = await readFile(new URL('../../src/components/app/NewExpenseWizard.tsx', import.meta.url), 'utf8');
const standaloneAction = await readFile(new URL('../../src/components/app/RecurringExpenseAction.tsx', import.meta.url), 'utf8');

test('Nova Despesa offers a recurrence only after the current economic fact', () => {
  assert.match(wizard, /Esse gasto se repete\?/);
  assert.match(wizard, /A despesa de hoje continua realizada uma única vez/);
  assert.match(wizard, /createRecurringExpenseFromTransaction/);
  assert.match(wizard, /transactionId: savedTransactionId/);
  assert.match(wizard, /ensureRecurringExpenseHorizon/);
  assert.match(wizard, /recurringStartDate <= today/);
});

test('partial failure retries recurrence without recreating the expense', () => {
  assert.match(wizard, /createdTransactionId/);
  assert.match(wizard, /if \(!savedTransactionId && externalPayment\)/);
  assert.match(wizard, /if \(!savedTransactionId && instrumentKind === 'account'\)/);
  assert.match(wizard, /createdRecurringRuleId/);
  assert.match(wizard, /A despesa foi registrada, mas a recorrência ainda não foi concluída/);
});

test('only the supported simple card recurrence is enabled', () => {
  assert.equal(recurringExpenseBlockReason({ paymentChoice: 'card', purchaseMode: 'single', hasPartyResponsibility: false }), null);
  assert.match(recurringExpenseBlockReason({ paymentChoice: 'card_pix', purchaseMode: 'single', hasPartyResponsibility: false }) ?? '', /principal e encargos/);
  assert.match(recurringExpenseBlockReason({ paymentChoice: 'external', purchaseMode: 'single', hasPartyResponsibility: false }) ?? '', /confirmados em cada ocorrência/);
  assert.match(recurringExpenseBlockReason({ paymentChoice: 'account', purchaseMode: 'single', hasPartyResponsibility: true }) ?? '', /direito da Casa a receber/);
  assert.match(recurringExpenseBlockReason({ paymentChoice: 'card', purchaseMode: 'installments', hasPartyResponsibility: false }) ?? '', /não pode ser tratada como recorrência/);
  assert.equal(recurringExpenseBlockReason({ paymentChoice: 'account', purchaseMode: 'single', hasPartyResponsibility: false }), null);
  assert.match(standaloneAction, /row\.payment_instrument\?\.kind==='card'/);
  assert.match(standaloneAction, /row\.invoice_id!==null/);
  assert.match(standaloneAction, /Cada próxima ocorrência é apenas prevista/);
  assert.match(await readFile(new URL('../../src/components/app/RecurringExpenseCommitmentCenter.tsx', import.meta.url), 'utf8'), /confirmRecurringCardExpenseOccurrence/);
});

test('projection horizon is one calendar year after the first occurrence', () => {
  assert.equal(recurringExpenseHorizonDate('2026-09-14'), '2027-09-14');
  assert.equal(recurringExpenseHorizonDate('2028-02-29'), '2029-03-01');
  assert.throws(() => recurringExpenseHorizonDate(''), /Data inicial/);
});
