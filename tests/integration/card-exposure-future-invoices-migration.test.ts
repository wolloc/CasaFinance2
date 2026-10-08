import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { describe, it } from 'node:test';

const migrationDir = new URL('../../supabase/migrations/', import.meta.url);
const migration = (name: string) => readFile(new URL(name, migrationDir), 'utf8');

const approvedHashes: Record<string, string> = {
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
  '202609040018_financial_engine_v1_model.sql': 'c61cb452173ea51425f607034afb43dc44f3bec43e1c7cb136b9fc46b58fcfb0',
  '202609040019_financial_engine_v1_security.sql': '6ab3b2f2f043c03222f43c48aee97c73ab742d151655964434890b97b8579802',
  '202609040020_financial_engine_v1_rpcs.sql': 'a1bb7f686c11cc6ee9dd4a6e6709e57f3b16e1578459d0f7be60deae2405b951',
  '202609040021_financial_engine_v1_read_models.sql': '21012439b565789c94c59f912e80b386a3aa2a4956e4c457aa510d85e89c574c',
  '202609050022_financial_engine_v2_foundation.sql': '6f604d7ad64f1bcf5dae9b4ce6cb392454df0c46f7b3282cb82fb0b1c9134a84',
  '202609050023_member_settlements.sql': '1c0fba14bf51507f4b95c3c196911f93b0d4039c1d80cdd0397be3af7d0f3f36',
  '202609050024_financial_commitments.sql': '0f8a77f4656e2e671b548fddaad9c3c1382f8af72dbe3607465db55ee186a83d',
  '202609050025_financial_monthly_projections.sql': '3213d8e6161b12a4e3db00ac573f10fbcac9af02465013c22d4efc09cdf66914',
  '202609050026_financial_member_perspectives.sql': '25359fce6b5e145b881857892704b0b65d86a790aec145addd017f9e39e5e3c9',
};

describe('Migration 027 card exposure and future invoices', () => {
  it('keeps every approved migration byte-for-byte immutable', async () => {
    const names = (await readdir(migrationDir)).filter((name) => name.startsWith('202609') && /00(?:0[0-9]|1[0-9]|2[0-6])_/.test(name));
    assert.deepEqual(names.sort(), Object.keys(approvedHashes).sort());
    for (const [name, hash] of Object.entries(approvedHashes)) {
      assert.equal(createHash('sha256').update(await migration(name)).digest('hex'), hash, name);
    }
  });

  it('defines invoker-security canonical models and least privilege', async () => {
    const sql = await migration('202609050027_card_exposure_future_invoices.sql');
    for (const view of ['financial_card_invoice_positions', 'financial_card_commitment_positions', 'financial_card_future_commitments', 'financial_card_exposure_positions', 'financial_member_card_positions']) {
      assert.match(sql, new RegExp(`view public\\.${view}\\nwith \\(security_invoker=true\\)`));
      assert.match(sql, new RegExp(`revoke all on public\\.${view} from public,anon`));
      assert.match(sql, new RegExp(`grant select on public\\.${view} to authenticated`));
    }
  });

  it('uses mutually exclusive invoice-first commitment buckets and canonical financial month', async () => {
    const sql = await migration('202609050027_card_exposure_future_invoices.sql');
    const commitments = sql.slice(sql.indexOf('financial_card_commitment_positions'), sql.indexOf('comment on view public.financial_card_commitment_positions'));
    assert.match(commitments, /coalesce\(inv\.card_id,pi\.card_id\)/);
    assert.match(commitments, /when inv\.id is not null[\s\S]*'current_invoice'[\s\S]*'future_invoice'[\s\S]*'future_uninvoiced'/);
    assert.match(commitments, /cp\.financial_month/);
    assert.doesNotMatch(commitments, /date_trunc\('month',cp\.(?:economic_date|financial_date)/);
  });

  it('does not infer responsibility from operational roles or defaults', async () => {
    const sql = await migration('202609050027_card_exposure_future_invoices.sql');
    const member = sql.slice(sql.indexOf('financial_member_card_positions'), sql.indexOf('comment on view public.financial_member_card_positions'));
    assert.match(member, /financial_member_commitment_responsibility_positions/);
    assert.doesNotMatch(member, /buyer_member_id|created_by_member_id|default_payment_account_id/);
    assert.doesNotMatch(member, /owner_member_id\s*=|owner_member_id\)/);
  });

  it('keeps limit arithmetic explicit and never creates economic or funding facts', async () => {
    const sql = await migration('202609050027_card_exposure_future_invoices.sql');
    assert.match(sql, /credit_limit-total_exposure/);
    assert.match(sql, /greatest\(total_exposure-credit_limit,0\)/);
    assert.match(sql, /round\(total_exposure\/credit_limit,6\)/);
    assert.doesNotMatch(sql, /insert into public\.(?:transactions|funding_events|economic_allocations)|update public\.(?:transactions|funding_events|economic_allocations)/);
  });
});
