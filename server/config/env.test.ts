import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { loadConfig } from './env.js';

describe('validacao de ambiente', () => {
  it('aceita development sem segredos e converte a porta', () => assert.equal(loadConfig({ APP_ENV: 'development', PORT: '4000' }).port, 4000));
  it('rejeita porta invalida', () => assert.throws(() => loadConfig({ PORT: 'zero' }), /PORT/));
  it('impede production sem persistencia configurada', () => assert.throws(() => loadConfig({ APP_ENV: 'production' }), /DATABASE_URL/));
  it('aceita production completa sem expor valores', () => assert.equal(loadConfig({ APP_ENV: 'production', DATABASE_URL: 'postgres://private', SUPABASE_URL: 'https://example.invalid', SUPABASE_PUBLISHABLE_KEY: 'public-test-key', APP_URL: 'https://finance.example.invalid' }).environment, 'production'));
  it('exige a publishable key em staging', () => assert.throws(() => loadConfig({ APP_ENV: 'staging', DATABASE_URL: 'postgres://private', SUPABASE_URL: 'https://supabase.example.invalid', APP_URL: 'https://finance.example.invalid' }), /SUPABASE_PUBLISHABLE_KEY/));
  it('rejeita HTTP em staging', () => assert.throws(() => loadConfig({ APP_ENV: 'staging', DATABASE_URL: 'postgres://private', SUPABASE_URL: 'https://supabase.example.invalid', SUPABASE_PUBLISHABLE_KEY: 'public-test-key', APP_URL: 'http://example.invalid' }), /HTTPS/));
  it('normaliza a allowlist de CORS', () => assert.deepEqual(loadConfig({ CORS_ORIGINS: 'https://one.invalid, https://two.invalid' }).corsOrigins, ['https://one.invalid', 'https://two.invalid']));
});
