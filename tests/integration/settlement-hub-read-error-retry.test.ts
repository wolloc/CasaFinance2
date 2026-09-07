import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const source=await readFile(new URL('../../src/components/app/SettlementHub.tsx',import.meta.url),'utf8');
test('failed settlement hub reread clears stale member and third-party rows',()=>{assert.ok(source.includes('setMemberRows([]);'));assert.ok(source.includes('setThirdPartyRows([]);'));assert.ok(source.includes('setError(true);'));});
test('read failure never renders as empty or actionable state',()=>{assert.match(source,/error&&<div[\s\S]*?não vai presumir que uma dívida foi resolvida ou que não há nada em aberto/);assert.match(source,/!error&&realized\.length===0&&thirdPartyRows\.length===0&&projected\.length===0/);assert.match(source,/!error&&realized\.length>0/);assert.match(source,/!error&&thirdPartyRows\.length>0/);});
test('retry triggers a fresh canonical read before actions return',()=>{assert.ok(source.includes('const[refreshKey,setRefreshKey]=useState(0);'));assert.ok(source.includes('const retry=()=>setRefreshKey(value=>value+1);'));assert.ok(source.includes('[household?.id,refreshKey]'));assert.match(source,/Tentar novamente/);});
test('settlement hub remains read-only',()=>{assert.doesNotMatch(source,/\.rpc\(|\.insert\(|\.update\(|\.delete\(|settleMemberPosition|createResourceTransfer/);});
