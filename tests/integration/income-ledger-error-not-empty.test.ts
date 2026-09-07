import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const source=await readFile(new URL('../../src/components/app/IncomeLedgerScreen.tsx',import.meta.url),'utf8');
test('income load failure is not rendered as an empty ledger',()=>{assert.match(source,/error\?<p role="alert"[\s\S]*?:rows\.length===0\?<p/);assert.match(source,/Nenhuma renda foi presumida como ausente ou resolvida/);});
test('projection review stale message is only shown after a successful reread',()=>{assert.match(source,/!loading&&!error&&initialReviewMoneyMovementId/);});
test('read failure does not introduce financial writes',()=>{const failure=source.match(/catch\{if\(active\)\{[\s\S]*?\}\}finally/)?.[0]??'';assert.doesNotMatch(failure,/rpc|insert|update|delete|settle|pay|transfer/i);});
