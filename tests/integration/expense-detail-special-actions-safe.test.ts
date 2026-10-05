import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const screen=await readFile(new URL('../../src/components/app/TransactionsScreen.tsx',import.meta.url),'utf8');

test('detalhe do gasto não promete exclusão para todo lançamento',()=>{
  assert.match(screen,/ações disponíveis/);
  assert.doesNotMatch(screen,/Editar · categoria · histórico · exclusão/);
});

test('ações especiais são isoladas para não derrubar o detalhe inteiro',()=>{
  assert.match(screen,/<ScreenErrorBoundary screenName="pagamento externo">/);
  assert.match(screen,/<ScreenErrorBoundary screenName="devolução de gasto">/);
  assert.match(screen,/<ScreenErrorBoundary screenName="devolução no cartão">/);
  assert.match(screen,/<ScreenErrorBoundary screenName="devolução após pagamento da fatura">/);
  assert.match(screen,/>Ações especiais</);
});
