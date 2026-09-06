import assert from 'node:assert/strict';
import test from 'node:test';
import { buildRefundBenefitAllocations } from './postPaymentCardRefunds.js';

test('refund benefit allocations close exactly in cents', () => {
  const result = buildRefundBenefitAllocations('10.00', [
    { memberId: 'a', percentage: 33.333333 },
    { memberId: 'b', percentage: 66.666667 },
  ]);
  assert.equal(result.reduce((sum, row) => sum + Math.round(row.amount * 100), 0), 1000);
  assert.equal(result[0]?.amount, 3.33);
  assert.equal(result[1]?.amount, 6.67);
});

test('refund benefit allocations require exactly 100 percent', () => {
  assert.throws(() => buildRefundBenefitAllocations('20.00', [{ memberId: 'a', percentage: 80 }]), /100%/);
});

test('refund benefit allocations reject duplicate beneficiaries', () => {
  assert.throws(() => buildRefundBenefitAllocations('20.00', [
    { memberId: 'a', percentage: 50 }, { memberId: 'a', percentage: 50 },
  ]), /única vez/);
});
