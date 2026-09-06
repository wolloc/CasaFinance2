import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const ui = await readFile(new URL('./PostPaymentCardRefundAction.tsx', import.meta.url), 'utf8');
const service = await readFile(new URL('../../finance/postPaymentCardRefunds.ts', import.meta.url), 'utf8');

test('refund UX separates cash destination from economic beneficiary', () => {
  assert.match(ui, /Em qual conta o dinheiro realmente voltou/);
  assert.match(ui, /Quem ficou com o benefício desse estorno/);
  assert.match(ui, /A conta define onde o caixa entrou\. Ela não define quem ficou com o benefício/);
});

test('refund UX does not infer beneficiary from buyer, card holder or funder', () => {
  assert.match(ui, /independente de comprador, titular do cartão, conta de destino e de quem financiou/);
  assert.match(ui, /O funding antigo não é apagado/);
});

test('service uses shared read model and explicit benefit allocations', () => {
  assert.match(service, /financial_shared_post_payment_card_refund_positions/);
  assert.match(service, /record_shared_post_payment_card_refund/);
  assert.match(service, /p_benefit_allocations/);
});
