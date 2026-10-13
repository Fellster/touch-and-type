begin;
create temp table acceptance_fixture as select id owner,(select id from auth.users where id<>u.id limit 1) actor,gen_random_uuid() team,gen_random_uuid() invite from auth.users u limit 1;
grant select on acceptance_fixture to service_role;
insert into public.teams(id,name,created_by) select team,'Rollback runtime permission test',owner from acceptance_fixture;
insert into public.team_invitations(id,team_id,email,role,token_hash,code_hash,invited_by,expires_at)
select f.invite,f.team,u.email,'member',f.invite::text,f.invite::text,f.owner,clock_timestamp()+interval '1 day'
from acceptance_fixture f join auth.users u on u.id=f.actor;
set local role service_role;
do $$ declare f record; result uuid; begin
select * into f from acceptance_fixture;
begin perform public.accept_team_invitation(f.owner,f.invite::text,true); raise exception 'Wrong account accepted'; exception when insufficient_privilege then null; end;
result:=public.accept_team_invitation(f.actor,f.invite::text,true);
if result<>f.team then raise exception 'Wrong team'; end if;
begin perform public.accept_team_invitation(f.actor,f.invite::text,true); raise exception 'Reuse accepted'; exception when no_data_found then null; end;
end $$;
reset role;
do $$ begin
if has_function_privilege('authenticated','public.accept_team_invitation(uuid,text,boolean)','EXECUTE') or has_function_privilege('anon','public.accept_team_invitation(uuid,text,boolean)','EXECUTE') then raise exception 'Client execution allowed'; end if;
end $$;
rollback;