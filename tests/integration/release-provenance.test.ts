import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const script = fs.readFileSync(
  path.join(process.cwd(), 'scripts/create-release-manifest.mjs'),
  'utf8',
);
const workflow = fs.readFileSync(
  path.join(process.cwd(), '.github/workflows/ci.yml'),
  'utf8',
);

test('release manifest records commit, Supabase origin and SHA-256 hashes without browser keys', () => {
  assert.match(script, /commit_sha:\s*commitSha/);
  assert.match(script, /supabase_origin:\s*supabaseOrigin/);
  assert.match(script, /sha256:/);
  assert.doesNotMatch(script, /PUBLISHABLE_KEY|ANON_KEY|SERVICE_ROLE|SECRET_KEY/);
});

test('CI generates provenance only after the production build', () => {
  const buildIndex = workflow.indexOf('- name: Production build');
  const manifestIndex = workflow.indexOf('- name: Generate release provenance manifest');
  assert.ok(buildIndex >= 0, 'production build step must exist');
  assert.ok(manifestIndex > buildIndex, 'release provenance must be generated after build');
  assert.match(workflow, /run:\s*npm run release:manifest/);
});
