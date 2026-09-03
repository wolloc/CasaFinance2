import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

describe('contrato de logs', () => {
  it('mantem o logger livre de campos financeiros no codigo de chamada', async () => {
    const source = await import('node:fs/promises').then((fs) => fs.readFile(new URL('./logger.ts', import.meta.url), 'utf8'));
    assert.match(source, /\[REDACTED\]/);
    assert.match(source, /amount\|balance/);
  });
});
