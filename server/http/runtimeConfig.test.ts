import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { renderRuntimeConfig } from './runtimeConfig.js';

describe('configuracao publica em runtime', () => {
  it('publica somente a URL e a publishable key', () => {
    const script = renderRuntimeConfig({
      supabaseUrl: 'https://project.example.invalid',
      supabasePublishableKey: 'public-test-key'
    });

    assert.match(script, /https:\/\/project\.example\.invalid/);
    assert.match(script, /public-test-key/);
    assert.doesNotMatch(script, /DATABASE_URL|service_role|secret/i);
  });

  it('neutraliza tags ao serializar valores no JavaScript', () => {
    const script = renderRuntimeConfig({
      supabaseUrl: '</script><script>alert(1)</script>',
      supabasePublishableKey: 'public-test-key'
    });

    assert.doesNotMatch(script, /<\/script>/i);
    assert.match(script, /\\u003c\/script>/);
  });
});
