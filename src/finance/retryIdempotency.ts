const pendingRequestKeys = new Map<string, string>();

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

export function releaseRetryStableRequestKey(operation: string, identity: readonly unknown[]) {
  pendingRequestKeys.delete(signature(operation, identity));
}
