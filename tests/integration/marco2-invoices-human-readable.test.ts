import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const source=await readFile(new URL('../../src/components/app/InvoicesScreen.tsx',import.meta.url),'utf8');
test('faturas mostram valores e datas em linguagem cotidiana',()=>{for(const text of ['Fatura de','Falta pagar','Fecha em','Conta que você pretende usar'])assert.match(source,new RegExp(text));assert.doesNotMatch(source,/>Competência /);});
test('falha de leitura continua explícita e pode ser tentada novamente',()=>{assert.match(source,/não vai presumir que uma fatura foi paga, fechada ou deixou de existir/);assert.match(source,/Tentar novamente/);assert.match(source,/setRefreshKey\(value=>value\+1\)/);});
test('revisar fatura não movimenta dinheiro automaticamente',()=>{assert.match(source,/Só registrar o pagamento movimenta dinheiro/);const errorBlock=source.slice(source.indexOf(':error?<div'),source.indexOf(':rows.length===0'));assert.doesNotMatch(errorBlock,/onPay|payCard|\.rpc\(/);});
