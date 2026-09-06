import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source=await readFile(new URL('./ThirdPartyReceivableWriteOff.tsx',import.meta.url),'utf8');
const service=await readFile(new URL('../../finance/thirdPartyObligations.ts',import.meta.url),'utf8');
const adjustment=await readFile(new URL('./NewAdjustmentScreen.tsx',import.meta.url),'utf8');
const engine=await readFile(new URL('../../../supabase/migrations/202609040020_financial_engine_v1_rpcs.sql',import.meta.url),'utf8');

test('receivable write-off is an explicit adjustment journey',()=>{
  assert.match(adjustment,/Valor que não será recebido/);
  assert.match(adjustment,/selected==='third-party-loss'/);
  assert.match(source,/Dar baixa em valor que não será recebido/);
  assert.match(source,/diferente de corrigir um lançamento feito por engano/);
});

test('write-off delegates to canonical loss RPC and never settles cash',()=>{
  assert.match(service,/rpc\('write_off_receivable'/);
  assert.match(service,/p_splits: splits/);
  assert.doesNotMatch(service,/writeOffThirdPartyReceivable[\s\S]*rpc\('settle_financial_obligation'/);
  assert.match(source,/Nenhum dinheiro entrou ou saiu/);
  assert.match(source,/perda econômica/);
  assert.match(engine,/write_off_receivable/);
  assert.match(engine,/transaction_components[\s\S]+loss/);
});

test('economic responsibility for the loss is explicit and totals one hundred percent',()=>{
  assert.match(service,/responsabilidade pela perda precisa totalizar 100%/);
  assert.match(service,/member_id: row\.memberId/);
  assert.match(service,/percentage: row\.percentage/);
  assert.match(source,/Quem assume economicamente essa perda/);
  assert.match(source,/percentuais precisam totalizar 100%/);
});

test('write-off cannot exceed the receivable outstanding amount in the UI',()=>{
  assert.match(source,/numeric>selected\.outstanding_amount/);
  assert.match(source,/não pode superar o saldo ainda a receber/);
});
