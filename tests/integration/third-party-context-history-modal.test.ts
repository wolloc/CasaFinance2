import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const hub=await readFile(new URL('../../src/components/app/SettlementHub.tsx',import.meta.url),'utf8');
const modal=await readFile(new URL('../../src/components/app/ThirdPartyContextModal.tsx',import.meta.url),'utf8');
const service=await readFile(new URL('../../src/finance/thirdPartyObligations.ts',import.meta.url),'utf8');

test('third-party card opens a centered contextual modal instead of expanding inline',()=>{
  assert.match(hub,/setSelectedThirdParty\(group\)/);
  assert.match(hub,/ThirdPartyContextModal/);
  assert.match(modal,/role="dialog"/);
  assert.match(modal,/aria-modal="true"/);
  assert.match(modal,/onMouseDown=.*event\.target===event\.currentTarget/s);
  assert.match(modal,/Extrato da relação/);
  assert.match(modal,/Posição atual/);
});

test('third-party history reads canonical obligations and obligation events without creating facts',()=>{
  assert.match(service,/listThirdPartyObligationHistory/);
  assert.match(service,/from\('financial_obligations'\)/);
  assert.match(service,/from\('obligation_events'\)/);
  assert.match(service,/counterparty_id/);
  const historyReader=service.slice(service.indexOf('export async function listThirdPartyObligationHistory'),service.indexOf('export async function listEditableManualThirdPartyObligations'));
  assert.doesNotMatch(historyReader,/\.rpc\(|insert\(|update\(|delete\(/);
});

test('context modal keeps settlement actions contextual and separates history from new economics',()=>{
  assert.match(modal,/Registrar recebimento/);
  assert.match(modal,/Registrar pagamento/);
  assert.match(modal,/Ver empréstimo/);
  assert.match(modal,/Pagamentos e recebimentos não viram novos gastos ou rendas/);
  assert.match(modal,/Saldo deste valor após o evento/);
});
