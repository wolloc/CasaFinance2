import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { describe, it } from 'node:test';

const migration = (name: string) => readFile(new URL(`../../supabase/migrations/${name}`, import.meta.url), 'utf8');

describe('Etapa 9 financial core database contract', () => {
  it('adds the corrective migration without changing applied migrations 001-016', async () => {
    const appliedMigrationHashes: Record<string, string> = {
      '202609030001_finance_ledger.sql': '07027af90506bf5485377bfa21fd7b13e82ddef5c8669362c30f5667b27d1fe4',
      '202609030002_household_customization.sql': '7480ef109afe2d3675689f5147f8614b7e01b9707889263f773392a6e8f1c2ab',
      '202609030003_income_money_movements.sql': 'b3ae74a1009e08da96a2eba47f4387ba94b65cd481430f7067d8e97a9352fe19',
      '202609030004_rls_release_readiness.sql': '92fd634035fe22c5659baa8107f0d02b5f9857e7ad40a788e0571e528a12ecc6',
      '202609030005_validate_bootstrap_timezone.sql': '955351529eb028c2b7f1da13716891b54a710df5e518085a82a849703910e74a',
      '202609030006_require_intl_timezone.sql': '0be47f56015139a68720eeab3643f368a12647ccd7172723f8265217e991ecfc',
      '202609030007_atomic_bootstrap_household.sql': '5cb7571dffcda132923d9de11bb9e22cb8a2eabe56f624cad60bd345862b8ffd',
      '202609030008_household_invitations.sql': '706b57aab4389001df49fabfaa551c2707e6b1e86e5d48ceb96dd692542e065c',
      '202609030009_fix_invitation_token_generation.sql': 'be4f9c269f93c6fe39f7626985df755e4e15293b826701a78945221e513275b4',
      '202609030010_preview_household_invitation.sql': 'e38198a47be84aceb91a28b69dc24f5c73786713c6450a7c57f6345cee922441',
      '202609030011_accounts_cards_rls.sql': '6a36440c0c597a6d6997684e92ac0a16e7b29ada7747e5514f81879c5d8ef210',
      '202609030012_categories_rls.sql': 'fe46e699d963a3f3361642c708912f3165d6422ce9b621fd7384599e7becaa76',
      '202609030013_transactions_rls.sql': 'd4503f57044588761076124deae78de56d8bb9af1ef7d4465bb0bb57e0cfc4bb',
      '202609030014_financial_core_integrity_rls.sql': 'aa44450609a426017038da2894f7efa5b05a5988fff94bc6ebe0f91d2faf9841',
      '202609030015_financial_core_rpcs.sql': 'cd678e657399fd1db4409acf850304e740d7be1f7ac70fccc6fe974bfe6ecf4f',
      '202609030016_recurring_rule_rpc.sql': '4530731ed21984e0ae7488b08b2a02678f582400234cace80d6c0a99adede7c9',
    };

    for (const [name, expectedHash] of Object.entries(appliedMigrationHashes)) {
      const contents = await migration(name);
      assert.equal(createHash('sha256').update(contents).digest('hex'), expectedHash, `${name} is immutable`);
    }

    assert.ok((await migration('202609030017_fix_installment_invoice_funding.sql')).length > 0);
  });

  it('hardens every historical entity with household-scoped read-only RLS', async () => {
    const sql = await migration('202609030014_financial_core_integrity_rls.sql');
    for (const table of ['transaction_splits','installment_plans','installments','card_invoices','card_invoice_payments','funding_events','transfers','money_movements','recurring_rules','recurring_occurrences']) assert.match(sql, new RegExp(`'${table}'`));
    assert.match(sql, /for select to authenticated using \(public\.is_active_household_member\(household_id\)\)/i);
    assert.doesNotMatch(sql, /for delete to authenticated/i);
    assert.match(sql, /cross-household reference/i);
  });

  it('keeps creator, buyer, owner, funder, and responsibility independent', async () => {
    const sql = await migration('202609030015_financial_core_rpcs.sql');
    assert.match(sql, /created_by_member_id,buyer_member_id/);
    assert.match(sql, /responsible_member_id,percentage,amount/);
    assert.match(sql, /p_funder_member_id/);
    assert.doesNotMatch(sql, /funder_member_id[^\n]+owner_member_id/i);
    assert.doesNotMatch(sql, /responsible_member_id[^\n]+owner_member_id/i);
  });

  it('enforces exact split and installment totals and atomic operations', async () => {
    const integrity = await migration('202609030014_financial_core_integrity_rls.sql');
    const rpc = await migration('202609030015_financial_core_rpcs.sql');
    assert.match(rpc, /split_sum<>p_amount or pct_sum<>100/);
    assert.match(integrity, /actual<>expected or actual_count<>expected_count/);
    assert.match(integrity, /deferrable initially deferred/i);
    for (const fn of ['create_financial_transaction','pay_card_invoice','create_transfer','generate_recurring_occurrence']) assert.match(rpc, new RegExp(`function public\\.${fn}`));
  });

  it('models card settlement as movement/funding rather than another expense', async () => {
    const sql = await migration('202609030015_financial_core_rpcs.sql');
    assert.match(sql, /'invoice_payment','paid'/);
    assert.match(sql, /insert into public\.funding_events/);
    assert.match(sql, /update public\.card_invoices set settled_amount/);
    assert.doesNotMatch(sql, /Pagamento de fatura'[^;]+,'expense'/i);
  });

  it('tracks installment funding per invoice without duplicating the purchase expense', async () => {
    const integrity = await migration('202609030017_fix_installment_invoice_funding.sql');
    const rpc = await migration('202609030015_financial_core_rpcs.sql');
    const correctiveRpc = await migration('202609030017_fix_installment_invoice_funding.sql');

    // A 12x purchase remains one expense; installments only describe its schedule.
    assert.match(rpc, /insert into public\.installment_plans/);
    assert.match(rpc, /insert into public\.installments/);
    const installmentLoop = rpc.match(/for i in 1\.\.p_installment_count loop([\s\S]*?)end loop;/i)?.[1];
    assert.ok(installmentLoop);
    assert.doesNotMatch(installmentLoop, /insert into public\.transactions/i);

    // First and second invoices have distinct allocation keys for the same purchase.
    assert.match(integrity, /funding_events\s+add column if not exists invoice_id/);
    assert.match(integrity, /funding_events\s+add column if not exists installment_id/);
    assert.match(integrity, /funding_events_allocation_unique/);
    assert.match(integrity, /nulls not distinct/);
    assert.match(correctiveRpc, /f\.invoice_id=p_invoice_id/);
    assert.match(correctiveRpc, /f\.installment_id is not distinct from purchase\.installment_id/);
    assert.doesNotMatch(correctiveRpc, /where f\.financed_transaction_id=purchase\.id\),0/);
  });

  it('supports partial invoice funding and isolates every allocation by household', async () => {
    const integrity = await migration('202609030017_fix_installment_invoice_funding.sql');
    const rpc = await migration('202609030017_fix_installment_invoice_funding.sql');

    assert.match(rpc, /allocation:=least\(remaining,purchase\.amount-coalesce/);
    assert.match(rpc, /remaining:=remaining-allocation/);
    assert.match(rpc, /inv\.settled_amount\+p_amount>inv\.total_amount/);
    assert.match(rpc, /ins\.household_id=p_household_id/);
    assert.match(rpc, /ip\.household_id=p_household_id/);
    assert.match(integrity, /funding installment does not match invoice and purchase/);
    assert.match(integrity, /funding invoice belongs to another household/);
    assert.match(integrity, /funding must match its invoice payment/);
  });

  it('makes recurrence idempotent and transfer two-legged', async () => {
    const integrity = await migration('202609030014_financial_core_integrity_rls.sql');
    const rpc = await migration('202609030015_financial_core_rpcs.sql');
    assert.match(integrity, /unique index[^;]+recurring_occurrences_idempotency/is);
    assert.match(rpc, /if existing is not null then return existing/);
    assert.match(rpc, /insert into public\.transfers/);
    assert.match(rpc, /insert into public\.money_movements/);
  });
});
