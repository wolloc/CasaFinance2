import assert from 'node:assert/strict';
import fs from 'node:fs';

const migration=fs.readFileSync('supabase/migrations/20261003130000_transaction_category_correction.sql','utf8');
assert.match(migration,/transaction_adjustment_events\(\s*household_id,source_transaction_id,kind,created_by_member_id,reason,before_payload,after_payload,amount,request_key/s);
assert.match(migration,/v_request_key:=trim\(p_request_key\)/);
assert.match(migration,/e\.household_id=p_household_id and e\.request_key=v_request_key/);
assert.match(migration,/category_id=p_category_id, updated_at=now\(\)/);
assert.match(migration,/jsonb_build_object\('category_id',old_category\)/);
assert.match(migration,/jsonb_build_object\('category_id',p_category_id\)/);
