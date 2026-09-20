import test from 'node:test';import assert from'node:assert/strict';import{readFile}from'node:fs/promises';
const tx=await readFile(new URL('../../src/components/app/TransactionsScreen.tsx',import.meta.url),'utf8');
const boundary=await readFile(new URL('../../src/components/app/ScreenErrorBoundary.tsx',import.meta.url),'utf8');
test('income screen has a render boundary instead of going blank',()=>{assert.match(tx,/ScreenErrorBoundary screenName="suas entradas"/);assert.match(boundary,/getDerivedStateFromError/);assert.match(boundary,/Seus dados não foram apagados/);assert.match(boundary,/Tentar novamente/);});
test('render failure is isolated to the financial screen',()=>{assert.match(boundary,/Não foi possível mostrar/);assert.doesNotMatch(boundary,/window\.location|signOut|delete|remove/);});
