import test from 'node:test';
import assert from 'node:assert/strict';
import { runRetryStableRpc } from './retryIdempotency.ts';

test('resposta ambígua repete automaticamente a mesma chave idempotente', async () => {
  const calls: Array<Record<string, unknown>> = [];
  const client = { rpc: async (_name: string, payload: Record<string, unknown>) => {
    calls.push(payload);
    return calls.length === 1
      ? { data: null, error: { message: 'canceling statement due to statement timeout' } }
      : { data: 'transaction-id', error: null };
  } };
  const result = await runRetryStableRpc(client as never, 'expense-test', ['same-intent'], 'expense_rpc', { amount: '10.00' });
  assert.equal(result, 'transaction-id');
  assert.equal(calls.length, 2);
  assert.equal(calls[0].p_request_key, calls[1].p_request_key);
});

test('dupla resposta ambígua não incentiva novo lançamento', async () => {
  const client = { rpc: async () => ({ data: null, error: { message: 'statement timeout' } }) };
  await assert.rejects(
    runRetryStableRpc(client as never, 'expense-uncertain', ['same-intent'], 'expense_rpc', {}),
    /Não registre a despesa novamente/,
  );
});
