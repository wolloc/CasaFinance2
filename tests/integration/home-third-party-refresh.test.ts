import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const home=fs.readFileSync(path.join(root,'src/components/app/HomeFinancialMap.tsx'),'utf8');
const screen=fs.readFileSync(path.join(root,'src/components/app/CasaHomeScreen.tsx'),'utf8');

test('Home mostra terceiros envolvidos e valores atribuídos',()=>{
  assert.match(home,/Terceiros que assumem parte ou todo o compromisso/);
  assert.match(home,/responsible_party_id/);
  assert.match(home,/Responsabilidades de terceiros/);
});

test('responsabilidades de terceiros são atualizadas após ações financeiras',()=>{
  assert.match(home,/refreshKey\?:number/);
  assert.match(home,/\[householdId,refreshKey\]/);
  assert.match(home,/refreshKey=\{refreshKey\}/);
  assert.match(screen,/refreshKey=\{attentionRefreshKey\+refreshKey\}/);
});
