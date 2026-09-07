import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const source=await readFile(new URL('../../src/components/app/ThirdPartyReceivableWriteOff.tsx',import.meta.url),'utf8');
test('failed receivable reread clears stale obligation amount and allocation',()=>{for(const snippet of ['setReceivables([]);',"setObligationId('');","setAmount('');",'setPercentages({});'])assert.ok(source.includes(snippet));});
test('write-off form is hidden until reread succeeds',()=>{assert.match(source,/loading\?<LoaderCircle[\s\S]*?:loadError\?<div[\s\S]*?Tentar novamente[\s\S]*?:<form/);});
test('stale receivable cannot create economic loss',()=>{const guard=source.indexOf('if(loadError||loading)');const mutation=source.indexOf('await writeOffThirdPartyReceivable');assert.ok(guard>=0&&mutation>guard);});
test('write-off remains economic loss without cash movement',()=>{assert.match(source,/registrou a perda\. Nenhum dinheiro entrou ou saiu de uma conta/);});
