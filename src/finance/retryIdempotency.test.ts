import test from 'node:test';
import assert from 'node:assert/strict';
import { runRetryStableRpc } from './retryIdempotency.ts';

function reconciliationQuery(resultId: string | null) {
  const query = {
    select: () => query,
    eq: () => query,
    maybeSingle: async () => ({ data: resultId ? { result_id: resultId } : null, error: null }),
  };
  return query;
}

test('falha ambígua de transporte repete automaticamente a mesma chave idempotente', async () => {
  const calls: Array<Record<string, unknown>> = [];
  const client = { rpc: async (_name: string, payload: Record<string, unknown>) => {
    calls.push(payload);
    return calls.length === 1
      ? { data: null, error: { message: 'Failed to fetch' } }
      : { data: 'transaction-id', error: null };
  } };
  const result = await runRetryStableRpc(client as never, 'expense-test', ['same-intent'], 'expense_rpc', { amount: '10.00' });
  assert.equal(result, 'transaction-id');
  assert.equal(calls.length, 2);
  assert.equal(calls[0].p_request_key, calls[1].p_request_key);
});

test('statement timeout não faz retry cego nem incentiva novo lançamento', async () => {
  let calls = 0;
  const client = { rpc: async () => { calls += 1; return { data: null, error: { message: 'canceling statement due to statement timeout' } }; } };
  await assert.rejects(
    runRetryStableRpc(client as never, 'expense-timeout', ['same-intent'], 'expense_rpc', {}),
    /mantenha os mesmos valores e tente novamente/,
  );
  assert.equal(calls, 1);
});

test('dupla falha de transporte não incentiva novo lançamento', async () => {
  let calls = 0;
  const client = { rpc: async () => { calls += 1; return { data: null, error: { message: 'Failed to fetch' } }; } };
  await assert.rejects(
    runRetryStableRpc(client as never, 'expense-uncertain', ['same-intent'], 'expense_rpc', {}),
    /mantenha os mesmos valores e tente novamente/,
  );
  assert.equal(calls, 2);
});

test('timeout reconcilia recibo já persistido sem executar a RPC novamente', async () => {
  const calls: Array<Record<string, unknown>> = [];
  const client = {
    rpc: async (_name: string, payload: Record<string, unknown>) => {
      calls.push(payload);
      return { data: null, error: { message: 'canceling statement due to statement timeout' } };
    },
    from: () => reconciliationQuery('committed-transaction-id'),
  };
  const result = await runRetryStableRpc(
    client as never,
    'expense-timeout-reconcile',
    ['same-intent'],
    'create_financial_transaction_idempotent',
    { p_household_id: 'household-1' },
  );
  assert.equal(result, 'committed-transaction-id');
  assert.equal(calls.length, 1);
});

test('resposta de transporte perdida reconcilia commit antes de qualquer replay', async () => {
  const calls: Array<Record<string, unknown>> = [];
  const client = {
    rpc: async (_name: string, payload: Record<string, unknown>) => {
      calls.push(payload);
      return { data: null, error: { message: 'Failed to fetch' } };
    },
    from: () => reconciliationQuery('committed-movement-id'),
  };
  const result = await runRetryStableRpc(
    client as never,
    'direct-expense-reconcile',
    ['same-intent'],
    'create_and_settle_direct_expense_idempotent',
    { p_household_id: 'household-1' },
  );
  assert.equal(result, 'committed-movement-id');
  assert.equal(calls.length, 1);
});

test('reconciliação vazia após timeout continua sem retry cego', async () => {
  let calls = 0;
  const client = {
    rpc: async () => {
      calls += 1;
      return { data: null, error: { message: 'canceling statement due to statement timeout' } };
    },
    from: () => reconciliationQuery(null),
  };
  await assert.rejects(
    runRetryStableRpc(
      client as never,
      'expense-timeout-empty-reconcile',
      ['same-intent'],
      'create_financial_transaction_idempotent',
      { p_household_id: 'household-1' },
    ),
    /mantenha os mesmos valores e tente novamente/,
  );
  assert.equal(calls, 1);
});
