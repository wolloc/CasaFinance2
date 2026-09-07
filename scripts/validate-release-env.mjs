const url = (process.env.VITE_SUPABASE_URL ?? '').trim();
const key = (process.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? '').trim();
const allowLocal = process.env.ALLOW_LOCAL_SUPABASE === 'true';

const fail = (message) => {
  console.error(`[release-config] ${message}`);
  process.exit(1);
};

if (!url) fail('VITE_SUPABASE_URL is required.');
if (!key) fail('VITE_SUPABASE_PUBLISHABLE_KEY is required.');

let parsed;
try {
  parsed = new URL(url);
} catch {
  fail('VITE_SUPABASE_URL must be a valid absolute URL.');
}

if (!allowLocal && parsed.protocol !== 'https:') {
  fail('Release Supabase URL must use HTTPS. Set ALLOW_LOCAL_SUPABASE=true only for local development/tests.');
}

if (!allowLocal && ['localhost', '127.0.0.1', '0.0.0.0'].includes(parsed.hostname)) {
  fail('Release Supabase URL cannot point to localhost.');
}

if (/your-project|replace|example\.com/i.test(url)) {
  fail('VITE_SUPABASE_URL still contains a placeholder.');
}

if (!key.startsWith('sb_publishable_')) {
  fail('Release browser key must be a Supabase sb_publishable_ key. Never expose secret/service-role keys in VITE_* variables.');
}

if (/replace|secret|service[_-]?role/i.test(key)) {
  fail('VITE_SUPABASE_PUBLISHABLE_KEY looks like a placeholder or privileged key.');
}

console.log(`[release-config] valid public Supabase config for ${parsed.origin}`);
