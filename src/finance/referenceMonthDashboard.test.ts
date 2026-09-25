import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { normalizeReferenceMonth, shiftReferenceMonth } from './referenceMonthDashboard.js';

const homeSource=await readFile(new URL('../components/app/CasaHomeScreen.tsx',import.meta.url),'utf8');
const serviceSource=await readFile(new URL('./referenceMonthDashboard.ts',import.meta.url),'utf8');

test('reference month helpers are calendar safe across year boundaries',()=>{
  assert.equal(normalizeReferenceMonth('2026-09-25'),'2026-09-01');
  assert.equal(shiftReferenceMonth('2026-01-01',-1),'2025-12-01');
  assert.equal(shiftReferenceMonth('2026-12-01',1),'2027-01-01');
});

test('reference month client uses only canonical read RPCs',()=>{
  for(const rpc of ['financial_reference_month_context','financial_monthly_projection','financial_member_monthly_projection']){
    assert.match(serviceSource,new RegExp(`rpc\\('${rpc}'`));
  }
  assert.doesNotMatch(serviceSource,/\.insert\(|\.update\(|\.delete\(|\.upsert\(/);
});

test('Home only requests projections after the reference context says future',()=>{
  assert.match(homeSource,/getReferenceMonthContext[\s\S]*if\(context\.period_kind==='future'\)[\s\S]*getHouseholdReferenceProjection/);
  assert.match(homeSource,/getMemberReferenceProjection/);
  assert.doesNotMatch(homeSource,/context\.period_kind==='past'[\s\S]{0,200}getHouseholdReferenceProjection/);
});

test('past current and future cannot reuse the same visual semantics',()=>{
  assert.match(homeSource,/Fotografia histórica/);
  assert.match(homeSource,/Planejamento/);
  assert.match(homeSource,/Não é saldo realizado nem fato futuro garantido/);
  assert.match(homeSource,/scheduled_settlement_inflow/);
  assert.match(homeSource,/não reutilizou dados do mês atual/i);
  assert.match(homeSource,/referenceMonth===currentReferenceMonth\?'mês atual'/);
});

test('month navigation respects the financial cutover and keeps a return-to-current action',()=>{
  assert.match(homeSource,/previousMonth<trackingMonth/);
  assert.match(homeSource,/setReferenceMonth\(currentReferenceMonth\)/);
  assert.match(homeSource,/Mês anterior/);
  assert.match(homeSource,/Próximo mês/);
});

test('historical individual perspective refuses to fabricate old liquidity ownership',()=>{
  assert.match(homeSource,/Não retrocede o saldo atual nem a titularidade atual para fabricar uma liquidez individual histórica/);
  assert.match(homeSource,/listEconomicMonthExpenses[\s\S]*referenceMonth\.slice\(0,7\)/);
});
