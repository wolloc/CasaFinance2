import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

for (const file of ['expenseRoleCorrections.ts','externalExpensePayments.ts','postPaymentCardRefunds.ts']) {
  test(`${file} keeps the same request key while outcome is uncertain`, async () => {
    const source=await readFile(new URL(`../../src/finance/${file}`,import.meta.url),'utf8');
    assert.match(source,/getRetryStableRequestKey/);
    assert.match(source,/releaseRetryStableRequestKey/);
    assert.doesNotMatch(source,/p_request_key:\s*crypto\.randomUUID\(\)|const requestKey\s*=\s*crypto\.randomUUID\(\)/);
  });
}
