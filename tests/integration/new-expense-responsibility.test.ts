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
});

test('Nova Despesa mantém responsável terceiro separado do terceiro pagador', () => {
  assert.match(wizard, /Outra pessoa envolvida/);
  assert.match(wizard, /partyId: responsiblePartyId/);
  assert.match(wizard, /Isso define responsabilidade econômica, não quem pagou/);
  assert.match(wizard, /payerPartyId/);
  assert.match(wizard, /allocateCustomAmounts/);
});
