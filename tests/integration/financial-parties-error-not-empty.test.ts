import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const source=await readFile(new URL('../../src/components/app/FinancialPartiesSettings.tsx',import.meta.url),'utf8');
test('third-party read failure is not rendered as an empty list',()=>{const loading=source.indexOf('loading?<LoaderCircle');const error=source.indexOf(':loadError?<');const list=source.indexOf(':<ul');assert.ok(loading>=0&&error>loading&&list>error);assert.match(source,/não vai presumir que a lista está vazia/);});
test('failed reread clears possibly stale third parties',()=>{assert.match(source,/catch\{setRows\(\[\]\);setLoadError\(true\)\}/);});
test('read error branch does not mutate finance',()=>{const failure=source.match(/catch\{setRows\(\[\]\);setLoadError\(true\)\}/)?.[0]??'';assert.doesNotMatch(failure,/rpc|insert|update|delete|settle|pay|transfer/i);});
