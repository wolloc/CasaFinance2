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
  assert.match(home,/Valores com terceiros/);
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
