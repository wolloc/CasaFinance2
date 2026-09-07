import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const source=await readFile(new URL('../../src/components/app/InvoicesScreen.tsx',import.meta.url),'utf8');
test('invoice and card contextual conclusions require a successful reread',()=>{assert.match(source,/!loading&&!error&&reviewIntent/);assert.match(source,/!loading&&!error&&projectionReviewIntent/);assert.match(source,/!loading&&!error&&cardReviewIntent/);});
test('combined read failure is explicit and clears every stale card context',()=>{assert.match(source,/\.catch\(\(\)=>\{setRows\(\[\]\);setCards\(\[\]\);setError\(true\);\}\)/);assert.match(source,/não vai usar uma leitura antiga/);assert.match(source,/Tentar novamente/);});
test('read failure does not create financial mutations',()=>{const catchStart=source.indexOf('.catch(()=>{setRows([]);setCards([]);setError(true);})');const retryEnd=source.indexOf('</button></div>',catchStart);assert.ok(catchStart>=0&&retryEnd>catchStart);const failurePath=source.slice(catchStart,retryEnd);assert.doesNotMatch(failurePath,/\.rpc\(|\.insert\(|\.update\(|\.delete\(|onPay\?\./);});
