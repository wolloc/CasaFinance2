import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const source=await readFile(new URL('../../src/components/app/RecurringIncomeManagement.tsx',import.meta.url),'utf8');
test('recurring income read failure clears stale series and edit context',()=>{for(const snippet of ['setRules([]);','setSelected(null);','setMode(null);'])assert.ok(source.includes(snippet));assert.match(source,/catch\{clearLoadedContext\(\);setLoadError/);});
test('series actions are hidden on failed reread and retry is available',()=>{assert.match(source,/loading \? <LoaderCircle[\s\S]*?: loadError \? <div[\s\S]*?Tentar novamente[\s\S]*?: <div className="mt-4 space-y-3">/);assert.match(source,/!loadError&&selected && mode/);});
test('stale series cannot be revised or closed',()=>{const guard=source.indexOf('if(loadError)');const close=source.indexOf('await closeRecurringIncomeRule');const revise=source.indexOf('await reviseRecurringIncomeRule');assert.ok(guard>=0&&close>guard&&revise>guard);});
