begin;

create extension if not exists pgtap with schema extensions;
select plan(6);

insert into auth.users(
  id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,
  raw_app_meta_data,raw_user_meta_data,created_at,updated_at
) values
 ('aa100000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','owner-member-management@example.invalid',crypt('test-only',gen_salt('bf')),now(),'{}','{"display_name":"Owner"}',now(),now()),
 ('aa100000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','member-management@example.invalid',crypt('test-only',gen_salt('bf')),now(),'{}','{"display_name":"Member"}',now(),now());

insert into public.households(id,name,timezone)
values ('aa100000-0000-4000-8000-000000000010','Casa Member Management','America/Sao_Paulo');

insert into public.household_members(id,household_id,profile_id,role,display_name) values
 ('aa100000-0000-4000-8000-000000000021','aa100000-0000-4000-8000-000000000010','aa100000-0000-4000-8000-000000000001','owner','Owner'),
 ('aa100000-0000-4000-8000-000000000022','aa100000-0000-4000-8000-000000000010','aa100000-0000-4000-8000-000000000002','member','Member');

set local role authenticated;
select set_config('request.jwt.claim.sub','aa100000-0000-4000-8000-000000000001',true);

select lives_ok($$
  select public.deactivate_household_member(
    'aa100000-0000-4000-8000-000000000010',
    'aa100000-0000-4000-8000-000000000022'
  )
$$,'owner can remove the other active member');

select is(
  (select count(*) from public.household_members where household_id='aa100000-0000-4000-8000-000000000010' and deactivated_at is null),
  1::bigint,
  'removal leaves one active member'
);

select ok(
  (select deactivated_at is not null from public.household_members where id='aa100000-0000-4000-8000-000000000022'),
  'removed membership is soft-deactivated'
);

select throws_ok(
  $$select public.deactivate_household_member('aa100000-0000-4000-8000-000000000010','aa100000-0000-4000-8000-000000000021')$$,
  '23514',
  'owner cannot remove themselves from the household',
  'owner cannot remove themselves'
);

reset role;
insert into public.household_invitations(id,household_id,token_hash,created_by,created_at,expires_at)
values(
  'aa100000-0000-4000-8000-000000000030',
  'aa100000-0000-4000-8000-000000000010',
  extensions.digest(convert_to(repeat('a',64),'UTF8'),'sha256'),
  'aa100000-0000-4000-8000-000000000001',
  now(),
  now()+interval '1 day'
);

set local role authenticated;
select set_config('request.jwt.claim.sub','aa100000-0000-4000-8000-000000000002',true);

select is(
  (select status from public.accept_household_invitation(repeat('a',64))),
  'accepted'::text,
  'previously removed member can accept a new invitation'
);

select is(
  (select id from public.household_members where household_id='aa100000-0000-4000-8000-000000000010' and profile_id='aa100000-0000-4000-8000-000000000002' and deactivated_at is null),
  'aa100000-0000-4000-8000-000000000022'::uuid,
  'reinvite reactivates the same historical membership row'
);

select * from finish();
rollback;
