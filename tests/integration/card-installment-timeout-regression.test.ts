import { readFile } from 'node:fs/promises';
import test from 'node:test';
import assert from 'node:assert/strict';

const migration = await readFile(
  new URL('../../supabase/migrations/202609110071_deduplicate_installment_total_validation.sql', import.meta.url),
  'utf8',
);

test('installment invariant remains deferred-safe and is deduplicated per plan', () => {
  assert.match(migration, /create or replace function public\.assert_installment_total\(\)/i);
  assert.match(migration, /current_setting\('casa\.validated_installment_plans',true\)/i);
  assert.match(migration, /set_config\(/i);
  assert.match(migration, /sum\(amount\),count\(\*\)/i);
  assert.match(migration, /actual<>expected or actual_count<>expected_count/i);
  assert.match(migration, /installments must exactly match plan total and count/i);
});
