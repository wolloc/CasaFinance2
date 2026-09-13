import type { SupabaseClient } from '@supabase/supabase-js';

const pendingRequestKeys = new Map<string, string>();
const pendingIntentValues = new Map<string, unknown>();

function signature(operation: string, identity: readonly unknown[]) {
  return `${operation}:${JSON.stringify(identity)}`;
}

/**
 * Returns one request key for the same still-uncertain user intent.
 * A failed/ambiguous transport keeps the key so a retry reaches the backend
 * with the same idempotency identity. Confirmed success must release it.
 */
export function getRetryStableRequestKey(operation: string, identity: readonly unknown[]) {
  const key = signature(operation, identity);
  const existing = pendingRequestKeys.get(key);
  if (existing) return existing;
  const requestKey = `${operation}:${crypto.randomUUID()}`;
  pendingRequestKeys.set(key, requestKey);
  return requestKey;
}

export function getRetryStableIntentValue<T>(operation: string, identity: readonly unknown[], factory: () => T): T {
  const key = signature(operation, identity);
  if (pendingIntentValues.has(key)) return pendingIntentValues.get(key) as T;
  const value = factory();
  pendingIntentValues.set(key, value);
  return value;
}

export function releaseRetryStableRequestKey(operation: string, identity: readonly unknown[]) {
  const key = signature(operation, identity);
  pendingRequestKeys.delete(key);
  pendingIntentValues.delete(key);
}

export async function runRetryStableRpc(
  client: SupabaseClient,
  operation: string,
  identity: readonly unknown[],
  rpcName: string,
  params: Record<string, unknown>,
) {
  const requestKey = getRetryStableRequestKey(operation, identity);
  const payload = { ...params, p_request_key: requestKey };
  let result = await client.rpc(rpcName, payload);
  const ambiguous = result.error && /statement timeout|canceling statement|network|fetch|connection/i.test(result.error.message ?? '');
  // A timeout may arrive after PostgreSQL committed. One automatic replay with
  // the same command key asks the canonical RPC for the existing result instead
  // of asking the user to create a second economic fact.
  if (ambiguous) result = await client.rpc(rpcName, payload);
  if (result.error) {
    if (/statement timeout|canceling statement|network|fetch|connection/i.test(result.error.message ?? '')) {
      throw new Error('Não foi possível confirmar a resposta do Casa. Não registre a despesa novamente; aguarde e confira em Gastos.');
    }
    throw result.error;
  }
  releaseRetryStableRequestKey(operation, identity);
  return result.data as string;
}
