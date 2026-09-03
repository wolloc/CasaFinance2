import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import type { Server } from 'node:http';
import { app } from '../../server/index.js';

let server: Server;
let baseUrl = '';

before(async () => {
  server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Servidor de teste nao iniciou em uma porta TCP.');
  baseUrl = `http://127.0.0.1:${address.port}`;
});
after(() => new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())));

describe('API e isolamento equivalente a RLS', () => {
  it('informa saude e dependencias sem retornar segredos', async () => {
    const response = await fetch(`${baseUrl}/api/health`);
    const body = await response.json() as { status: string; checks: Record<string, string> };
    assert.equal(response.status, 200);
    assert.equal(body.status, 'ok');
    assert.equal(JSON.stringify(body).includes('GEMINI_API_KEY'), false);
  });

  it('permite membro ativo consultar sua casa', async () => {
    const response = await fetch(`${baseUrl}/api/households/hh-wallace-gui-001`, { headers: { 'x-user-id': 'usr-wallace-001' } });
    assert.equal(response.status, 200);
  });

  it('bloqueia leitura cruzada entre casas', async () => {
    const response = await fetch(`${baseUrl}/api/households/hh-other-isolated-002`, { headers: { 'x-user-id': 'usr-wallace-001' } });
    assert.equal(response.status, 403);
  });

  it('retorna JSON para rota inexistente', async () => {
    const response = await fetch(`${baseUrl}/api/not-found`);
    assert.equal(response.status, 404);
    assert.match(response.headers.get('content-type') ?? '', /application\/json/);
  });

  it('envia headers defensivos e bloqueia origem desconhecida', async () => {
    const regular = await fetch(`${baseUrl}/api/health`);
    assert.equal(regular.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(regular.headers.get('x-frame-options'), 'DENY');

    const crossOrigin = await fetch(`${baseUrl}/api/health`, { headers: { origin: 'https://evil.invalid' } });
    assert.equal(crossOrigin.status, 403);
  });
});
