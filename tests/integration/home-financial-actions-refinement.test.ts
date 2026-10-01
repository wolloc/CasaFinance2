import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const loan=await readFile(new URL('../../src/components/app/LoanAdjustment.tsx',import.meta.url),'utf8');
const thirdParty=await readFile(new URL('../../src/components/app/ThirdPartySettlementAdjustment.tsx',import.meta.url),'utf8');
const adjustment=await readFile(new URL('../../src/components/app/NewAdjustmentScreen.tsx',import.meta.url),'utf8');
const schedule=await readFile(new URL('../../src/components/app/LoanScheduleSummary.tsx',import.meta.url),'utf8');
const settlements=await readFile(new URL('../../src/components/app/SettlementHub.tsx',import.meta.url),'utf8');
const map=await readFile(new URL('../../src/components/app/HomeFinancialMap.tsx',import.meta.url),'utf8');

test('loan creation closes contextual action and refreshes Home through onCompleted',()=>{
  assert.match(loan,/onCompleted\?: \(message:string\) => void/);
  assert.match(loan,/if\(onCompleted\)\{onCompleted\(completionMessage\);return;\}/);
  assert.match(adjustment,/<LoanAdjustment[\s\S]*onCompleted=\{onCompleted\}/);
});

test('third-party settlement uses resource cards and closes contextual action after save',()=>{
  assert.match(thirdParty,/FinancialResourceChoice/);
  assert.match(thirdParty,/De qual conta o dinheiro saiu\?/);
  assert.match(thirdParty,/Em qual conta o dinheiro entrou\?/);
  assert.match(thirdParty,/onCompleted\?: \(message:string\) => void/);
  assert.match(adjustment,/<ThirdPartySettlementAdjustment[\s\S]*onCompleted=\{onCompleted\}/);
});

test('loan detail explicitly explains monthly projection impact',()=>{
  assert.match(schedule,/As parcelas em aberto já reduzem a projeção dos meses em que vencem/);
});

test('Home relationship block exposes event history and financial map avoids duplicated header totals',()=>{
  assert.match(settlements,/Ver histórico e compromissos/);
  assert.match(settlements,/includeThirdParties/);
  assert.doesNotMatch(map,/Recursos, crédito e valores que estão com outras pessoas/);
  assert.doesNotMatch(map,/Nos recursos/);
});
