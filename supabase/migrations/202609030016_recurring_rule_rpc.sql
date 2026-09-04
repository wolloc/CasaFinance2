create or replace function public.create_recurring_rule(p_household_id uuid,p_template_transaction_id uuid,p_frequency text,p_interval_count integer,p_start_date date,p_end_date date default null)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare caller public.household_members; result uuid;
begin
 caller:=public.require_active_member(p_household_id);
 if p_frequency not in ('weekly','monthly','yearly') or p_interval_count<1 or not exists(select 1 from public.transactions where id=p_template_transaction_id and household_id=p_household_id and deleted_at is null) then raise exception 'invalid recurring rule' using errcode='23514'; end if;
 insert into public.recurring_rules(household_id,created_by_member_id,template_transaction_id,frequency,interval_count,start_date,end_date,next_occurrence_date)
 values(p_household_id,caller.id,p_template_transaction_id,p_frequency,p_interval_count,p_start_date,p_end_date,p_start_date) returning id into result;
 return result;
end $$;
revoke all on function public.create_recurring_rule(uuid,uuid,text,integer,date,date) from public,anon;
grant execute on function public.create_recurring_rule(uuid,uuid,text,integer,date,date) to authenticated;
