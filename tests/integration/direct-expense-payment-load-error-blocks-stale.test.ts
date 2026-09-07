import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const source=await readFile(new URL('../../src/components/app/DirectExpensePaymentAction.tsx',import.meta.url),'utf8');
test('direct payment read failure clears stale expense funding and cash context',()=>{for(const snippet of ['setExpenses([]);','setAccounts([]);',"setTransactionId('');","setSourceAccountId('');","setFunderMemberId('');","setAmount('');"])assert.ok(source.includes(snippet));assert.match(source,/catch \{ clearLoadedContext\(\); setLoadError/);});
test('direct payment form and successful-reread banner are hidden on load error',()=>{assert.match(source,/initialTransactionId&&!loadError/);assert.match(source,/loading \? <LoaderCircle[\s\S]*?: loadError \? <div[\s\S]*?Tentar novamente[\s\S]*?: expenses\.length === 0/);});
test('stale read cannot settle an existing expense',()=>{const guard=source.indexOf('if(loadError)');const mutation=source.indexOf('await settleDirectExpense');assert.ok(guard>=0&&mutation>guard);assert.match(source,/Nenhum pagamento pode ser registrado até uma nova leitura válida/);});
