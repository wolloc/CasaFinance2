import assert from 'node:assert/strict';
import test from 'node:test';
import { readPublicSupabaseConfig } from './supabaseConfig.js';

test('lê somente a URL e a chave publicável do frontend', () => {
  assert.deepEqual(readPublicSupabaseConfig({
    VITE_SUPABASE_URL: 'https://example.supabase.co',
    VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_example',
    DATABASE_URL: 'must-not-be-used',
  }), {
    url: 'https://example.supabase.co',
    publishableKey: 'sb_publishable_example',
  });
});

test('não inicializa com configuração incompleta', () => {
  assert.equal(readPublicSupabaseConfig({ VITE_SUPABASE_URL: 'https://example.supabase.co' }), null);
});
