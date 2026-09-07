import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const source=await readFile(new URL('../../src/components/app/ThirdPartyPayableForgiveness.tsx',import.meta.url),'utf8');
test('failed payable reread clears stale obligation amount and allocation',()=>{for(const snippet of ['setPayables([]);',"setObligationId('');","setAmount('');",'setPercentages({});'])assert.ok(source.includes(snippet));});
test('forgiveness form is hidden until reread succeeds',()=>{assert.match(source,/loading\?<LoaderCircle[\s\S]*?:loadError\?<div[\s\S]*?Tentar novamente[\s\S]*?:<form/);});
test('stale payable cannot create economic gain',()=>{const guard=source.indexOf('if(loadError||loading)');const mutation=source.indexOf('await forgiveThirdPartyPayable');assert.ok(guard>=0&&mutation>guard);});
test('forgiveness remains economic gain without payment or cash',()=>{assert.match(source,/nasceu um ganho econômico, mas nenhum dinheiro entrou ou saiu e nenhum pagamento foi inventado/);});
