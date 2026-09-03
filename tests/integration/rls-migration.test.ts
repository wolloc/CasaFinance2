import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { describe, it } from 'node:test';

describe('contrato de RLS Supabase', () => {
  it('habilita RLS e cobre todas as tabelas publicas', async () => {
    const sql = await readFile(new URL('../../supabase/migrations/202609030004_rls_release_readiness.sql', import.meta.url), 'utf8');
    assert.match(sql, /enable row level security/i);
    assert.match(sql, /auth\.uid\(\)/i);
    for (const table of [
      'profiles', 'households', 'household_members', 'accounts', 'cards',
      'categories', 'transactions', 'transaction_splits',
      'transaction_payment_instruments', 'card_invoices',
      'card_invoice_payments', 'funding_events', 'transfers', 'recurring_rules',
      'recurring_occurrences', 'installment_plans', 'installments', 'loans',
      'loan_installments', 'settlements', 'money_movements', 'audit_logs',
      'document_imports', 'merchant_category_rules',
    ]) assert.match(sql, new RegExp(`'${table}'`));
    assert.match(sql, /with check \(public\.is_active_household_member\(household_id\)\)/i);
    assert.match(sql, /revoke all on table public\.%I from anon/i);
  });

  it('define bootstrap atomico e administracao de membros por owner', async () => {
    const sql = await readFile(new URL('../../supabase/migrations/202609030004_rls_release_readiness.sql', import.meta.url), 'utf8');
    assert.match(sql, /create trigger on_auth_user_created/i);
    assert.match(sql, /function public\.bootstrap_household/i);
    assert.match(sql, /values \(created_household\.id, caller_id, 'owner'\)/i);
    assert.match(sql, /members_insert[\s\S]+is_household_owner\(household_id\)/i);
    assert.doesNotMatch(sql, /create policy .*households for insert/is);
  });

  it('valida e normaliza o fuso horario antes de persistir a casa', async () => {
    const sql = await readFile(new URL('../../supabase/migrations/202609030005_validate_bootstrap_timezone.sql', import.meta.url), 'utf8');
    assert.match(sql, /from pg_catalog\.pg_timezone_names/i);
    assert.match(sql, /where name = trim\(household_timezone\)/i);
    assert.match(sql, /values \(trim\(household_name\), household_currency, trim\(household_timezone\)\)/i);
    assert.match(sql, /revoke all on function public\.bootstrap_household\(text, char, text\) from public, anon/i);
  });

  it('restringe o bootstrap aos fusos compativeis com Intl.DateTimeFormat', async () => {
    const sql = await readFile(new URL('../../supabase/migrations/202609030006_require_intl_timezone.sql', import.meta.url), 'utf8');
    assert.match(sql, /security definer/i);
    assert.match(sql, /set search_path = public, pg_temp/i);
    assert.match(sql, /trim\(household_timezone\) not in \('America\/Sao_Paulo'\)/i);
    assert.doesNotMatch(sql, /pg_timezone_names/i);
    assert.match(sql, /insert into public\.households[\s\S]+insert into public\.household_members/i);
    assert.match(sql, /revoke all on function public\.bootstrap_household\(text, char, text\) from public, anon/i);
    assert.match(sql, /grant execute on function public\.bootstrap_household\(text, char, text\) to authenticated/i);
  });

});
