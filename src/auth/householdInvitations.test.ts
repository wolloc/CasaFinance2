import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import type { Session, SupabaseClient } from '@supabase/supabase-js';
import { acceptHouseholdInvitation, createHouseholdInvitation, friendlyInvitationError, invitationTokenFromSearch, previewHouseholdInvitation } from './householdInvitations.js';

const session = { user: { id: 'auth-user-123' } } as Session;

test('cria convite usando apenas a sessao e nunca envia user_id', async () => {
  let rpcName = '';
  let rpcArgs: Record<string, unknown> = {};
  const client = {
    rpc: async (name: string, args: Record<string, unknown>) => {
      rpcName = name;
      rpcArgs = args;
      return { data: { invitation_id: 'invitation-1', household_id: 'household-1', token: 'a'.repeat(64), expires_at: '2026-09-10T00:00:00Z' }, error: null };
    },
  } as unknown as SupabaseClient;

  const result = await createHouseholdInvitation(client, session, ' Guilherme@EXAMPLE.com ');

  assert.equal(rpcName, 'create_household_invitation');
  assert.deepEqual(rpcArgs, { invited_email: 'Guilherme@EXAMPLE.com' });
  assert.equal('user_id' in rpcArgs, false);
  assert.equal(result.householdId, 'household-1');
});

test('aceita convite enviando somente token e identidade da sessao', async () => {
  let rpcArgs: Record<string, unknown> = {};
  const client = {
    rpc: async (_name: string, args: Record<string, unknown>) => {
      rpcArgs = args;
      return { data: [{ status: 'accepted', household_id: 'household-1' }], error: null };
    },
  } as unknown as SupabaseClient;

  assert.deepEqual(await acceptHouseholdInvitation(client, session, 'https://finance.example/?invite=token'), { status: 'accepted', householdId: 'household-1' });
  assert.deepEqual(rpcArgs, { invitation_token: 'token' });
  assert.equal('user_id' in rpcArgs, false);
});

test('reconhece o token da URL propria e mantem compatibilidade com links antigos', () => {
  assert.equal(invitationTokenFromSearch('?invitation=abc123'), 'abc123');
  assert.equal(invitationTokenFromSearch('?invite=legacy123'), 'legacy123');
  assert.equal(invitationTokenFromSearch('?other=value'), '');
});

test('preview retorna somente nome da Casa e expiracao sem enviar identidade', async () => {
  let rpcArgs: Record<string, unknown> = {};
  const client = { rpc: async (_name: string, args: Record<string, unknown>) => {
    rpcArgs = args;
    return { data: [{ household_name: 'Casa Azul', expires_at: '2026-09-10T00:00:00Z' }], error: null };
  } } as unknown as SupabaseClient;

  assert.deepEqual(await previewHouseholdInvitation(client, session, 'a'.repeat(64)), {
    householdName: 'Casa Azul', expiresAt: '2026-09-10T00:00:00Z',
  });
  assert.deepEqual(rpcArgs, { invitation_token: 'a'.repeat(64) });
  assert.equal('user_id' in rpcArgs, false);
});

test('traduz erros de convite para mensagens de usuario', () => {
  assert.equal(friendlyInvitationError(new Error('invitation has expired')), 'Este convite expirou. Peça um novo convite ao proprietário.');
  assert.equal(friendlyInvitationError(new Error('user already belongs to another household')), 'Você já pertence a outra Casa.');
});

test('migration protege token, authorization, expiração e concorrencia no banco', async () => {
  const sql = await readFile(new URL('../../supabase/migrations/202609030008_household_invitations.sql', import.meta.url), 'utf8');
  assert.match(sql, /token_hash bytea/i);
  assert.match(sql, /digest\(convert_to\(plain_token, 'UTF8'\), 'sha256'\)/i);
  assert.match(sql, /gen_random_bytes\(32\)/i);
  assert.match(sql, /returning invitation\.id, invitation\.household_id, plain_token, invitation\.expires_at;/i);
  assert.doesNotMatch(sql, /returning\s+id,\s*household_id,\s*generated_token,\s*expires_at/i);
  assert.match(sql, /expires_at timestamptz/i);
  assert.match(sql, /auth\.uid\(\)/i);
  assert.match(sql, /pg_advisory_xact_lock/i);
  assert.match(sql, /for update/i);
  assert.match(sql, /stored_invitation\.token_hash/i);
  assert.match(sql, /stored_invitation\.id = invitation\.id/i);
  assert.match(sql, /household member limit reached/i);
  assert.match(sql, /revoke all on table public\.household_invitations/i);
  assert.doesNotMatch(sql, /service_role/i);
  assert.doesNotMatch(sql, /using \(true\)/i);
});

