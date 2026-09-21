import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';

const workflow=fs.readFileSync('.github/workflows/staging-smoke.yml','utf8');

test('staging smoke runs automatically for the exact main release SHA',()=>{
  assert.match(workflow,/push:\n\s+branches:\n\s+- main/);
  assert.match(workflow,/RELEASE_COMMIT_SHA: \$\{\{ inputs\.release_sha \|\| github\.sha \}\}/);
  assert.match(workflow,/ref: \$\{\{ env\.RELEASE_COMMIT_SHA \}\}/);
  assert.match(workflow,/casa-finance-staging-\$\{\{ env\.RELEASE_COMMIT_SHA \}\}/);
});
