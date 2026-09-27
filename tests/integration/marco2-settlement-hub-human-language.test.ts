import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../../src/components/app/SettlementHub.tsx', import.meta.url), 'utf8');

test('settlement hub explains realized and projected positions without funding jargon', () => {
  assert.match(source, /Veja a posição entre vocês e os valores a receber ou pagar com outras pessoas/);
  assert.match(source, /Entre vocês · posição de hoje/);
  assert.match(source, /Entre vocês · tendência/);
  assert.match(source, /É uma previsão ligada a compromissos futuros\. Ainda não é uma diferença realizada entre vocês/);
  assert.doesNotMatch(source, />.*funding.*</i);
});

test('settlement hub empty state is reassuring but not misleading', () => {
  assert.match(source, /Tudo equilibrado entre as pessoas por enquanto/);
  assert.match(source, /Quando surgir uma diferença entre vocês ou um valor com outra pessoa/);
});

test('read failure remains explicit and retryable', () => {
  assert.match(source, /não vai presumir que uma posição foi resolvida ou que não há nada em aberto/);
  assert.match(source, /Tentar novamente/);
});


test('settlement hub makes each member position traceable without creating a new financial action', () => {
  assert.match(source, /Ver de onde vem esse valor/);
  assert.match(source, /Ver compromissos que podem gerar esta diferença/);
  assert.match(source, /listMemberSettlementEvents/);
  assert.doesNotMatch(source, /settleMemberPosition\(/);
});