test('migration corretiva qualifica pgcrypto e preserva o contrato das RPCs', async () => {
  const sql = await readFile(new URL('../../supabase/migrations/202609030009_fix_invitation_token_generation.sql', import.meta.url), 'utf8');
  const originalSql = await readFile(new URL('../../supabase/migrations/202609030008_household_invitations.sql', import.meta.url), 'utf8');
  assert.match(sql, /create or replace function public\.create_household_invitation\(invited_email text default null\)/i);
  assert.match(sql, /returns table \(invitation_id uuid, household_id uuid, token text, expires_at timestamptz\)/i);
  assert.match(sql, /extensions\.gen_random_bytes\(32\)/i);
  assert.match(sql, /extensions\.digest\(convert_to\(plain_token, 'UTF8'\), 'sha256'\)/i);
  assert.match(sql, /extensions\.digest\(convert_to\(invitation_token, 'UTF8'\), 'sha256'\)/i);
  assert.match(sql, /insert into public\.household_invitations as invitation/i);
  assert.match(sql, /returning invitation\.id, invitation\.household_id, plain_token, invitation\.expires_at;/i);
  assert.doesNotMatch(sql, /(?:^|[^.])gen_random_bytes\(32\)/im);
  assert.doesNotMatch(sql, /(?:^|[^.])digest\(convert_to\(/im);
  assert.match(sql, /security definer/i);
  assert.match(sql, /set search_path = public, pg_temp/i);
  assert.match(sql, /auth\.uid\(\)/i);
  assert.match(originalSql, /alter table public\.household_invitations enable row level security/i);
  assert.doesNotMatch(sql, /service_role/i);
  const insertStatement = sql.match(/insert into public\.household_invitations[\s\S]*?returning invitation\.id/i)?.[0] ?? '';
  assert.match(insertStatement, /token_hash/i);
  assert.doesNotMatch(insertStatement, /\btoken\b(?!_hash)/i);
});

test('migration 010 oferece preview minimo e preserva os contratos de seguranca', async () => {
  const sql = await readFile(new URL('../../supabase/migrations/202609030010_preview_household_invitation.sql', import.meta.url), 'utf8');
  assert.match(sql, /returns table \(household_name text, expires_at timestamptz\)/i);
  assert.match(sql, /security definer/i);
  assert.match(sql, /set search_path = public, pg_temp/i);
  assert.match(sql, /auth\.uid\(\)/i);
  assert.match(sql, /extensions\.digest\(convert_to\(invitation_token, 'UTF8'\), 'sha256'\)/i);
  assert.match(sql, /accepted_at is not null/i);
  assert.match(sql, /expires_at <= now\(\)/i);
  assert.match(sql, /invited_email is not null/i);
  assert.match(sql, /grant execute on function public\.preview_household_invitation\(text\) to authenticated/i);
  assert.doesNotMatch(sql, /returns table[^;]*(owner|member_id|email|token_hash)/i);
  assert.doesNotMatch(sql, /service_role/i);
  assert.doesNotMatch(sql, /insert into public\.household_invitations/i);
});

test('onboarding prioriza convite, confirma membership e nao contem forms aninhados', async () => {
  const source = await readFile(new URL('../components/auth/PendingHouseholdScreen.tsx', import.meta.url), 'utf8');
  assert.match(source, /Você recebeu um convite/);
  assert.match(source, /Entrar na \{invitePreview\?\.householdName\}/);
  assert.match(source, /Você agora faz parte da/);
  assert.match(source, /Seu papel:[\s\S]*'Membro'/);
  assert.match(source, /if \(invitePreview \|\| previewLoading\) return/);
  let formDepth = 0;
  let maximumFormDepth = 0;
  for (const tag of source.matchAll(/<\/?form\b/g)) {
    formDepth += tag[0].startsWith('</') ? -1 : 1;
    maximumFormDepth = Math.max(maximumFormDepth, formDepth);
  }
  assert.equal(maximumFormDepth, 1);
  assert.equal(formDepth, 0);
  assert.doesNotMatch(source, /console\.(?:log|info|debug|warn|error)/);
  const providerSource = await readFile(new URL('../context/SupabaseAuthContext.tsx', import.meta.url), 'utf8');
  assert.match(providerSource, /acceptHouseholdInvitation[\s\S]*setHousehold\(await findExistingHousehold/);
  assert.match(providerSource, /setHouseholdRefreshVersion/);
});
