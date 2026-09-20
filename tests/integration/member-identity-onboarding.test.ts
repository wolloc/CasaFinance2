import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const migration=await readFile(new URL('../../supabase/migrations/202609200099_member_identity_onboarding.sql',import.meta.url),'utf8');
const app=await readFile(new URL('../../src/App.tsx',import.meta.url),'utf8');
const context=await readFile(new URL('../../src/context/SupabaseAuthContext.tsx',import.meta.url),'utf8');
const screen=await readFile(new URL('../../src/components/auth/MemberIdentityOnboarding.tsx',import.meta.url),'utf8');

test('invited member identity is explicitly confirmed before financial app',()=>{
  assert.match(migration,/display_name_confirmed_at/);
  assert.match(migration,/confirm_my_display_name/);
  assert.match(app,/!currentMember\.display_name_confirmed_at/);
  assert.match(app,/<MemberIdentityOnboarding/);
});

test('member confirmation refreshes canonical household names',()=>{
  assert.match(context,/profiles\(display_name, display_name_confirmed_at, financial_onboarding_completed_at\)/);
  assert.match(context,/confirm_my_display_name/);
  assert.match(context,/setHouseholdMembersRefreshVersion/);
});

test('identity UX explains email is access rather than financial identity',()=>{
  assert.match(screen,/Como você quer aparecer no Casa\?/);
  assert.match(screen,/Seu e-mail continua sendo apenas sua forma de acesso/);
});

test('existing household owner bootstrap marks explicitly supplied name as confirmed',()=>{
  assert.match(migration,/insert into public\.profiles \(id, display_name, display_name_confirmed_at\)/);
  assert.match(migration,/values \(caller_id, trim\(display_name\), now\(\)\)/);
});
