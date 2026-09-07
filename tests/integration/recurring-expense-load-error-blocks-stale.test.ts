import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const source=await readFile(new URL('../../src/components/app/RecurringExpenseCommitmentCenter.tsx',import.meta.url),'utf8');
test('recurring expense load failure clears occurrence and cash context',()=>{for(const snippet of ['setItems([]);','setAccounts([]);',"setSelectedId('');",'setMode(null);',"setAccountId('');","setFunderMemberId('');"])assert.ok(source.includes(snippet));assert.match(source,/catch \{ clearLoadedContext\(\); setLoadError/);});
test('contextual intent does not turn a read failure into a stale conclusion',()=>{assert.match(source,/if\(loading\|\|loadError\|\|handledIntent\.current\|\|!initialIntent\)return/);assert.match(source,/loadError\?<div[\s\S]*?Tentar novamente/);});
test('failed reread blocks both forecast confirmation and cash settlement',()=>{const guard=source.indexOf('if(loadError)');const confirm=source.indexOf('await confirmRecurringExpenseOccurrence');const pay=source.indexOf('await settleRecurringExpenseOccurrence');assert.ok(guard>=0&&confirm>guard&&pay>guard);});
