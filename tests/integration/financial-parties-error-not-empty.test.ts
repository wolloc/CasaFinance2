import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const source=await readFile(new URL('../../src/components/app/FinancialPartiesSettings.tsx',import.meta.url),'utf8');
test('third-party read failure is not rendered as an empty list',()=>{assert.match(source,/loading\?<LoaderCircle[\s\S]*?:error\?<p role="alert"[\s\S]*?:<ul/);assert.match(source,/não vai presumir que a lista está vazia/);});
test('failed reread clears possibly stale third parties',()=>{assert.match(source,/catch\{setRows\(\[\]\);setError\(true\)\}/);});
test('read error branch does not mutate finance',()=>{const failure=source.match(/catch\{setRows\(\[\]\);setError\(true\)\}/)?.[0]??'';assert.doesNotMatch(failure,/rpc|insert|update|delete|settle|pay|transfer/i);});
