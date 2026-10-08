import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { allocateProportionally } from '../../src/finance/economicAllocations.ts';

const wizard = await readFile(new URL('../../src/components/app/NewExpenseWizard.tsx', import.meta.url), 'utf8');
const service = await readFile(new URL('../../src/finance/simpleCardPixExpense.ts', import.meta.url), 'utf8');
const sql = await readFile(new URL('../../supabase/migrations/202609090067_simple_card_pix_expense.sql', import.meta.url), 'utf8');

test('Nova Despesa exposes Pix por cartão after selecting the real card resource', () => {
  assert.match(wizard, /Pix/);
  assert.match(wizard, /chooseCardRoute\('pix'\)/);
  assert.match(wizard, /Encargos financeiros/);
  assert.match(wizard, /Total no cartão/);
  assert.match(wizard, /createSimpleCardPixExpense/);
  assert.doesNotMatch(wizard, /Categoria da tarifa|Categoria dos juros|Responsável pela tarifa|Responsável pelos juros/);
});

test('simplified card Pix command preserves principal and charge as separate economic facts without cash', () => {
  assert.match(sql, /principal_tx:=public\.create_financial_transaction/);
  assert.match(sql, /'card_pix','principal'/);
  assert.match(sql, /charge_tx:=public\.create_financial_transaction/);
  assert.match(sql, /Encargos financeiros PIX no cartão/);
  assert.match(sql, /transaction_links[\s\S]*principal_tx,charge_tx,'fee'/);
  assert.doesNotMatch(sql, /insert into public\.money_movements/);
  assert.doesNotMatch(sql, /insert into public\.funding_events/);
});

test('product-facing command keeps category optional and responsibility explicit', () => {
  assert.match(sql, /p_category_id uuid/);
  assert.match(sql, /p_transaction_date,null,[\s\S]*p_buyer_member_id,'card'/);
  assert.match(sql, /p_principal_splits/);
  assert.match(sql, /p_charge_splits/);
  assert.match(service, /principalResponsibility/);
  assert.match(service, /chargeResponsibility/);
  assert.match(service, /p_category_id: input\.categoryId \|\| null/);
});

test('principal and charge follow the same card installment route and retry-safe command', () => {
  assert.match(sql, /p_installment_count/);
  assert.match(sql, /p_principal_splits,'\[\]'::jsonb\),p_installment_count/);
  assert.match(sql, /p_charge_splits,'\[\]'::jsonb\),p_installment_count/);
  assert.match(sql, /financial_command_existing_or_lock/);
  assert.match(sql, /financial_command_store/);
  assert.match(service, /runRetryStableRpc/);
});

test('card Pix charge allocation closes in cents and never sends zero amounts', () => {
  const allocations = allocateProportionally('0.10', [
    { memberId: 'member-a', amount: '99.00', percentage: '99.0000' },
    { partyId: 'party-a', amount: '1.00', percentage: '1.0000' },
  ]);
  assert.equal(allocations.reduce((sum, row) => sum + Math.round(Number(row.amount) * 100), 0), 10);
  assert.ok(allocations.every((row) => Number(row.amount) > 0));
  assert.match(wizard, /allocateProportionally\(financialCharges \|\| '0', splits\)/);
});
