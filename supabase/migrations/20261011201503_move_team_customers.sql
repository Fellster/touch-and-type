-- Only the verified service endpoint can invoke a transactional workspace move.
create or replace function private.protect_team_and_customer_ownership()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
  if tg_table_name='teams' then
    if new.created_by is distinct from old.created_by then raise exception 'Team ownership cannot be changed directly'; end if;
  elsif tg_table_name='customers' then
    if new.user_id is distinct from old.user_id or new.team_id is distinct from old.team_id then
      if current_user <> 'service_role' or current_setting('noted.workspace_move',true) is distinct from 'allowed' then
        raise exception 'Customer workspace ownership cannot be changed directly';
      end if;
    end if;
  end if;
  return new;
end $$;

create or replace function public.move_team_customers(_actor uuid, _source uuid, _ids uuid[], _destination uuid, _owner uuid)
returns integer language plpgsql security invoker set search_path='' as $$
declare n integer; total integer;
begin
  total := cardinality(_ids);
  if total is null or total < 1 or total > 100 or total <> (select count(distinct x) from unnest(_ids) x) then raise exception 'Select between 1 and 100 distinct customers'; end if;
  -- Lock memberships against concurrent removal while checking authorization.
  perform 1 from public.team_members where team_id=_source and user_id=_actor and role='admin' for share;
  if not found then raise exception 'Only a source Team administrator can move customers'; end if;
  if _destination is not null then
    if _destination=_source then raise exception 'Choose a different workspace'; end if;
    perform 1 from public.team_members where team_id=_destination and user_id=_actor and role='admin' for share;
    if not found then raise exception 'You must administer the destination Team'; end if;
    perform 1 from public.team_members where team_id=_destination and user_id=_owner for share;
  else
    perform 1 from public.team_members where team_id=_source and user_id=_owner for share;
  end if;
  if not found then raise exception 'Choose a current member as the new owner'; end if;
  perform 1 from public.customers where id=any(_ids) and team_id=_source order by id for update;
  get diagnostics n=row_count;
  if n<>total then raise exception 'Some selected customers are missing or have changed workspace. Refresh and try again'; end if;
  delete from public.team_customer_access where customer_id=any(_ids);
  delete from public.customer_shares where customer_id=any(_ids);
  perform set_config('noted.workspace_move','allowed',true);
  update public.customers set team_id=_destination,user_id=_owner,updated_at=now() where id=any(_ids);
  perform set_config('noted.workspace_move','',true);
  return n;
end $$;
revoke all on function public.move_team_customers(uuid,uuid,uuid[],uuid,uuid) from public,anon,authenticated;
grant execute on function public.move_team_customers(uuid,uuid,uuid[],uuid,uuid) to service_role;
