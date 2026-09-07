import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const workflow = fs.readFileSync(
  path.join(process.cwd(), '.github/workflows/staging-smoke.yml'),
  'utf8',
);

test('staging smoke is manual and bound to the staging environment', () => {
  assert.match(workflow, /workflow_dispatch:/);
  assert.match(workflow, /environment:\s*staging/);
  assert.match(workflow, /vars\.STAGING_SUPABASE_URL/);
  assert.match(workflow, /vars\.STAGING_SUPABASE_PUBLISHABLE_KEY/);
});

test('staging smoke uses only public browser credentials and checks anonymous isolation', () => {
  assert.doesNotMatch(workflow, /SERVICE_ROLE|SECRET_KEY|DATABASE_URL|DB_PASSWORD/);
  assert.match(workflow, /validate-release-env\.mjs/);
  assert.match(workflow, /auth\/v1\/settings/);
  assert.match(workflow, /rest\/v1\/households\?select=id&limit=1/);
  assert.match(workflow, /x\.length!==0/);
});
