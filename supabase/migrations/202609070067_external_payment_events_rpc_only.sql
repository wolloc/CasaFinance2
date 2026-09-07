-- Marco 3.01: fecha o bypass de escrita direta revelado pelo replay/teste em banco real.
-- Fatos de pagamento externo são legíveis via RLS, mas só podem nascer pelos comandos RPC canônicos.

revoke all on public.external_payment_events from public, anon;
revoke insert, update, delete on public.external_payment_events from authenticated;
grant select on public.external_payment_events to authenticated;

comment on table public.external_payment_events is
  'External payment facts are readable by active household members through RLS. Authenticated clients must create or change them only through canonical RPC commands; direct inserts, updates and deletes are forbidden.';
