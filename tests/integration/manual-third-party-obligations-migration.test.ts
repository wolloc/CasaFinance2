import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const sql = readFileSync('supabase/migrations/202609060060_manual_third_party_obligations.sql', 'utf8');

describe('manual third-party obligations migration', () => {
  it('creates an auditable authenticated command', () => {
    expect(sql).toContain('create table if not exists public.manual_obligation_events');
    expect(sql).toContain('create or replace function public.create_manual_third_party_obligation');
    expect(sql).toContain('public.require_active_member(p_household_id)');
    expect(sql).toContain("unique (household_id, request_key)");
    expect(sql).toContain('grant execute on function public.create_manual_third_party_obligation');
  });

  it('creates only the obligation and immutable history, never economic or cash facts', () => {
    expect(sql).toContain('insert into public.financial_obligations');
    expect(sql).toContain('insert into public.manual_obligation_events');
    expect(sql).not.toMatch(/insert into public\.transactions\s*\(/i);
    expect(sql).not.toMatch(/insert into public\.money_movements\s*\(/i);
    expect(sql).not.toMatch(/insert into public\.funding_events\s*\(/i);
    expect(sql).toContain('Deliberadamente sem transactions, money_movements ou funding_events');
  });

  it('requires a real active counterparty and valid dates', () => {
    expect(sql).toContain('active household counterparty required');
    expect(sql).toContain('p_due_date<p_obligation_date');
    expect(sql).toContain("p_kind not in ('receivable','payable')");
  });
});
