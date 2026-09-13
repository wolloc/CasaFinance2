import assert from 'node:assert/strict';
import test from 'node:test';
import { allocateCustomAmounts, allocateEqually, allocateProportionally } from './economicAllocations.js';

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

test('encargos proporcionais fecham em centavos sem alocações zeradas', () => {
  const result = allocateProportionally('0.10', [
    { memberId: 'a', amount: '99.00', percentage: '99.0000' },
    { partyId: 'b', amount: '1.00', percentage: '1.0000' },
  ]);
  assert.deepEqual(result.map(({ amount, memberId, partyId }) => ({ amount, memberId, partyId })), [
    { amount: '0.10', memberId: 'a', partyId: undefined },
  ]);
  assert.equal(result.reduce((sum, split) => sum + Math.round(Number(split.amount) * 100), 0), 10);
  assert.ok(result.every((split) => Number(split.amount) > 0));
});

test('encargos usam maiores restos e preservam a proporção possível', () => {
  const result = allocateProportionally('0.05', [
    { memberId: 'a', amount: '50.00', percentage: '50.0000' },
    { memberId: 'b', amount: '30.00', percentage: '30.0000' },
    { partyId: 'c', amount: '20.00', percentage: '20.0000' },
  ]);
  assert.deepEqual(result.map((split) => split.amount), ['0.03', '0.01', '0.01']);
  assert.equal(result.reduce((sum, split) => sum + Math.round(Number(split.amount) * 100), 0), 5);
});
