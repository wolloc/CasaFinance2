import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const source=await readFile(new URL('../../src/components/app/PostPaymentCardRefundAction.tsx',import.meta.url),'utf8');
test('failed post-payment refund reread clears stale purchase accounts and destinations',()=>{for(const snippet of ['setRows([]);','setAccounts([]);',"setSelectedId('');","setTargetInvoiceId('');","setDestinationAccountId('');",'setBenefits([]);',"setAmount('');"])assert.ok(source.includes(snippet));});
test('refund form is hidden until reread succeeds',()=>{assert.match(source,/loading \? <LoaderCircle[\s\S]*?: loadError \? <div[\s\S]*?Tentar novamente[\s\S]*?: <form/);});
test('stale context cannot record post-payment refund',()=>{const guard=source.indexOf("if (loadError || loading) { setError('Recarregue compras e contas elegíveis antes de registrar o estorno.');");const mutation=source.indexOf('await recordPostPaymentCardRefund');assert.ok(guard>=0&&mutation>guard);});
test('refund semantics keep benefit funding and cash separate',()=>{assert.match(source,/A conta define onde o caixa entrou\. Ela não define quem ficou com o benefício/);assert.match(source,/O funding antigo não é apagado/);assert.match(source,/sem transformar o estorno em renda/);});