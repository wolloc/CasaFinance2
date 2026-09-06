import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const serviceSource = await readFile(new URL('./financialDashboard.ts', import.meta.url), 'utf8');
const screenSource = await readFile(new URL('../components/app/CasaHomeScreen.tsx', import.meta.url), 'utf8');
const productSpec = await readFile(new URL('../../docs/product-spec-v2.md', import.meta.url), 'utf8');

test('Casa home follows the canonical section order from Product Spec v2', () => {
  const labels = ['Como estamos?', 'Precisa de atenção', 'Este mês', 'Nosso dinheiro', 'Cartões', 'Acertos', 'Olhando pra frente'];
  const screenIndexes = labels.map((label) => screenSource.indexOf(label));
  const specIndexes = labels.map((label) => productSpec.indexOf(label));
  assert.ok(screenIndexes.every((index) => index >= 0));
  assert.ok(specIndexes.every((index) => index >= 0));
  assert.deepEqual([...screenIndexes].sort((a, b) => a - b), screenIndexes);
  assert.deepEqual([...specIndexes].sort((a, b) => a - b), specIndexes);
});

test('dashboard reads canonical health, confidence, attention and three-month projection', () => {
  assert.match(serviceSource, /rpc\('financial_household_health_position'/);
  assert.match(serviceSource, /from\('financial_projection_confidence_positions'\)/);
  assert.match(serviceSource, /rpc\('financial_attention_items'/);
  assert.match(serviceSource, /rpc\('financial_monthly_projection'/);
  assert.match(serviceSource, /p_horizon_months: 3/);
});

test('member selector uses canonical individual monthly projection instead of filtering household totals', () => {
  assert.match(screenSource, /Nossa Casa/);
  assert.match(screenSource, /setPerspective\(member\.id\)/);
  assert.match(screenSource, /getMemberFinancialPerspective/);
  assert.match(serviceSource, /rpc\('financial_member_monthly_projection'/);
  assert.match(serviceSource, /p_member_id: memberId/);
  assert.match(serviceSource, /p_horizon_months: 3/);
  assert.doesNotMatch(screenSource, /available_money\s*\/\s*2|projected_balance\s*\/\s*2/);
});

test('individual perspective keeps liquidity, economic responsibility and funding distinct', () => {
  assert.match(screenSource, /Posso movimentar hoje/);
  assert.match(screenSource, /opening_liquidity/);
  assert.match(screenSource, /Minha responsabilidade/);
  assert.match(screenSource, /economic_responsibility_remaining/);
  assert.match(screenSource, /Pode sair dos meus recursos/);
  assert.match(screenSource, /projected_funding_remaining/);
  assert.match(screenSource, /A receber do outro membro/);
  assert.match(screenSource, /settlement_receivable_position/);
  assert.match(screenSource, /Responsabilidade econômica não é alterada por conta, cartão, comprador ou por quem efetivamente pagou/);
});

test('individual perspective does not silently attribute unresolved funding', () => {
  assert.match(screenSource, /unattributed_funding_remaining/);
  assert.match(screenSource, /O Casa não vai adivinhar de quem esse dinheiro sairá/);
});

test('Casa home keeps current cash and projected ending cash conceptually separate', () => {
  assert.match(screenSource, /Saldo atual/);
  assert.match(screenSource, /Deve sobrar/);
  assert.match(screenSource, /health\?\.current_cash/);
  assert.match(screenSource, /health\?\.projected_ending_cash/);
  assert.match(screenSource, /Limites, reservas e valores a receber ficam fora/);
});

test('monthly indicators use canonical true income and financial commitments', () => {
  assert.match(screenSource, /realized_true_income_in_month/);
  assert.match(screenSource, /expected_reliable_income_remaining/);
  assert.match(screenSource, /realized_commitments_in_month/);
  assert.match(screenSource, /remaining_commitments_in_month/);
  assert.match(screenSource, /projected_recurring_commitments/);
  assert.match(screenSource, /prior_pending_outflow/);
});

test('money classes remain visually separate and credit never becomes available cash', () => {
  assert.match(screenSource, /Contas \+ dinheiro físico/);
  assert.match(screenSource, /Benefícios/);
  assert.match(screenSource, /Reservas/);
  assert.match(screenSource, /Investimentos/);
  assert.match(screenSource, /reserva, investimento e crédito não viram saldo disponível/);
  assert.match(serviceSource, /from\('financial_card_health_positions'\)/);
});

test('member settlements stay separate from buyer and payment instrument semantics', () => {
  assert.match(serviceSource, /from\('financial_member_settlement_positions'\)/);
  assert.match(screenSource, /debtor_member_id/);
  assert.match(screenSource, /creditor_member_id/);
  assert.doesNotMatch(serviceSource, /buyer_member_id|payment_instrument|card_owner/);
});

test('dashboard layer is read-only and introduces no financial mutation', () => {
  assert.doesNotMatch(serviceSource, /\.insert\(|\.update\(|\.delete\(|\.upsert\(/);
  for (const rpc of ['financial_household_health_position', 'financial_attention_items', 'financial_monthly_projection', 'financial_member_monthly_projection']) assert.match(serviceSource, new RegExp(`rpc\\('${rpc}'`));
  assert.doesNotMatch(serviceSource, /create_financial_transaction|settle_|refund_|correct_|cancel_/);
});
