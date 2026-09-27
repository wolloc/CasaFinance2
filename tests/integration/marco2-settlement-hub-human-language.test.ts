import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../../src/components/app/SettlementHub.tsx', import.meta.url), 'utf8');

test('Valores com pessoas resume relações antes de expor detalhes', () => {
  assert.match(source, /Valores com pessoas/);
  assert.match(source, /memberPairs/);
  assert.match(source, /thirdPartyGroups/);
  assert.match(source, /Wallace|memberName\(pair\.leftId\)/);
  assert.match(source, /Ver tendência/);
  assert.match(source, /Ver histórico e compromissos/);
  assert.doesNotMatch(source, /Entre vocês · posição de hoje/);
  assert.doesNotMatch(source, /Entre vocês · tendência/);
  assert.doesNotMatch(source, /Histórico entre vocês/);
  assert.doesNotMatch(source, />.*funding.*</i);
});

test('third parties show the person first and keep obligations inside the relationship', () => {
  assert.match(source, /group\.name/);
  assert.match(source, /A receber/);
  assert.match(source, /A pagar/);
  assert.match(source, /dateLabel\(group\.nearestDue\)/);
  assert.match(source, /group\.rows\.map/);
  assert.match(source, /responsibilityLabel/);
  assert.match(source, /50\/50/);
  assert.match(source, /Responsabilidade:/);
  assert.doesNotMatch(source, /deve para a Casa/);
  assert.doesNotMatch(source, /A Casa deve para/);
});

test('settlement hub empty state is compact and retry remains explicit', () => {
  assert.match(source, /Tudo equilibrado por enquanto/);
  assert.match(source, /Não foi possível conferir os valores com pessoas agora/);
  assert.match(source, /Tentar novamente/);
});

test('relationship details remain traceable without creating a new financial command', () => {
  assert.match(source, /listMemberSettlementEvents/);
  assert.match(source, /Registrar recebimento/);
  assert.match(source, /Registrar pagamento/);
  assert.doesNotMatch(source, /settleMemberPosition\(/);
});
