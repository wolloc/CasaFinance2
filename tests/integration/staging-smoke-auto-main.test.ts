import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';

const workflow=fs.readFileSync('.github/workflows/staging-smoke.yml','utf8');

test('staging smoke is deliberate and binds the exact selected release SHA',()=>{
  assert.doesNotMatch(workflow,/push:\n\s+branches:\n\s+- main/);
  assert.match(workflow,/workflow_dispatch:/);
  assert.match(workflow,/release_sha:/);
  assert.match(workflow,/required:\s*false/);
  assert.match(workflow,/RELEASE_COMMIT_SHA: \$\{\{ inputs\.release_sha \|\| github\.sha \}\}/);
  assert.match(workflow,/ref: \$\{\{ env\.RELEASE_COMMIT_SHA \}\}/);
  assert.match(workflow,/casa-finance-staging-\$\{\{ env\.RELEASE_COMMIT_SHA \}\}/);
});
