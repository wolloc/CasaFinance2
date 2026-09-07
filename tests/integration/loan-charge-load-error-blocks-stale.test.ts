import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const source=await readFile(new URL('../../src/components/app/LoanChargesAdjustment.tsx',import.meta.url),'utf8');
test('loan charge read failure clears stale principal target',()=>{assert.ok(source.includes('setLoans([]);'));assert.ok(source.includes("setLoanId('');"));assert.match(source,/catch\{clearLoadedContext\(\);setLoadError/);});
test('charge recognition form is hidden until active loans reread succeeds',()=>{assert.match(source,/loading\?<LoaderCircle[\s\S]*?:loadError\?<div[\s\S]*?Tentar novamente[\s\S]*?:<form onSubmit=\{submit\}/);});
test('stale read cannot recognize an economic charge',()=>{const guard=source.indexOf('if(loadError)');const mutation=source.indexOf('await recordLoanCharge');assert.ok(guard>=0&&mutation>guard);const failure=source.slice(source.indexOf('catch{clearLoadedContext()'),source.indexOf('finally{setLoading(false)'));assert.match(failure,/Nenhum juro, tarifa ou multa pode ser registrado até uma nova leitura válida/);});
