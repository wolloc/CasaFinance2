-- Corrige a resolucao das funcoes pgcrypto quando o search_path da RPC e restrito.
-- A migration 008 ja esta aplicada; esta apenas substitui os corpos das RPCs.

create or replace function public.create_household_invitation(invited_email text default null)
returns table (invitation_id uuid, household_id uuid, token text, expires_at timestamptz)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  caller_id uuid := auth.uid();
  owner_household_id uuid;
  plain_token text := encode(extensions.gen_random_bytes(32), 'hex');
  invitation_expiry timestamptz := now() + interval '7 days';
begin
  if caller_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  select member.household_id into owner_household_id
  from public.household_members as member
  where member.profile_id = caller_id
    and member.role = 'owner'
    and member.deactivated_at is null
  order by member.joined_at
  limit 1;

  if owner_household_id is null then
    raise exception 'only an active household owner can create invitations' using errcode = '42501';
  end if;

  perform 1 from public.households as household where household.id = owner_household_id for update;
  if (select count(*) from public.household_members as member
      where member.household_id = owner_household_id and member.deactivated_at is null) >= 2 then
    raise exception 'household member limit reached' using errcode = '23514';
  end if;

  return query
  insert into public.household_invitations as invitation (household_id, token_hash, invited_email, created_by, expires_at)
  values (
    owner_household_id,
    extensions.digest(convert_to(plain_token, 'UTF8'), 'sha256'),
    nullif(lower(trim(invited_email)), ''),
    caller_id,
    invitation_expiry
  )
  returning invitation.id, invitation.household_id, plain_token, invitation.expires_at;
end;
$$;

create or replace function public.accept_household_invitation(invitation_token text)
returns table (status text, household_id uuid)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  caller_id uuid := auth.uid();
  invitation public.household_invitations;
  existing_household_id uuid;
  caller_email text;
begin
  if caller_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  if invitation_token is null or invitation_token !~ '^[0-9a-fA-F]{64}$' then
    raise exception 'invitation is invalid' using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(caller_id::text, 0));

  select stored_invitation.* into invitation
  from public.household_invitations as stored_invitation
  where stored_invitation.token_hash = extensions.digest(convert_to(invitation_token, 'UTF8'), 'sha256')
  for update;

  if invitation.id is null then
    raise exception 'invitation is invalid' using errcode = '22023';
  end if;
  if invitation.accepted_at is not null then
    if invitation.accepted_by = caller_id then
      return query select 'already_member'::text, invitation.household_id;
      return;
    end if;
    raise exception 'invitation has already been used' using errcode = '22023';
  end if;
  if invitation.expires_at <= now() then
    raise exception 'invitation has expired' using errcode = '22023';
  end if;

  select lower(auth_user.email) into caller_email
  from auth.users as auth_user
  where auth_user.id = caller_id;
  if invitation.invited_email is not null and lower(trim(coalesce(caller_email, ''))) <> invitation.invited_email then
    raise exception 'invitation email does not match the authenticated account' using errcode = '42501';
  end if;

  perform 1 from public.households as household where household.id = invitation.household_id for update;
  select member.household_id into existing_household_id
  from public.household_members as member
  where member.profile_id = caller_id and member.deactivated_at is null
  order by member.joined_at
  limit 1;

  if existing_household_id is not null then
    if existing_household_id = invitation.household_id then
      update public.household_invitations as stored_invitation
      set accepted_at = now(), accepted_by = caller_id
      where stored_invitation.id = invitation.id;
      return query select 'already_member'::text, invitation.household_id;
      return;
    end if;
    raise exception 'user already belongs to another household' using errcode = '23514';
  end if;

  insert into public.profiles (id, display_name)
  select caller_id,
         coalesce(nullif(trim(auth_user.raw_user_meta_data ->> 'display_name'), ''),
                  nullif(trim(auth_user.raw_user_meta_data ->> 'full_name'), ''),
                  nullif(split_part(coalesce(auth_user.email, ''), '@', 1), ''), 'Usuario')
  from auth.users as auth_user
  where auth_user.id = caller_id
  on conflict (id) do nothing;

  insert into public.household_members (household_id, profile_id, role)
  values (invitation.household_id, caller_id, 'member');

  update public.household_invitations as stored_invitation
  set accepted_at = now(), accepted_by = caller_id
  where stored_invitation.id = invitation.id;

  return query select 'accepted'::text, invitation.household_id;
end;
$$;

revoke all on function public.create_household_invitation(text) from public, anon;
revoke all on function public.accept_household_invitation(text) from public, anon;
grant execute on function public.create_household_invitation(text) to authenticated;
grant execute on function public.accept_household_invitation(text) to authenticated;