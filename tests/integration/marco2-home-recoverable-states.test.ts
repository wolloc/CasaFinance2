import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const priority = await readFile(new URL('../../src/components/app/FinancialPriorityCenter.tsx', import.meta.url), 'utf8');
const review = await readFile(new URL('../../src/components/app/ProjectionReviewCenter.tsx', import.meta.url), 'utf8');

test('attention empty state explains that only actionable urgency is empty', () => {
  assert.match(priority, /Nada urgente agora/);
  assert.match(priority, /Previsões que ainda pedem conferência aparecem abaixo/);
  assert.match(priority, /CircleCheck/);
  assert.match(priority, /px-3 py-2/);
});

test('projection review failure offers an in-place retry without financial mutation', () => {
  assert.match(review, /Tentar novamente/);
  assert.match(review, /setRefreshKey\(value=>value\+1\)/);
  assert.match(review, /Nada foi considerado resolvido/);
  const failedUi = review.slice(review.indexOf('if(failed)'), review.indexOf('if(items.length===0)'));
  assert.doesNotMatch(failedUi, /\.rpc\(|insert|update|delete|settle|pay|transfer/i);
});

test('retry triggers a fresh canonical read', () => {
  assert.match(review, /\[household\?\.id,refreshKey\]/);
  assert.match(review, /financial_projection_review_items/);
});
