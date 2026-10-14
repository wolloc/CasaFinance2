import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const home=fs.readFileSync(path.join(root,'src/components/app/HomeFinancialMap.tsx'),'utf8');
const screen=fs.readFileSync(path.join(root,'src/components/app/CasaHomeScreen.tsx'),'utf8');
const settlements=fs.readFileSync(path.join(root,'src/components/app/SettlementHub.tsx'),'utf8');

test('Home mostra terceiros envolvidos e valores atribuídos',()=>{
  assert.doesNotMatch(home,/Parte dos gastos assumida por terceiros/);
  assert.match(home,/Valores com outras pessoas/);
  assert.match(home,/SettlementHub perspective=\{perspective\} financialMonth=\{financialMonth\} onResolve=\{onSettlementAction\} embedded includeMembers=\{false\} includeThirdParties/);
  assert.match(settlements,/listOpenThirdPartyObligations/);
  assert.match(settlements,/financialMonth\?rows\.filter\(row=>row\.due_date\?\.slice\(0,7\)===financialMonth\.slice\(0,7\)\):rows/);
  assert.match(settlements,/Total em aberto/);
  assert.match(settlements,/Compromissos/);
  assert.doesNotMatch(home,/Responsabilidade por compromissos/);
});

test('responsabilidades de terceiros são atualizadas após ações financeiras',()=>{
  assert.match(home,/refreshKey\?:number/);
  assert.match(settlements,/\[household\?\.id,refreshKey\]/);
  assert.match(screen,/financialMonth=\{referenceMonth\.slice\(0,7\)\}/);
  assert.match(screen,/refreshKey=\{attentionRefreshKey\+refreshKey\}/);
});


test('Casa mostra contribuições de terceiros projetadas por compromisso e vencimento',()=>{
  const projection=fs.readFileSync(path.join(root,'src/components/app/ThirdPartyCommitmentProjection.tsx'),'utf8');
  const reader=fs.readFileSync(path.join(root,'src/finance/thirdPartyCommitments.ts'),'utf8');
  const migration=fs.readFileSync(path.join(root,'supabase/migrations/202610120001_third_party_commitment_positions.sql'),'utf8');
  assert.match(settlements,/ThirdPartyCommitmentProjection financialMonth=\{financialMonth\}/);
  assert.match(projection,/Contribuições previstas/);
  assert.match(projection,/Projeção · não é saldo disponível/);
  assert.match(reader,/financial_third_party_commitment_positions/);
  assert.match(reader,/financial_month/);
  assert.match(migration,/financial_member_commitment_responsibility_positions/);
  assert.match(migration,/financial_commitment_positions/);
  assert.match(migration,/security_invoker=true/);
  assert.match(migration,/revoke all on public\.financial_third_party_commitment_positions from public,anon/);
  assert.match(migration,/grant select on public\.financial_third_party_commitment_positions to authenticated/);
});
