import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { loadConfig } from './env.js';

describe('validacao de ambiente', () => {
  it('aceita development sem segredos e converte a porta', () => assert.equal(loadConfig({ APP_ENV: 'development', PORT: '4000' }).port, 4000));
  it('rejeita porta invalida', () => assert.throws(() => loadConfig({ PORT: 'zero' }), /PORT/));
  it('impede production sem persistencia configurada', () => assert.throws(() => loadConfig({ APP_ENV: 'production' }), /DATABASE_URL/));
  it('aceita production completa sem expor valores', () => assert.equal(loadConfig({ APP_ENV: 'production', DATABASE_URL: 'postgres://private', SUPABASE_URL: 'https://example.invalid' }).environment, 'production'));
});
