import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const workflow = fs.readFileSync(
  path.join(process.cwd(), '.github/workflows/staging-smoke.yml'),
  'utf8',
);
const manifestScript = fs.readFileSync(
  path.join(process.cwd(), 'scripts/create-release-manifest.mjs'),
  'utf8',
);

test('staging smoke is automatic on main, keeps manual override and binds the exact release SHA', () => {
  assert.match(workflow, /push:\n\s+branches:\n\s+- main/);
  assert.match(workflow, /workflow_dispatch:/);
  assert.match(workflow, /release_sha:/);
  assert.match(workflow, /required:\s*false/);
  assert.match(workflow, /\^\[0-9a-f\]\{40\}\$/);
  assert.match(workflow, /environment:\s*staging/);
  assert.match(workflow, /vars\.STAGING_SUPABASE_URL/);
  assert.match(workflow, /vars\.STAGING_SUPABASE_PUBLISHABLE_KEY/);
  assert.match(workflow, /RELEASE_COMMIT_SHA:\s*\$\{\{ inputs\.release_sha \|\| github\.sha \}\}/);
  assert.match(workflow, /ref:\s*\$\{\{ env\.RELEASE_COMMIT_SHA \}\}/);
  assert.match(workflow, /git rev-parse HEAD/);
});

test('staging smoke uses only public browser credentials and accepts safe anonymous isolation outcomes', () => {
  assert.doesNotMatch(workflow, /SERVICE_ROLE|SECRET_KEY|DATABASE_URL|DB_PASSWORD/);
  assert.match(workflow, /validate-release-env\.mjs/);
  assert.match(workflow, /auth\/v1\/settings/);
  assert.match(workflow, /rest\/v1\/households\?select=id&limit=1/);
  assert.match(workflow, /--write-out '%\{http_code\}'/);
  assert.match(workflow, /401\|403/);
  assert.match(workflow, /x\.length!==0/);
  assert.match(workflow, /unexpected anonymous household response/);
});

test('staging artifact records and retains the exact candidate SHA', () => {
  assert.match(workflow, /RELEASE_COMMIT_SHA:\s*\$\{\{ inputs\.release_sha \|\| github\.sha \}\}/);
  assert.match(workflow, /npm run release:manifest/);
  assert.match(workflow, /casa-finance-staging-\$\{\{ env\.RELEASE_COMMIT_SHA \}\}/);
  assert.match(workflow, /retention-days:\s*14/);
  assert.match(manifestScript, /RELEASE_COMMIT_SHA \|\| process\.env\.GITHUB_SHA/);
});
