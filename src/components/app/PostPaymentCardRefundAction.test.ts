import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const ui = await readFile(new URL('./PostPaymentCardRefundAction.tsx', import.meta.url), 'utf8');
const service = await readFile(new URL('../../finance/postPaymentCardRefunds.ts', import.meta.url), 'utf8');

test('refund UX separates where money returned from who benefited', () => {
  assert.match(ui, /Em qual conta o dinheiro realmente voltou/);
  assert.match(ui, /Para quem ficou esse valor devolvido/);
  assert.match(ui, /Esta escolha diz somente onde o dinheiro entrou/);
});

test('refund UX does not infer beneficiary from buyer, card holder or payer', () => {
  assert.match(ui, /Não precisa ser a pessoa que comprou, o titular do cartão ou quem pagou a fatura/);
  assert.match(ui, /O pagamento antigo continua registrado como realmente aconteceu/);
});

test('service uses shared read model and explicit benefit allocations', () => {
  assert.match(service, /financial_shared_post_payment_card_refund_positions/);
  assert.match(service, /record_shared_post_payment_card_refund/);
  assert.match(service, /p_benefit_allocations/);
});
