-- Preview minimo e autenticado para a experiencia de convite.
-- O token bruto somente transita como argumento e nunca e persistido.
create or replace function public.preview_household_invitation(invitation_token text)
returns table (household_name text, expires_at timestamptz)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  caller_id uuid := auth.uid();
  caller_email text;
  invitation public.household_invitations;
begin
  if caller_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  if invitation_token is null or invitation_token !~ '^[0-9a-fA-F]{64}$' then
    raise exception 'invitation is invalid' using errcode = '22023';
  end if;

  select stored_invitation.* into invitation
  from public.household_invitations as stored_invitation
  where stored_invitation.token_hash = extensions.digest(convert_to(invitation_token, 'UTF8'), 'sha256');

  if invitation.id is null then
    raise exception 'invitation is invalid' using errcode = '22023';
  end if;
  if invitation.accepted_at is not null then
    raise exception 'invitation has already been used' using errcode = '22023';
  end if;
  if invitation.expires_at <= now() then
    raise exception 'invitation has expired' using errcode = '22023';
  end if;

  select lower(auth_user.email) into caller_email
  from auth.users as auth_user
  where auth_user.id = caller_id;
  if invitation.invited_email is not null
     and lower(trim(coalesce(caller_email, ''))) <> invitation.invited_email then
    raise exception 'invitation email does not match the authenticated account' using errcode = '42501';
  end if;

  return query
  select household.name, invitation.expires_at
  from public.households as household
  where household.id = invitation.household_id;
end;
$$;

revoke all on function public.preview_household_invitation(text) from public, anon;
grant execute on function public.preview_household_invitation(text) to authenticated;
