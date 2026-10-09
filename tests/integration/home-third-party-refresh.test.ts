import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const home=fs.readFileSync(path.join(root,'src/components/app/HomeFinancialMap.tsx'),'utf8');
const screen=fs.readFileSync(path.join(root,'src/components/app/CasaHomeScreen.tsx'),'utf8');

test('Home mostra terceiros envolvidos e valores atribuídos',()=>{
  assert.doesNotMatch(home,/Parte dos gastos assumida por terceiros/);
  assert.match(home,/responsible_party_id/);
  assert.doesNotMatch(home,/Responsabilidade por compromissos/);
});

test('responsabilidades de terceiros são atualizadas após ações financeiras',()=>{
  assert.match(home,/refreshKey\?:number/);
  assert.match(home,/\[householdId,refreshKey\]/);
  assert.match(home,/refreshKey=\{refreshKey\}/);
  assert.match(screen,/refreshKey=\{attentionRefreshKey\+refreshKey\}/);
});
