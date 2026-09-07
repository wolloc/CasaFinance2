import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { getRetryStableRequestKey, releaseRetryStableRequestKey } from '../../src/finance/retryIdempotency.js';

test('same uncertain intent reuses its request key and confirmed success releases it', () => {
  const identity = ['household', 'operation', '100.00'] as const;
  const first = getRetryStableRequestKey('test-operation', identity);
  const retry = getRetryStableRequestKey('test-operation', identity);
  assert.equal(retry, first);
  releaseRetryStableRequestKey('test-operation', identity);
  const nextIntent = getRetryStableRequestKey('test-operation', identity);
  assert.notEqual(nextIntent, first);
  releaseRetryStableRequestKey('test-operation', identity);
});

test('different payloads never share a pending key', () => {
  const firstIdentity = ['household', '100.00'] as const;
  const secondIdentity = ['household', '101.00'] as const;
  const first = getRetryStableRequestKey('different-payload', firstIdentity);
  const second = getRetryStableRequestKey('different-payload', secondIdentity);
  assert.notEqual(first, second);
  releaseRetryStableRequestKey('different-payload', firstIdentity);
  releaseRetryStableRequestKey('different-payload', secondIdentity);
});

test('keyed finance commands keep retry key on error and release only after success', async () => {
  for (const file of ['loanCharges.ts', 'loanPayments.ts', 'cardRefunds.ts', 'partialRefunds.ts']) {
    const source = await readFile(new URL(`../../src/finance/${file}`, import.meta.url), 'utf8');
    assert.match(source, /getRetryStableRequestKey/);
    assert.match(source, /if\(result\.error\)throw result\.error;[\s\S]*releaseRetryStableRequestKey/);
    assert.doesNotMatch(source, /crypto\.randomUUID\(\)/);
  }
});
