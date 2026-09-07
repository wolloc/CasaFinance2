import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const source=await readFile(new URL('../../src/components/app/InvoicesScreen.tsx',import.meta.url),'utf8');
test('faturas mostram valores e datas em linguagem cotidiana',()=>{for(const text of ['Fatura de','Falta pagar','Fecha em','Conta que você pretende usar'])assert.match(source,new RegExp(text));assert.doesNotMatch(source,/>Competência /);});
test('falha de leitura continua explícita limpa contexto e pode ser tentada novamente',()=>{assert.match(source,/não vai usar uma leitura antiga/);assert.match(source,/setRows\(\[\]\);setCards\(\[\]\);setError\(true\)/);assert.match(source,/Tentar novamente/);assert.match(source,/setRefreshKey\(value=>value\+1\)/);});
test('revisar cartões e faturas não movimenta dinheiro automaticamente',()=>{assert.match(source,/Nenhum dinheiro foi movimentado/);assert.match(source,/Registrar pagamento desta fatura/);assert.match(source,/onPay\?\.\(row\)/);assert.doesNotMatch(source,/\.rpc\(|\.insert\(|\.update\(|\.delete\(/);});
