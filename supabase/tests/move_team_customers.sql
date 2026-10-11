-- Run against a test database with at least two Auth users. All fixtures roll back.
begin;
create temp table move_test as
select id actor, (select id from auth.users where id<>u.id limit 1) member,
  gen_random_uuid() source,gen_random_uuid() destination,gen_random_uuid() customer
from auth.users u limit 1;
grant select on move_test to service_role;
insert into public.teams(id,name,created_by)
select source,'Move test source',actor from move_test union all select destination,'Move test destination',actor from move_test;
insert into public.team_members(team_id,user_id,role) select source,member,'member' from move_test;
insert into public.customers(id,name,user_id,team_id) select customer,'Move test customer',actor,source from move_test;
insert into public.team_customer_access(customer_id,user_id,permission,granted_by) select customer,member,'view',actor from move_test;
set local role service_role;
do $$ declare t record; begin
  select * into strict t from move_test;
  if t.member is null then raise exception 'Test requires two Auth users'; end if;
  begin
    perform public.move_team_customers(t.member,t.source,array[t.customer],null,t.member);
    raise exception 'TEST FAILED member allowed';
  exception when others then
    if sqlerrm <> 'Only a source Team administrator can move customers' then raise; end if;
  end;
  begin
    perform public.move_team_customers(t.actor,t.source,array[t.customer,gen_random_uuid()],t.destination,t.actor);
    raise exception 'TEST FAILED invalid batch allowed';
  exception when others then
    if sqlerrm <> 'Some selected customers are missing or have changed workspace. Refresh and try again' then raise; end if;
  end;
  if not exists(select 1 from public.team_customer_access where customer_id=t.customer) then raise exception 'TEST FAILED rollback lost grants'; end if;
  perform public.move_team_customers(t.actor,t.source,array[t.customer],t.destination,t.actor);
  if not exists(select 1 from public.customers where id=t.customer and team_id=t.destination)
     or exists(select 1 from public.team_customer_access where customer_id=t.customer) then raise exception 'TEST FAILED move or cleanup'; end if;
  perform public.move_team_customers(t.actor,t.destination,array[t.customer],null,t.actor);
  if not exists(select 1 from public.customers where id=t.customer and team_id is null and user_id=t.actor) then raise exception 'TEST FAILED personal move'; end if;
end $$;
reset role;
do $$ begin
  if has_function_privilege('authenticated','public.move_team_customers(uuid,uuid,uuid[],uuid,uuid)','EXECUTE') then raise exception 'TEST FAILED public RPC access'; end if;
end $$;
rollback;
