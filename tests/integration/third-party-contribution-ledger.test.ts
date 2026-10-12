import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const movementKind = fs.readFileSync(path.join(root, 'supabase/migrations/202610120002_third_party_contribution_movement_kind.sql'), 'utf8');
const ledger = fs.readFileSync(path.join(root, 'supabase/migrations/202610120003_third_party_contribution_ledger.sql'), 'utf8');

test('contribuição de terceiro tem tipo de movimento próprio, separado de renda', () => {
  assert.match(movementKind, /add value if not exists 'third_party_contribution'/);
  assert.match(ledger, /'third_party_contribution','realized',p_amount/);
  assert.doesNotMatch(ledger, /'income','realized',p_amount/);
});

test('registro de contribuição exige membro ativo, contraparte, conta e compromisso da mesma Casa', () => {
  assert.match(ledger, /require_active_member\(p_household_id\)/);
  assert.match(ledger, /financial_commitment_positions c/);
  assert.match(ledger, /financial_member_commitment_responsibility_positions r/);
  assert.match(ledger, /financial_parties[\s\S]*household_id=p_household_id/);
  assert.match(ledger, /accounts[\s\S]*household_id=p_household_id/);
  assert.match(ledger, /revoke all on function public\.record_third_party_contribution/);
  assert.match(ledger, /grant execute on function public\.record_third_party_contribution[\s\S]*to authenticated/);
});

test('repetições são idempotentes e recebimentos concorrentes não podem exceder a responsabilidade', () => {
  assert.match(ledger, /unique \(household_id, request_key\)/);
  assert.match(ledger, /idempotency key already used with different payload/);
  assert.match(ledger, /third-party-contribution-commitment:/);
  assert.match(ledger, /select r\.remaining_responsibility_amount::numeric\(19,2\) as remaining_amount into position/);
  assert.match(ledger, /received_before\+p_amount>position\.remaining_amount/);
});

test('contribuição cria caixa real sem ser tratada como renda nem como recebível automático', () => {
  assert.match(ledger, /destination_account_id,counterparty_id,related_transaction_id/);
  assert.match(ledger, /state,amount,description/);
  assert.match(ledger, /Receivable lifecycle remains a separate step/);
  assert.match(ledger, /security_invoker=true/);
  assert.match(ledger, /grant select on public\.financial_third_party_commitment_positions to authenticated/);
});

const contributionUi = fs.readFileSync(path.join(root, 'src/components/app/ThirdPartyCommitmentProjection.tsx'), 'utf8');

test('resposta ambígua mantém a mesma chave e bloqueia alterações no payload antes da confirmação', () => {
  assert.match(contributionUi, /const identity = \[household\.id, row\.commitment_key, row\.counterparty_id\]/);
  assert.match(contributionUi, /if \(uncertain\)[\s\S]*setRetryUncertain\(true\)/);
  assert.match(contributionUi, /disabled=\{saving \|\| retryUncertain\}/);
  assert.match(contributionUi, /Tentar confirmar recebimento/);
  assert.match(contributionUi, /window\.localStorage\.setItem\(key, JSON\.stringify\(value\)\)/);
  assert.match(contributionUi, /window\.localStorage\.getItem\(key\)/);
  assert.match(contributionUi, /existingPending\?\.requestKey/);
  assert.match(contributionUi, /!retryUncertain && numericAmount > row\.expected_contribution_amount/);
  assert.match(contributionUi, /releaseRetryStableRequestKey\('third-party-contribution-record', identity\)/);
});
