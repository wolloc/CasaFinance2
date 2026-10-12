-- Add a distinct ledger kind for cash received from a third party against a future commitment.
-- Separate migration because PostgreSQL enum values must be committed before use.
alter type public.money_movement_kind add value if not exists 'third_party_contribution';
