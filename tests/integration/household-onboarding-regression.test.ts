import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const bootstrapClient = fs.readFileSync(path.join(process.cwd(), 'src/auth/householdBootstrap.ts'), 'utf8');
const onboarding = fs.readFileSync(path.join(process.cwd(), 'src/components/auth/PendingHouseholdScreen.tsx'), 'utf8');
const migration = fs.readFileSync(path.join(process.cwd(), 'supabase/migrations/202609070069_household_onboarding_bootstrap.sql'), 'utf8');

test('household bootstrap keeps profile name and owner membership in one RPC transaction', () => {
  assert.match(bootstrapClient, /bootstrap_household_with_profile/);
  assert.doesNotMatch(bootstrapClient, /from\('profiles'\)\.update/);
  assert.match(migration, /security definer/i);
  assert.match(migration, /set search_path = public, pg_temp/i);
  assert.match(migration, /on conflict \(id\) do update/i);
  assert.match(migration, /insert into public\.households/i);
  assert.match(migration, /insert into public\.household_members/i);
  assert.match(migration, /grant execute on function public\.bootstrap_household_with_profile[\s\S]*to authenticated/i);
  assert.match(migration, /revoke all on function public\.bootstrap_household_with_profile[\s\S]*from public, anon/i);
});

test('onboarding previews an invitation before acceptance and preserves the create-a-house choice', () => {
  assert.match(onboarding, /Ver convite/);
  assert.match(onboarding, /previewInvitation\(inviteToken\)/);
  assert.match(onboarding, /Você tem um convite/);
  assert.match(onboarding, /Entrar na \{invitePreview\?\.householdName\}/);
  assert.match(onboarding, /Criar uma nova Casa/);
  assert.match(onboarding, /Seu convite continua sem ser aceito/);
  assert.match(onboarding, /Crie sua Casa/);
});
