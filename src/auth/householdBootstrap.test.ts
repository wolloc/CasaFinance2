import assert from 'node:assert/strict';
import test from 'node:test';
import type { Session, SupabaseClient } from '@supabase/supabase-js';
import { bootstrapHousehold } from './householdBootstrap.js';

const session = { user: { id: 'auth-user-123' } } as Session;

function createClient(options: {
  membership?: { household_id: string; profile_id: string } | null;
  household?: { id: string; name: string } | null;
  rpcData?: { id: string; name: string } | null;
  rpcError?: Error | null;
  onRpc?: (name: string, args: Record<string, string>) => void;
}) {
  let membership = options.membership ?? null;
  const calls: Array<{ table: string; operation: string; value?: string }> = [];
  const query = (table: string) => {
    const builder = {
      select: () => builder,
      eq: (_column: string, value: string) => {
        calls.push({ table, operation: 'eq', value });
        return builder;
      },
      is: () => builder,
      limit: () => builder,
      maybeSingle: async () => ({
        data: table === 'household_members' ? membership : options.household,
        error: null,
      }),
    };
    return builder;
  };

  const client = {
    from: query,
    rpc: async (name: string, args: Record<string, string>) => {
      options.onRpc?.(name, args);
      if (options.rpcError) {
        membership = options.membership ?? null;
        return { data: null, error: options.rpcError };
      }
      membership = { household_id: options.rpcData?.id ?? 'household-created', profile_id: session.user.id };
      options.household = options.rpcData;
      return { data: options.rpcData ?? null, error: null };
    },
  } as unknown as SupabaseClient;

  return { client, calls };
}

test('cria Casa usando a identidade da sessão e confirma a associação', async () => {
  let rpcName = '';
  let rpcArgs: Record<string, string> | undefined;
  const { client, calls } = createClient({
    rpcData: { id: 'household-123', name: 'Nossa Casa' },
    onRpc: (name, args) => { rpcName = name; rpcArgs = args; },
  });

  const result = await bootstrapHousehold(client, session, ' Nossa Casa ', ' Wallace ');

  assert.deepEqual(result, { householdId: 'household-123', householdName: 'Nossa Casa', alreadyExisted: false });
  assert.equal(rpcName, 'bootstrap_household_with_profile');
  assert.deepEqual(rpcArgs, {
    household_name: 'Nossa Casa',
    display_name: 'Wallace',
    household_currency: 'BRL',
    household_timezone: 'America/Sao_Paulo',
  });
  assert.ok(calls.some((call) => call.table === 'household_members' && call.value === session.user.id));
  assert.equal(calls.some((call) => call.table === 'profiles'), false);
});

test('não chama RPC quando o usuário já tem Casa', async () => {
  let rpcCalled = false;
  const { client } = createClient({
    membership: { household_id: 'existing-household', profile_id: session.user.id },
    household: { id: 'existing-household', name: 'Casa existente' },
    onRpc: () => { rpcCalled = true; },
  });

  const result = await bootstrapHousehold(client, session, 'Outra Casa', 'Wallace');

  assert.deepEqual(result, { householdId: 'existing-household', householdName: 'Casa existente', alreadyExisted: true });
  assert.equal(rpcCalled, false);
});

test('trata retry após RPC bem-sucedido sem criar duplicidade', async () => {
  const options = {
    rpcData: { id: 'household-created', name: 'Nossa Casa' },
  };
  const { client } = createClient(options);
  const first = await bootstrapHousehold(client, session, 'Nossa Casa', 'Wallace');
  options.rpcData = null;
  const second = await bootstrapHousehold(client, session, 'Nossa Casa', 'Wallace');

  assert.equal(first.alreadyExisted, false);
  assert.equal(second.alreadyExisted, true);
});

test('propaga erro da RPC quando nenhuma associação foi criada', async () => {
  const { client } = createClient({ rpcError: new Error('database failure') });

  await assert.rejects(() => bootstrapHousehold(client, session, 'Nossa Casa', 'Wallace'), /database failure/);
});

test('recusa criação sem sessão autenticada', async () => {
  const { client } = createClient({});
  await assert.rejects(() => bootstrapHousehold(client, null, 'Nossa Casa', 'Wallace'), /Sessão expirada/);
});
