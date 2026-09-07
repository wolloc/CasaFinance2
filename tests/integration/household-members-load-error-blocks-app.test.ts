import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const context=await readFile(new URL('../../src/context/SupabaseAuthContext.tsx',import.meta.url),'utf8');
const app=await readFile(new URL('../../src/components/app/CasaFinanceApp.tsx',import.meta.url),'utf8');

test('falha de leitura de membros não vira lista vazia silenciosa',()=>{
  assert.match(context,/setHouseholdMembers\(\[\]\);\s*setHouseholdMembersError\('Não foi possível conferir quem faz parte da Casa/);
  assert.match(context,/householdMembersError/);
});

test('Casa Finance não monta fluxos financeiros enquanto membros estão carregando ou com erro',()=>{
  const loadingGate=app.indexOf('if(householdMembersLoading)');
  const errorGate=app.indexOf('if(householdMembersError)');
  const financialShell=app.indexOf("return <main className=\"min-h-[100dvh]");
  assert.ok(loadingGate>=0&&errorGate>loadingGate&&financialShell>errorGate);
  assert.match(app,/o Casa não libera registros financeiros até essa leitura funcionar/);
});

test('erro de membros oferece retry explícito antes de liberar o produto',()=>{
  assert.match(context,/retryHouseholdMembers: \(\) => setHouseholdMembersRefreshVersion/);
  assert.match(app,/onClick=\{retryHouseholdMembers\}/);
  assert.match(app,/Tentar novamente/);
});
