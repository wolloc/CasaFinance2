import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const center=await readFile(new URL('../../src/components/app/ProjectionReviewCenter.tsx',import.meta.url),'utf8');

test('projection review failure is visible instead of looking empty',()=>{
 assert.match(center,/if\(failed\)return <div role="alert"/);
 assert.match(center,/Não foi possível conferir as previsões/);
 assert.match(center,/Nada foi considerado resolvido/);
 assert.match(center,/Tentar novamente/);
 assert.match(center,/if\(items\.length===0\)return null/);
});

test('read failure never implies financial resolution',()=>{
 const failure=center.match(/if\(failed\)return [\s\S]*?;\n  if\(items\.length===0\)/)?.[0]??'';
 assert.match(failure,/Nada foi considerado resolvido/);
 assert.doesNotMatch(failure,/\.rpc\(|\.insert\(|\.update\(|\.delete\(|settle|payHousehold|transfer/i);
});
