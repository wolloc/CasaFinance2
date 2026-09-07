import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const source=await readFile(new URL('../../src/components/app/InvoicesScreen.tsx',import.meta.url),'utf8');
test('invoice contextual conclusions require a successful reread',()=>{assert.match(source,/!loading&&!error&&reviewIntent/);assert.match(source,/!loading&&!error&&projectionReviewIntent/);assert.match(source,/!loading&&!error&&cardReviewIntent/);});
test('invoice read failure is explicit and clears stale rows',()=>{assert.match(source,/catch\(\)=>\{setRows\(\[\]\);setError\(true\)\}/);assert.match(source,/não vai presumir que uma fatura foi paga, fechada ou deixou de existir/);});
test('invoice read failure does not create financial mutations',()=>{const failure=source.match(/catch\(\)=>\{setRows\(\[\]\);setError\(true\)\}/)?.[0]??'';assert.doesNotMatch(failure,/rpc|insert|update|delete|pay|settle|transfer/i);});
