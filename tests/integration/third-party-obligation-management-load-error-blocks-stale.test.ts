import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const source=await readFile(new URL('../../src/components/app/ThirdPartyObligationManagement.tsx',import.meta.url),'utf8');
test('failed reread clears editable values people and form context',()=>{for(const snippet of ['setRows([]);','setParties([]);',"setSelectedId('');","setPartyId('');","setAmount('');","setObligationDate('');","setDueDate('');","setDescription('');","setReason('');"])assert.ok(source.includes(snippet));assert.match(source,/catch\{clearLoadedContext\(\);setLoadError/);});
test('correction form is hidden until reread succeeds',()=>{assert.match(source,/loading\?<LoaderCircle[\s\S]*?:loadError\?<div[\s\S]*?Tentar novamente[\s\S]*?:<form/);});
test('stale context cannot correct or cancel',()=>{const correctionGuard=source.indexOf('if(loadError||loading)');const correctionMutation=source.indexOf('await correctManualThirdPartyObligation');const cancelGuard=source.indexOf("if(loadError||loading){setError('Confira novamente os valores antes de cancelar");const cancelMutation=source.indexOf('await cancelManualThirdPartyObligation');assert.ok(correctionGuard>=0&&correctionMutation>correctionGuard);assert.ok(cancelGuard>=0&&cancelMutation>cancelGuard);});
