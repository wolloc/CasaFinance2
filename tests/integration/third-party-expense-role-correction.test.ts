import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const source=fs.readFileSync(path.join(root,'src/components/app/ExpenseRoleCorrectionAction.tsx'),'utf8');
const finance=fs.readFileSync(path.join(root,'src/finance/expenseRoleCorrections.ts'),'utf8');
const migration=fs.readFileSync(path.join(root,'supabase/migrations/202610040001_allow_third_party_role_correction.sql'),'utf8');

test('correção de responsabilidade permite terceiro no editor',()=>{
  assert.match(source,/listFinancialParties/);
  assert.match(source,/Adicionar terceiro/);
  assert.match(source,/kind==='party'/);
  assert.match(finance,/party_id:string|null/);
  assert.match(finance,/responsibility:Array/);
  assert.match(migration,/jsonb_array_length\(p_responsibility\) not between 1 and 3/);
  assert.match(migration,/responsible_party_id/);
  assert.doesNotMatch(migration,/third-party responsibility requires a dedicated correction route/);
});
