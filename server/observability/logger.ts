type LogLevel = 'info' | 'warn' | 'error';

const blockedKeys = /amount|balance|description|merchant|document|email|name|token|secret|key|authorization/i;

function sanitize(fields: Readonly<Record<string, unknown>>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, blockedKeys.test(key) ? '[REDACTED]' : value]));
}

export function log(level: LogLevel, event: string, fields: Readonly<Record<string, unknown>> = {}): void {
  const entry = JSON.stringify({ timestamp: new Date().toISOString(), level, event, ...sanitize(fields) });
  if (level === 'error') console.error(entry);
  else if (level === 'warn') console.warn(entry);
  else console.info(entry);
}
