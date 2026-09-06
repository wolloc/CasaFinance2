import assert from 'node:assert/strict';import{readFile}from'node:fs/promises';import test from'node:test';
const source=await readFile(new URL('./LoanChargesAdjustment.tsx',import.meta.url),'utf8');const parent=await readFile(new URL('./LoanAdjustment.tsx',import.meta.url),'utf8');
test('loan UX separates principal from charges',()=>{assert.match(parent,/O principal permanece neutro/);assert.match(parent,/LoanChargesAdjustment/);assert.match(source,/Juros, tarifas e multas/);});
test('charge UX keeps responsibility and cash explicit',()=>{assert.match(source,/Quem assume economicamente este custo/);assert.match(source,/Registrar aqui <strong>não paga<\/strong> o encargo e não reduz o caixa/);assert.match(source,/quem efetivamente bancou/);});
test('supported charge kinds are interest fee and penalty',()=>{assert.match(source,/\['interest','Juros'\]/);assert.match(source,/\['fee','Tarifa'\]/);assert.match(source,/\['penalty','Multa'\]/);});
