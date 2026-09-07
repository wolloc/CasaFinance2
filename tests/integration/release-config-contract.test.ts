import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import test from 'node:test';

const script = path.join(process.cwd(), 'scripts/validate-release-env.mjs');

function run(env: Record<string, string>) {
  return spawnSync(process.execPath, [script], {
    env: { ...process.env, VITE_SUPABASE_URL: '', VITE_SUPABASE_PUBLISHABLE_KEY: '', ...env },
    encoding: 'utf8',
  });
}

test('accepts an HTTPS Supabase URL with a publishable browser key', () => {
  const result = run({
    VITE_SUPABASE_URL: 'https://release-contract.supabase.co',
    VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_release_contract',
  });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /valid public Supabase config/i);
});

test('rejects missing, placeholder, local and privileged-looking release config', () => {
  assert.notEqual(run({}).status, 0);
  assert.notEqual(run({
    VITE_SUPABASE_URL: 'https://your-project-ref.supabase.co',
    VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_replace_me',
  }).status, 0);
  assert.notEqual(run({
    VITE_SUPABASE_URL: 'http://127.0.0.1:54321',
    VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_local',
  }).status, 0);
  assert.notEqual(run({
    VITE_SUPABASE_URL: 'https://release-contract.supabase.co',
    VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_secret_should_never_be_public',
  }).status, 0);
});
