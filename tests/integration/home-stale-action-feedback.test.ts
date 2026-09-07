import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const app=await readFile(new URL('../../src/components/app/CasaFinanceApp.tsx',import.meta.url),'utf8');
test('Home shows visible feedback when overdue commitment changed or reread fails',()=>{assert.match(app,/setAttentionNotice\(null\)/);assert.match(app,/Este gasto mudou ou já foi resolvido/);assert.match(app,/Não foi possível reler este gasto agora/);assert.match(app,/role="status"/);});
test('scheduled member settlement stale and errors are never silent',()=>{assert.match(app,/Este acerto mudou ou já foi resolvido/);assert.match(app,/Não foi possível reler este acerto agora/);assert.match(app,/getScheduledMemberSettlementContext/);});
test('stale feedback stays navigation-only and records no financial mutation',()=>{const notices=app.match(/showAttentionNotice\([^)]*\)/g)?.join('\n')??'';assert.doesNotMatch(notices,/settle|pay|transfer|rpc|insert|update|delete/i);assert.match(app,/Nada foi movimentado/);});
