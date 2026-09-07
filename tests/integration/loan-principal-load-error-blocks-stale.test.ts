import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const source=await readFile(new URL('../../src/components/app/LoanAdjustment.tsx',import.meta.url),'utf8');
test('loan principal read failure clears stale parties and resources',()=>{for(const snippet of ['setParties([]);','setAccounts([]);',"setCounterpartyId('');","setAccountId('');"])assert.ok(source.includes(snippet));assert.match(source,/catch \{ clearLoadedContext\(\); setLoadError/);});
test('loan principal form is hidden until a valid reread and retry is available',()=>{assert.match(source,/loading \? <LoaderCircle[\s\S]*?: loadError \? <div[\s\S]*?Tentar novamente[\s\S]*?: <form onSubmit=\{submit\}/);});
test('stale or still-loading context cannot reach principal creation',()=>{const guard=source.indexOf('if (loadError || loading)');const mutation=source.indexOf('await createLoanPrincipal');assert.ok(guard>=0&&mutation>guard);const blockedMessage=source.slice(source.indexOf('catch { clearLoadedContext()'),source.indexOf('finally { setLoading(false)'));assert.match(blockedMessage,/não pode ser registrado até uma nova leitura válida/);});
