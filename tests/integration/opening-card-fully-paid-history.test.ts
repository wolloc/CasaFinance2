import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const modal=readFileSync('src/components/auth/OpeningCardCommitmentsModal.tsx','utf8');
const opening=readFileSync('supabase/migrations/202609200097_financial_onboarding_opening_positions.sql','utf8');
const batch=readFileSync('supabase/migrations/20261003203000_opening_card_purchase_batch.sql','utf8');

assert.match(modal,/paidInstallmentCount > installmentCount/);
assert.doesNotMatch(modal,/paidInstallmentCount >= installmentCount/);
assert.match(opening,/p_installment_count=1 and p_paid_installment_count not in \(0,1\)/);
assert.match(opening,/select t\.invoice_id into invoice_id from public\.transactions as t/);
assert.match(batch,/installment_count=1 and paid_installment_count not in \(0,1\)/);
