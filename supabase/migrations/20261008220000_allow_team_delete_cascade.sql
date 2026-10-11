-- Preserve the last-administrator safeguard for active Teams while allowing
-- memberships to cascade when the Team itself is intentionally deleted.

create or replace function private.keep_team_admin()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if tg_op = 'DELETE'
     and not exists (select 1 from public.teams t where t.id = old.team_id) then
    return old;
  end if;

  if old.role = 'admin' and (tg_op = 'DELETE' or new.role <> 'admin') then
    if not exists (
      select 1 from public.team_members tm
      where tm.team_id = old.team_id
        and tm.user_id <> old.user_id
        and tm.role = 'admin'
    ) then
      raise exception 'A team must always have at least one administrator';
    end if;
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end
$function$;
