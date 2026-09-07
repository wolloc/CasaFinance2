import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const source=await readFile(new URL('../../src/components/app/LoanPaymentAdjustment.tsx',import.meta.url),'utf8');
test('loan payment read failure clears debt and cash context',()=>{for(const snippet of ['setComponents([]);','setAccounts([]);',"setLoanId('');","setSource('');","setPrincipal('');",'setCharges({});'])assert.ok(source.includes(snippet));assert.match(source,/catch\{clearLoadedContext\(\);setLoadError/);});
test('loan payment form is hidden until a valid reread and retry is available',()=>{assert.match(source,/loading\?<LoaderCircle[\s\S]*?:loadError\?<div[\s\S]*?Tentar novamente[\s\S]*?:<form onSubmit=\{submit\}/);});
test('stale read cannot create the single loan cash movement',()=>{const guard=source.indexOf('if(loadError)');const mutation=source.indexOf('await recordLoanPayment');assert.ok(guard>=0&&mutation>guard);assert.match(source,/Nenhuma saída de caixa pode ser registrada até uma nova leitura válida/);});
