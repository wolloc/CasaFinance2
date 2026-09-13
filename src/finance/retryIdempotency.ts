import type { SupabaseClient } from '@supabase/supabase-js';

const pendingRequestKeys = new Map<string, string>();
const pendingIntentValues = new Map<string, unknown>();

function signature(operation: string, identity: readonly unknown[]) {
  return `${operation}:${JSON.stringify(identity)}`;
}

function backendOperationForRpc(rpcName: string) {
  return rpcName.endsWith('_idempotent') ? rpcName.slice(0, -'_idempotent'.length) : rpcName;
}

function isTransportFailure(message: string) {
  return /network|failed to fetch|fetch failed|connection (?:closed|reset)|econnreset/i.test(message);
}

function isStatementTimeout(message: string) {
  return /statement timeout|canceling statement due to statement timeout/i.test(message);
}

function isAmbiguousFailure(message: string) {
  return isTransportFailure(message) || isStatementTimeout(message);
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

async function reconcileCommittedCommand(
  client: SupabaseClient,
  rpcName: string,
  params: Record<string, unknown>,
  requestKey: string,
) {
  const householdId = typeof params.p_household_id === 'string' ? params.p_household_id : null;
  if (!householdId) return null;

  try {
    const response = await client.from('financial_command_requests')
      .select('result_id')
      .eq('household_id', householdId)
      .eq('operation', backendOperationForRpc(rpcName))
      .eq('request_key', requestKey)
      .maybeSingle();
    if (response.error || !response.data?.result_id) return null;
    return response.data.result_id as string;
  } catch {
    // Reconciliation is read-only and best effort. Failure to read the receipt
    // must never trigger an unsafe new request identity.
    return null;
  }
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
  if (!result.error) {
    releaseRetryStableRequestKey(operation, identity);
    return result.data as string;
  }

  let message = result.error.message ?? '';
  if (isAmbiguousFailure(message)) {
    const reconciled = await reconcileCommittedCommand(client, rpcName, params, requestKey);
    if (reconciled) {
      releaseRetryStableRequestKey(operation, identity);
      return reconciled;
    }
  }

  // Only transport failures are replayed automatically. PostgreSQL statement
  // timeout is a database result and must never trigger a blind second execution.
  // A transport replay keeps the exact same idempotency key.
  if (isTransportFailure(message)) {
    result = await client.rpc(rpcName, payload);
    if (!result.error) {
      releaseRetryStableRequestKey(operation, identity);
      return result.data as string;
    }
    message = result.error.message ?? '';
    if (isAmbiguousFailure(message)) {
      const reconciled = await reconcileCommittedCommand(client, rpcName, params, requestKey);
      if (reconciled) {
        releaseRetryStableRequestKey(operation, identity);
        return reconciled;
      }
    }
  }

  if (isAmbiguousFailure(message)) {
    throw new Error('Não foi possível confirmar a resposta do Casa. Não registre a despesa novamente; aguarde e confira em Gastos.');
  }
  throw result.error;
}
