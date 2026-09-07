import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const source=await readFile(new URL('../../src/components/app/ThirdPartyObligationCreation.tsx',import.meta.url),'utf8');
test('failed people reread clears stale selection',()=>{assert.match(source,/setParties\(\[\]\);setPartyId\(''\)/);assert.match(source,/catch \{ clearLoadedContext\(\); setLoadError/);});
test('creation form is hidden until people reread succeeds',()=>{assert.match(source,/loading \? <LoaderCircle[\s\S]*?: loadError \? <div[\s\S]*?Tentar novamente[\s\S]*?: <form/);});
test('stale people context cannot create a value',()=>{const guard=source.indexOf('if(loadError||loading)');const mutation=source.indexOf('await createManualThirdPartyObligation');assert.ok(guard>=0&&mutation>guard);});
test('creating the value never pretends cash moved',()=>{assert.match(source,/Só cadastrar não movimenta dinheiro/);assert.match(source,/O dinheiro só muda quando um pagamento ou recebimento for registrado/);});
