drop policy if exists "admins delete teams" on public.teams;
drop policy if exists "creator deletes teams" on public.teams;
create policy "creator deletes teams" on public.teams for delete to authenticated using (created_by=(select auth.uid()));
create or replace function private.protect_team_membership_identity()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
  if tg_op='UPDATE' then
    if new.team_id is distinct from old.team_id or new.user_id is distinct from old.user_id then raise exception 'Team membership identity cannot be changed'; end if;
  end if;
  if exists(select 1 from public.teams where id=old.team_id and created_by=old.user_id) then
    if tg_op='DELETE' then raise exception 'The Team creator cannot be removed'; end if;
    if new.role<>'admin' then raise exception 'The Team creator must remain an administrator'; end if;
  end if;
  if tg_op='DELETE' then return old; end if;
  return new;
end $$;
revoke all on function private.protect_team_membership_identity() from public,anon,authenticated;
drop trigger if exists protect_team_membership_identity on public.team_members;
create trigger protect_team_membership_identity before update or delete on public.team_members for each row execute function private.protect_team_membership_identity();
