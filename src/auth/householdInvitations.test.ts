import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import type { Session, SupabaseClient } from '@supabase/supabase-js';
import { acceptHouseholdInvitation, createHouseholdInvitation, friendlyInvitationError } from './householdInvitations.js';

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

test('traduz erros de convite para mensagens de usuario', () => {
  assert.equal(friendlyInvitationError(new Error('invitation has expired')), 'Este convite expirou. Peça um novo convite ao proprietário.');
  assert.equal(friendlyInvitationError(new Error('user already belongs to another household')), 'Você já pertence a outra Casa.');
});

test('migration protege token, authorization, expiração e concorrencia no banco', async () => {
  const sql = await readFile(new URL('../../supabase/migrations/202609030008_household_invitations.sql', import.meta.url), 'utf8');
  assert.match(sql, /token_hash bytea/i);
  assert.match(sql, /digest\(convert_to\(generated_token, 'UTF8'\), 'sha256'\)/i);
  assert.match(sql, /gen_random_bytes\(32\)/i);
  assert.match(sql, /expires_at timestamptz/i);
  assert.match(sql, /auth\.uid\(\)/i);
  assert.match(sql, /pg_advisory_xact_lock/i);
  assert.match(sql, /for update/i);
  assert.match(sql, /household member limit reached/i);
  assert.match(sql, /revoke all on table public\.household_invitations/i);
  assert.doesNotMatch(sql, /service_role/i);
  assert.doesNotMatch(sql, /using \(true\)/i);
});