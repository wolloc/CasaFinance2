import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const app=await readFile(new URL('../../src/components/app/CasaFinanceApp.tsx',import.meta.url),'utf8');
test('async attention rereads expose a visible busy state',()=>{assert.match(app,/const\[attentionBusy,setAttentionBusy\]=useState\(false\)/);assert.match(app,/Conferindo a situação atual…/);assert.match(app,/role="status" aria-live="polite"/);});
test('overdue commitment and member settlement bracket rereads with busy state',()=>{assert.match(app,/action\.kind==='overdue-commitment'/);assert.match(app,/getOverdueCommitmentContext/);assert.match(app,/action\.kind==='member-settlement-schedule'/);assert.match(app,/getScheduledMemberSettlementContext/);assert.ok((app.match(/setAttentionBusy\(true\)/g)??[]).length>=2);assert.ok((app.match(/finally\{setAttentionBusy\(false\);\}/g)??[]).length>=2);});
test('busy guard prevents concurrent attention navigation without adding finance writes',()=>{assert.match(app,/if\(attentionBusy\)return;setAttentionNotice\(null\)/);const overlay=app.match(/attentionBusy&&<div role="status"[\s\S]*?Conferindo a situação atual…[\s\S]*?<\/div><\/div>/)?.[0]??'';assert.doesNotMatch(overlay,/supabase|rpc|settle|pay|transfer|insert|update|delete/i);});
