import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { describe, it } from 'node:test';

const migration = (name: string) => readFile(new URL(`../../supabase/migrations/${name}`, import.meta.url), 'utf8');

describe('Etapa 10C financial engine v1 database contract', () => {
  it('does not change any applied migration 001-017', async () => {
    const hashes: Record<string, string> = {
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
      '202609030017_fix_installment_invoice_funding.sql': '342821dc41eb7574ad29f1f97a3b8bba64a822f85c48610f158ef38800838c8e',
    };
    for (const [name, hash] of Object.entries(hashes)) {
      assert.equal(createHash('sha256').update(await migration(name)).digest('hex'), hash, `${name} is immutable`);
    }
  });

  it('separates economics, cash, obligations, parties, ownership and financing', async () => {
    const sql = await migration('202609040018_financial_engine_v1_model.sql');
    for (const table of ['financial_parties', 'economic_allocations', 'financial_obligations', 'obligation_events', 'account_ownerships', 'account_balance_events', 'transaction_links', 'transaction_components', 'financing_allocations']) {
      assert.match(sql, new RegExp(`create table public\\.${table}`));
    }
    assert.match(sql, /responsible_member_id[\s\S]+responsible_party_id/);
    assert.match(sql, /card_pix/);
    assert.match(sql, /LEGACY: use account_ownerships/);
    assert.match(sql, /new loans use financial_obligations/i);
    assert.match(sql, /no auth profile and no legacy DatabaseStore linkage/i);
  });

  it('enforces household boundaries and exposes writes only through authenticated RPCs', async () => {
    const security = await migration('202609040019_financial_engine_v1_security.sql');
    const rpcs = await migration('202609040020_financial_engine_v1_rpcs.sql');
    for (const table of ['financial_parties', 'economic_allocations', 'financial_obligations', 'obligation_events', 'account_ownerships', 'account_balance_events', 'transaction_links', 'transaction_components', 'financing_allocations']) {
      assert.match(security, new RegExp(`'${table}'`));
    }
    assert.match(security, /cross-household reference/);
    assert.match(security, /enable row level security/i);
    assert.match(security, /revoke insert,update,delete,truncate,references,trigger/i);
    assert.match(security, /for select to authenticated using \(public\.is_active_household_member\(household_id\)\)/i);
    assert.match(rpcs, /security definer set search_path=public,pg_temp/g);
    assert.match(rpcs, /from public,anon[\s\S]+to authenticated/);
  });

  it('settles direct expenses and obligations without recognizing principal twice', async () => {
    const sql = await migration('202609040020_financial_engine_v1_rpcs.sql');
    assert.match(sql, /function public\.settle_direct_expense/);
    assert.match(sql, /'expense_payment','realized'/);
    assert.match(sql, /insert into public\.funding_events/);
    assert.match(sql, /function public\.settle_financial_obligation/);
    assert.match(sql, /'receivable_collection'/);
    assert.match(sql, /'payable_payment'/);
    assert.doesNotMatch(sql, /p_funder_member_id\s*:?=\s*p_buyer_member_id/i);
    assert.match(sql, /buyer\/owner must never be inferred as the funder/);
  });

  it('atomically turns external shared-expense allocations into receivables', async () => {
    const sql = await migration('202609040020_financial_engine_v1_rpcs.sql');
    const views = await migration('202609040021_financial_engine_v1_read_models.sql');
    assert.match(sql, /function public\.create_and_settle_shared_expense/);
    assert.match(sql, /perform public\.settle_direct_expense/);
    assert.match(sql, /'receivable','shared_expense'/);
    assert.match(sql, /split \? 'party_id'/);
    assert.match(sql, /source_transaction_id/);
    for (const field of ['gross_event_amount', 'gross_cash_paid', 'household_economic_amount', 'third_party_economic_amount', 'third_party_receivable_outstanding']) assert.match(views, new RegExp(field));
    assert.match(views, /sum\(amount\) filter\(where responsible_member_id is not null\) household_economic_amount/);
  });

  it('preserves estimated, confirmed and realized values and recurrence idempotency', async () => {
    const model = await migration('202609040018_financial_engine_v1_model.sql');
    const sql = await migration('202609040020_financial_engine_v1_rpcs.sql');
    assert.match(model, /economic_state[\s\S]+estimated_amount[\s\S]+confirmed_amount[\s\S]+realized_amount/);
    assert.match(sql, /function public\.confirm_financial_transaction/);
    assert.match(sql, /economic_state='confirmed'/);
    assert.match(sql, /if existing is not null then return existing/);
    assert.match(sql, /'planned','forecast'/);
    assert.match(sql, /insert into public\.economic_allocations[\s\S]+from public\.economic_allocations where transaction_id=template\.id/);
    assert.match(sql, /function public\.rescale_economic_allocations/);
    assert.match(sql, /row_number\(\) over\(order by[\s\S]+priority<=t\.target_cents-t\.base_total/);
    assert.doesNotMatch(sql, /change allocations before changing a split transaction amount/);
  });

  it('requires explicit loss allocations and realizes income only on receipt', async () => {
    const sql = await migration('202609040020_financial_engine_v1_rpcs.sql');
    assert.match(sql, /function public\.write_off_receivable\([^)]*p_splits jsonb/);
    assert.match(sql, /loss requires explicit economic allocations/);
    assert.match(sql, /loss allocations must equal loss amount and 100 percent/);
    assert.match(sql, /insert into public\.transaction_components[\s\S]+values\(p_household_id,loss_tx,'loss'/);
    assert.match(sql, /function public\.settle_income/);
    assert.match(sql, /case when p_type='income' then 'confirmed'/);
    assert.match(sql, /case when p_type='income' then 0 else p_amount end/);
    assert.match(sql, /'income','realized'/);
  });

  it('provides security-invoker read models for the minimum financial position', async () => {
    const sql = await migration('202609040021_financial_engine_v1_read_models.sql');
    for (const view of ['financial_account_balances', 'financial_obligation_balances', 'financial_invoice_positions', 'financial_transaction_positions', 'financial_member_positions', 'financial_household_position']) {
      assert.match(sql, new RegExp(`view public\\.${view} with \\(security_invoker=true\\)`));
    }
    for (const metric of ['available_money', 'restricted_resources', 'reserves', 'investments', 'receivables', 'payables', 'future_obligations', 'committed_balance', 'projected_balance', 'basic_net_worth', 'realized_household_expense', 'forecast_household_expense']) assert.match(sql, new RegExp(metric));
    assert.match(sql, /planned_payment_account_id/);
  });
});
