-- Personalização aditiva: preserva membros e lançamentos históricos.
alter table public.household_members
  add column if not exists color varchar(7) not null default '#2563eb';

alter table public.household_members
  drop constraint if exists household_members_color_hex;
alter table public.household_members
  add constraint household_members_color_hex check (color ~ '^#[0-9A-Fa-f]{6}$');

create or replace function public.enforce_two_active_household_members()
returns trigger
language plpgsql
as $$
begin
  if new.deactivated_at is null and (
    select count(*)
    from public.household_members member
    where member.household_id = new.household_id
      and member.deactivated_at is null
      and member.id <> new.id
  ) >= 2 then
    raise exception 'A casa aceita no máximo dois membros ativos';
  end if;
  return new;
end;
$$;

drop trigger if exists household_members_two_active on public.household_members;
create trigger household_members_two_active
before insert or update of household_id, deactivated_at on public.household_members
for each row execute function public.enforce_two_active_household_members();
