import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source=await readFile(new URL('../../src/components/app/FinancialPartiesSettings.tsx',import.meta.url),'utf8');

test('external people use human language and a useful empty state',()=>{
  assert.match(source,/Outras pessoas/);
  assert.match(source,/dinheiro a receber, pagar ou dividir/);
  assert.match(source,/Ninguém de fora da Casa cadastrado ainda/);
});

test('failed read blocks creation until a valid reread',()=>{
  assert.match(source,/if\(loadError\|\|loading\)/);
  assert.match(source,/!loading&&!loadError&&<form/);
  assert.match(source,/não permitir um novo cadastro até conferir novamente/);
  assert.match(source,/Tentar novamente/);
});

test('read failure clears stale people instead of showing them',()=>{
  assert.match(source,/catch\{setRows\(\[\]\);setLoadError\(true\)\}/);
});
