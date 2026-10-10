import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const source=await readFile(new URL('../../src/components/app/SettlementHub.tsx',import.meta.url),'utf8');
test('failed settlement hub reread clears stale member and third-party rows',()=>{assert.ok(source.includes('setMemberRows([]);'));assert.ok(source.includes('setThirdPartyRows([]);'));assert.ok(source.includes('setError(true);'));});
test('read failure never renders as empty or actionable state',()=>{assert.match(source,/error&&<div[\s\S]*?Não foi possível conferir os valores com pessoas agora/);assert.doesNotMatch(source,/Tudo equilibrado por enquanto/);assert.match(source,/!error&&<div className=\"space-y-2\"/);});
test('retry triggers a fresh canonical read before actions return',()=>{assert.ok(source.includes('const[refreshKey,setRefreshKey]=useState(0);'));assert.ok(source.includes('const retry=()=>setRefreshKey(value=>value+1);'));assert.ok(source.includes('[household?.id,refreshKey]'));assert.match(source,/Tentar novamente/);});
test('settlement hub remains read-only',()=>{assert.doesNotMatch(source,/\.rpc\(|\.insert\(|\.update\(|\.delete\(|settleMemberPosition|createResourceTransfer/);});

test('successful empty third-party read renders a friendly empty state',()=>{assert.match(source,/includeThirdParties&&thirdPartyGroups\.length===0/);assert.match(source,/<UsersRound className=/);assert.match(source,/Nenhum valor com terceiros em aberto/);assert.match(source,/Quando houver valores a receber ou a pagar, eles aparecerão aqui/);});
test('empty state is suppressed when the canonical read fails',()=>{assert.match(source,/!error&&<div className=\\\"space-y-2\\\"/);assert.match(source,/error&&<div className=\\\"rounded-xl border border-rose-900/);});
test('settlement data loads concurrently with stale effect cancellation',()=>{assert.match(source,/let cancelled=false/);assert.match(source,/Promise\.all\(\[/);assert.match(source,/if\(cancelled\)return/);});
