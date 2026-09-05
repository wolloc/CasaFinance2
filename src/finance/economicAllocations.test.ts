import assert from 'node:assert/strict';
import test from 'node:test';
import { allocateCustomAmounts, allocateEqually } from './economicAllocations.js';

test('divisão personalizada fecha valor e percentual exatamente', () => {
  const result = allocateCustomAmounts('300.00', [
    { memberId: 'member-a', value: '200' },
    { memberId: 'member-b', value: '100' },
  ]);
  assert.deepEqual(result.map(({ amount }) => amount), ['200.00', '100.00']);
  assert.equal(result.reduce((sum, split) => sum + Number(split.amount), 0), 300);
  assert.equal(result.reduce((sum, split) => sum + Math.round(Number(split.percentage) * 10000), 0), 1_000_000);
});

test('rateio igual distribui centavos sem perder o total', () => {
  const result = allocateEqually('10.00', [{ memberId: 'a' }, { memberId: 'b' }, { partyId: 'c' }]);
  assert.deepEqual(result.map(({ amount }) => amount), ['3.34', '3.33', '3.33']);
  assert.equal(result.reduce((sum, split) => sum + Math.round(Number(split.percentage) * 10000), 0), 1_000_000);
});

test('divisão personalizada rejeita total incompleto', () => {
  assert.throws(() => allocateCustomAmounts('300', [{ memberId: 'a', value: '299.99' }]), /fechar exatamente/);
});
