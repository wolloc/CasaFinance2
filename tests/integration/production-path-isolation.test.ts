import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const pkg = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf8')) as {
  scripts: Record<string, string>;
};

test('default dev and build scripts use Vite, not the legacy Express server', () => {
  assert.match(pkg.scripts.dev, /^vite\b/);
  assert.equal(pkg.scripts.build, 'vite build');
  assert.doesNotMatch(pkg.scripts.dev, /server\/index\.ts/);
  assert.doesNotMatch(pkg.scripts.build, /server\/index\.ts|server\.cjs/);
});

test('legacy server remains explicit and opt-in', () => {
  assert.match(pkg.scripts['dev:legacy-server'], /server\/index\.ts/);
  assert.match(pkg.scripts['build:legacy-server'], /server\/index\.ts/);
  assert.match(pkg.scripts['start:legacy-server'], /server\.cjs/);
});
