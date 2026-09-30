import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const app=await readFile(new URL('../../src/components/app/CasaFinanceApp.tsx',import.meta.url),'utf8');

test('contextual financial actions open over the current surface instead of replacing it',()=>{
  assert.match(app,/screen==='new-adjustment'&&<div role="dialog" aria-modal="true" aria-label="Ação financeira"/);
  assert.match(app,/Fechar ação financeira/);
  assert.match(app,/onClick=\{\(\)=>setScreen\(returnTab\)\}/);
  assert.match(app,/screen==='home'\|\|\(screen==='new-adjustment'&&returnTab==='home'\)/);
  assert.match(app,/screen==='expenses'\|\|\(screen==='new-adjustment'&&returnTab==='expenses'\)/);
  assert.match(app,/screen==='income'\|\|\(screen==='new-adjustment'&&returnTab==='income'\)/);
  assert.doesNotMatch(app,/Voltar<\/button><NewAdjustmentScreen/);
});

test('ação financeira concluída volta automaticamente à tela de origem',()=>{assert.match(app,/NewAdjustmentScreen onCompleted=/);assert.match(app,/setScreen\(returnTab\)/);});
