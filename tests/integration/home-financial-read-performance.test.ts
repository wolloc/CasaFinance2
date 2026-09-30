import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const sql=await readFile(new URL('../../supabase/migrations/20260930110500_optimize_home_financial_reads.sql',import.meta.url),'utf8');

test('monthly projection materializes canonical commitments once per RPC',()=>{
  assert.match(sql,/commitment_base as materialized/i);
  assert.match(sql,/from commitment_base c/);
  const rawRefs=(sql.match(/from public\.financial_commitment_positions c/gi)??[]).length;
  assert.equal(rawRefs,1);
});

test('attention reuses one household health read per RPC',()=>{
  assert.match(sql,/health as materialized/i);
  const healthRefs=(sql.match(/financial_household_health_position\(p_household_id\)/g)??[]).length;
  assert.equal(healthRefs,1);
  assert.match(sql,/left join health h on true/);
  assert.match(sql,/cross join health h/);
});

test('performance hotfix stays read-only and preserves financial facts',()=>{
  assert.doesNotMatch(sql,/insert into public\./i);
  assert.doesNotMatch(sql,/update public\./i);
  assert.doesNotMatch(sql,/delete from public\./i);
});
