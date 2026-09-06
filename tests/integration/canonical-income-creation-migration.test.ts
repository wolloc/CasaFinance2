import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';

const root = process.cwd();
const sql = fs.readFileSync(path.join(root, 'supabase/migrations/202609060038_canonical_income_creation.sql'), 'utf8');
const productSpec = fs.readFileSync(path.join(root, 'docs/product-spec-v2.md'), 'utf8');
const constitution = fs.readFileSync(path.join(root, 'docs/casa-finance-constitution.md'), 'utf8');

describe('Migration 038 canonical income creation', () => {
  it('requires explicit true-income nature, beneficiary and planned destination', () => {
    assert.match(sql, /create type public\.income_nature as enum \('salary','rent','freelance','bonus','gift','interest_yield','other_true_income'\)/);
    assert.match(sql, /p_beneficiary_member_id uuid/);
    assert.match(sql, /p_planned_destination_account_id uuid/);
    assert.match(sql, /active household beneficiary required/);
    assert.match(sql, /type in \('cash','checking','savings','digital_wallet'\)/);
    assert.match(sql, /resource_restriction is null/);
  });

  it('creates one economic income fact plus one projected cash leg, never realized cash', () => {
    assert.match(sql, /insert into public\.transactions/);
    assert.match(sql, /'income','pending',p_economic_state/);
    assert.match(sql, /insert into public\.money_movements/);
    assert.match(sql, /'income','projected'/);
    assert.doesNotMatch(sql, /'income','realized'/);
    assert.match(sql, /beneficiary_member_id,destination_account_id,category_id,related_transaction_id/);
  });

  it('keeps forecast and confirmed distinct', () => {
    assert.match(sql, /p_economic_state not in \('forecast','confirmed'\)/);
    assert.match(sql, /case when p_economic_state='confirmed' then p_amount end/);
    assert.match(productSpec, /Estados seguem a prioridade conceitual \*\*Realizado > Confirmado > Previsto\*\*/);
    assert.match(constitution, /Previsto não é realizado/i);
  });

  it('matches the Product Spec true-income boundary', () => {
    assert.match(productSpec, /Renda verdadeira inclui salário, aluguel, freelance, bônus, presente e juros\/rendimento/);
    assert.match(productSpec, /Não são renda: transferência, refund, recebimento de recebível, empréstimo tomado, resgate de principal e acerto/);
    assert.match(sql, /Fluxos neutros como transferencia, recebivel, emprestimo, acerto, refund e resgate usam seus motores proprios/);
  });
});
