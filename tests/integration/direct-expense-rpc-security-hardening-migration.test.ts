import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const sql = fs.readFileSync(
  path.join(process.cwd(), 'supabase/migrations/202609070068_direct_expense_rpc_security.sql'),
  'utf8',
);

test('direct expense public command becomes SECURITY DEFINER with fixed search_path', () => {
  assert.match(sql, /alter function public\.create_and_settle_direct_expense[\s\S]*security definer/i);
  assert.match(sql, /alter function public\.create_and_settle_direct_expense[\s\S]*set search_path\s*=\s*public,\s*pg_temp/i);
});

test('direct expense command remains authenticated-only', () => {
  assert.match(sql, /revoke all on function public\.create_and_settle_direct_expense[\s\S]*from public, anon/i);
  assert.match(sql, /grant execute on function public\.create_and_settle_direct_expense[\s\S]*to authenticated/i);
});
