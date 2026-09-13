import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { allocateCustomAmounts } from '../../src/finance/economicAllocations.ts';

const wizard = await readFile(new URL('../../src/components/app/NewExpenseWizard.tsx', import.meta.url), 'utf8');

test('divisão personalizada fecha em centavos entre membros e terceiros', () => {
  assert.deepEqual(allocateCustomAmounts('100.01', [
    { memberId: 'member-a', value: '33.34' },
    { memberId: 'member-b', value: '33.33' },
    { partyId: 'party-a', value: '33.34' },
  ]).map(({ amount, memberId, partyId }) => ({ amount, memberId, partyId })), [
    { amount: '33.34', memberId: 'member-a', partyId: undefined },
    { amount: '33.33', memberId: 'member-b', partyId: undefined },
    { amount: '33.34', memberId: undefined, partyId: 'party-a' },
  ]);
  assert.throws(() => allocateCustomAmounts('10.00', [{ memberId: 'member-a', value: '10.01' }]), /fechar exatamente/);
  assert.deepEqual(allocateCustomAmounts('10.00', [
    { memberId: 'member-a', value: '10.00' },
    { partyId: 'party-zero', value: '0' },
  ]).map(({ memberId, partyId }) => ({ memberId, partyId })), [
    { memberId: 'member-a', partyId: undefined },
  ]);
});

test('Nova Despesa mantém responsável terceiro separado do terceiro pagador', () => {
  assert.match(wizard, /Outra pessoa envolvida/);
  assert.match(wizard, /partyId: responsiblePartyId/);
  assert.match(wizard, /Isso define responsabilidade econômica, não quem pagou/);
  assert.match(wizard, /payerPartyId/);
  assert.match(wizard, /allocateCustomAmounts/);
  assert.match(wizard, /responsiblePartySearch/);
  assert.match(wizard, /registerPartyInline\('responsible'\)/);
  assert.doesNotMatch(wizard, /Pessoa responsável<select/);
});

test('pagamento da Casa com parcela de terceiro usa o comando compartilhado canônico', () => {
  assert.match(wizard, /createAndSettleSharedExpense/);
  assert.match(wizard, /splits\.some\(\(split\) => split\.partyId\)/);
  assert.match(wizard, /createAndSettleSharedExpense\(supabase, household\.id, input, funderMemberId, null\)/);
});

test('devolução externa com responsabilidade mista segue o comando canônico sem bloqueio artificial', () => {
  assert.match(wizard, /createExternallyPaidExpenseWithRepaymentPlan/);
  assert.match(wizard, /responsibility: splits/);
  assert.doesNotMatch(wizard, /responsabilidade econômica precisa pertencer somente à Casa/);
});
