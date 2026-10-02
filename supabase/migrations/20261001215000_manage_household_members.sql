-- Safe household member replacement.
-- Removing a member deactivates the membership and preserves all historical references.

create or replace function public.deactivate_household_member(
  p_household_id uuid,
  p_member_id uuid
)
returns uuid
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  caller public.household_members;
  target public.household_members;
begin
  caller:=public.require_active_member(p_household_id);
  if caller.role<>'owner' then
    raise exception 'only household owner can remove a member' using errcode='42501';
  end if;

  select * into target
  from public.household_members
  where id=p_member_id and household_id=p_household_id and deactivated_at is null
  for update;

  if target.id is null then
    raise exception 'active household member required' using errcode='23514';
  end if;
  if target.id=caller.id then
    raise exception 'owner cannot remove themselves from the household' using errcode='23514';
  end if;
  if target.role='owner' then
    raise exception 'another owner cannot be removed through this action' using errcode='23514';
  end if;

  update public.household_members
  set deactivated_at=now()
  where id=target.id;

  return target.id;
end $$;

revoke all on function public.deactivate_household_member(uuid,uuid) from public,anon;
grant execute on function public.deactivate_household_member(uuid,uuid) to authenticated;

-- Recreate invitation acceptance so a previously removed person can rejoin the same household
-- without violating the historical unique membership row.
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
  existing_membership public.household_members;
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

  if invitation.invited_email is not null
     and lower(trim(coalesce(caller_email, ''))) <> invitation.invited_email then
    raise exception 'invitation email does not match the authenticated account' using errcode = '42501';
  end if;

  perform 1 from public.households as household
  where household.id = invitation.household_id
  for update;

  select member.household_id into existing_household_id
  from public.household_members member
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
         coalesce(nullif(trim(u.raw_user_meta_data ->> 'display_name'), ''),
                  nullif(trim(u.raw_user_meta_data ->> 'full_name'), ''),
                  nullif(split_part(coalesce(u.email, ''), '@', 1), ''), 'Usuario')
  from auth.users u where u.id = caller_id
  on conflict (id) do nothing;

  select member.* into existing_membership
  from public.household_members member
  where member.household_id=invitation.household_id and member.profile_id=caller_id
  for update;

  if existing_membership.id is not null then
    update public.household_members member
    set deactivated_at=null, role='member', joined_at=now()
    where member.id=existing_membership.id;
  else
    insert into public.household_members (household_id, profile_id, role)
    values (invitation.household_id, caller_id, 'member');
  end if;

  update public.household_invitations as stored_invitation
  set accepted_at = now(), accepted_by = caller_id
  where stored_invitation.id = invitation.id;

  return query select 'accepted'::text, invitation.household_id;
end;
$$;

revoke all on function public.accept_household_invitation(text) from public, anon;
grant execute on function public.accept_household_invitation(text) to authenticated;

comment on function public.deactivate_household_member(uuid,uuid) is
  'Soft-removes a non-owner member from the active household while preserving historical financial references.';
