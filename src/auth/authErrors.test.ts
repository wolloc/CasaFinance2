import assert from 'node:assert/strict';
import test from 'node:test';
import { friendlyAuthError } from './authErrors.js';

test('traduz credenciais inválidas sem revelar detalhes técnicos', () => {
  assert.equal(friendlyAuthError(new Error('Invalid login credentials')), 'E-mail ou senha incorretos.');
});

test('usa mensagem segura para erro desconhecido', () => {
  assert.equal(friendlyAuthError(new Error('internal server details')), 'Não foi possível autenticar agora. Tente novamente.');
});
