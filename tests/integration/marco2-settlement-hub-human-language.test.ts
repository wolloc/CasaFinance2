import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../../src/components/app/SettlementHub.tsx', import.meta.url), 'utf8');

test('settlement hub explains realized and projected positions without funding jargon', () => {
  assert.match(source, /Veja quem precisa acertar dinheiro com quem/);
  assert.match(source, /Entre nós · já aconteceu/);
  assert.match(source, /Entre nós · pode acontecer depois/);
  assert.match(source, /É uma previsão\. O valor pode mudar quando o pagamento real acontecer/);
  assert.doesNotMatch(source, />.*funding.*</i);
});

test('settlement hub empty state is reassuring but not misleading', () => {
  assert.match(source, /Tudo certo entre as pessoas por enquanto/);
  assert.match(source, /Quando alguém precisar devolver, receber ou pagar algum valor/);
});

test('read failure remains explicit and retryable', () => {
  assert.match(source, /não vai presumir que uma dívida foi resolvida ou que não há nada em aberto/);
  assert.match(source, /Tentar novamente/);
});
