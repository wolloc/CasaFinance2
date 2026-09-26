import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const source=await readFile(new URL('../../src/components/app/IncomeLedgerScreen.tsx',import.meta.url),'utf8');
test('income load failure is not rendered as an empty ledger',()=>{const errorBranch=source.indexOf('error?<p role="alert"');const emptyMarker=':visibleRows.length===0?<';const emptyBranch=source.indexOf(emptyMarker);assert.ok(errorBranch>=0,'explicit error branch must exist');assert.ok(emptyBranch>errorBranch,'real empty state must only be considered after the error branch');assert.match(source,/Nenhuma renda foi presumida como ausente ou resolvida/);});
test('projection review stale message is only shown after a successful reread',()=>{assert.match(source,/!loading&&!error&&initialReviewMoneyMovementId/);});
test('read failure does not introduce financial writes',()=>{const failure=source.match(/catch\{if\(active\)\{[\s\S]*?\}\}finally/)?.[0]??'';assert.doesNotMatch(failure,/rpc|insert|update|delete|settle|pay|transfer/i);});
