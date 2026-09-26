import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const migration=await readFile(new URL('../../supabase/migrations/20260926035600_income_destination_ownership_guard.sql',import.meta.url),'utf8');
const screen=await readFile(new URL('../../src/components/app/IncomeCreationAction.tsx',import.meta.url),'utf8');

test('owner-first income is enforced in both UI and canonical database writes',()=>{
 assert.match(screen,/resource\.ownerMemberIds\.includes\(beneficiaryMemberId\)/);
 assert.match(migration,/account_ownerships/);
 assert.match(migration,/ownership\.account_id=p_planned_destination_account_id/);
 assert.match(migration,/ownership\.member_id=p_beneficiary_member_id/);
 assert.match(migration,/raise exception 'income destination account must belong to beneficiary'/);
});

test('income ownership guard also protects direct or stale callers without changing cash semantics',()=>{
 assert.match(migration,/create or replace function public\.create_income_fact/);
 assert.match(migration,/p_planned_destination_account_id/);
 assert.doesNotMatch(migration,/transactions.*insert|money_movements.*insert|update public\.accounts/i);
});
