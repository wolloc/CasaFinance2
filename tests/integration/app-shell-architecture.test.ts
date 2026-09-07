import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const app = fs.readFileSync(path.join(process.cwd(), 'src/App.tsx'), 'utf8');

test('root app mounts only the Supabase authentication boundary', () => {
  assert.match(app, /SupabaseAuthProvider/);
  assert.match(app, /useSupabaseAuth/);
  assert.match(app, /CasaFinanceApp/);
  assert.doesNotMatch(app, /\bAuthProvider\b/);
  assert.doesNotMatch(app, /\buseAuth\b/);
  assert.doesNotMatch(app, /\bAppContent\b/);
  assert.doesNotMatch(app, /\bApiService\b/);
});
