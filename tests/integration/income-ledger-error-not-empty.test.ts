import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source=await readFile(new URL('../../src/components/app/IncomeLedgerScreen.tsx',import.meta.url),'utf8');

test('income load failure is explicit and cannot look like an empty ledger',()=>{
  assert.match(source,/setError\('Não foi possível carregar as rendas da Casa\. Nenhuma renda foi presumida como ausente ou resolvida\.'\)/);
  assert.match(source,/error\?<FinancialListState kind="error"/);
  assert.match(source,/:visibleRows\.length===0\?<FinancialListState kind="empty"/);
  assert.ok(source.indexOf('error?<FinancialListState kind="error"')<source.indexOf(':visibleRows.length===0?<FinancialListState kind="empty"'));
});
test('projection review stale message is only shown after a successful reread',()=>{assert.match(source,/!loading&&!error&&initialReviewMoneyMovementId/);});
test('read failure does not introduce financial writes',()=>{const failure=source.match(/catch\{if\(active\)\{[\s\S]*?\}\}finally/)?.[0]??'';assert.doesNotMatch(failure,/rpc|insert|update|delete|settle|pay|transfer/i);});
