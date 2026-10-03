-- Allow the existing Accounts & Cards setup UI to edit identity/configuration.
-- RLS policies remain the household boundary; this only restores the table-level
-- UPDATE privilege required by PostgREST before RLS can evaluate cards_update/accounts_update.

grant update on table public.accounts to authenticated;
grant update on table public.cards to authenticated;

do $$
begin
  if not has_table_privilege('authenticated','public.accounts','UPDATE') then
    raise exception 'authenticated must have UPDATE on public.accounts';
  end if;
  if not has_table_privilege('authenticated','public.cards','UPDATE') then
    raise exception 'authenticated must have UPDATE on public.cards';
  end if;
end
$$;
