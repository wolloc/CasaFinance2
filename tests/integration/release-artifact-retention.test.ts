import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const workflow = fs.readFileSync(
  path.join(process.cwd(), '.github/workflows/ci.yml'),
  'utf8',
);

test('CI retains the exact built dist only after provenance is generated', () => {
  const manifestIndex = workflow.indexOf('- name: Generate release provenance manifest');
  const artifactIndex = workflow.indexOf('- name: Retain exact release candidate artifact');
  assert.ok(manifestIndex >= 0, 'provenance step must exist');
  assert.ok(artifactIndex > manifestIndex, 'artifact must be retained after provenance is generated');
  assert.match(workflow, /uses:\s*actions\/upload-artifact@v4/);
  assert.match(workflow, /name:\s*casa-finance-release-\$\{\{ github\.sha \}\}/);
  assert.match(workflow, /path:\s*dist\//);
  assert.match(workflow, /if-no-files-found:\s*error/);
});

test('release candidate artifact retention is intentionally short-lived', () => {
  assert.match(workflow, /retention-days:\s*7/);
});
