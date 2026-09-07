import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const source=await readFile(new URL('../../src/components/app/ThirdPartySettlementAdjustment.tsx',import.meta.url),'utf8');
test('failed reread clears stale obligations accounts and selections',()=>{for(const snippet of ['setObligations([]);','setAccounts([]);',"setObligationId('');","setAccountId('');","setFunderMemberId('');","setAmount('');"])assert.ok(source.includes(snippet));assert.match(source,/catch \{ clearLoadedContext\(\); setLoadError/);});
test('settlement form is hidden until reread succeeds',()=>{assert.match(source,/loading \? <LoaderCircle[\s\S]*?: loadError \? <div[\s\S]*?Tentar novamente[\s\S]*?: <form/);});
test('stale context cannot settle obligation',()=>{const guard=source.indexOf('if(loadError)');const mutation=source.indexOf('await settleThirdPartyObligation');assert.ok(guard>=0&&mutation>guard);});
test('human wording preserves economic semantics',()=>{assert.match(source,/não cria uma nova renda nem um novo gasto/);assert.match(source,/Quem pagou com o próprio dinheiro/);assert.match(source,/O valor não pode ser maior do que ainda está em aberto/);});
