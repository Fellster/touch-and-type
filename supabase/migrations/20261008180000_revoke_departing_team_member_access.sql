-- Removing a Team member must immediately revoke all Team-customer access.
-- Personal customer shares remain separate and are optionally revoked by the
-- authenticated administrator through the team-invitations Edge Function.

create or replace function public.can_view_customer(_customer_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select exists (
    select 1
    from public.customers c
    where c.id = _customer_id
      and (
        (c.team_id is null and c.user_id = auth.uid())
        or (
          c.team_id is not null
          and private.is_team_member(c.team_id)
          and (
            private.is_team_admin(c.team_id)
            or c.user_id = auth.uid()
            or exists (
              select 1 from public.team_customer_access a
              where a.customer_id = c.id and a.user_id = auth.uid()
            )
          )
        )
      )
  )
  or exists (
    select 1 from public.customer_shares s
    join public.customers c on c.id = s.customer_id
    where s.customer_id = _customer_id
      and c.team_id is null
      and s.recipient_user_id = auth.uid()
  )
$function$;

create or replace function public.can_edit_customer(_customer_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select exists (
    select 1
    from public.customers c
    where c.id = _customer_id
      and (
        (c.team_id is null and c.user_id = auth.uid())
        or (
          c.team_id is not null
          and private.is_team_member(c.team_id)
          and (
            private.is_team_admin(c.team_id)
            or c.user_id = auth.uid()
            or exists (
              select 1 from public.team_customer_access a
              where a.customer_id = c.id
                and a.user_id = auth.uid()
                and a.permission = 'edit'
            )
          )
        )
      )
  )
  or exists (
    select 1 from public.customer_shares s
    join public.customers c on c.id = s.customer_id
    where s.customer_id = _customer_id
      and c.team_id is null
      and s.recipient_user_id = auth.uid()
      and s.permission = 'edit'
  )
$function$;

drop policy if exists "view accessible customers" on public.customers;
create policy "view accessible customers"
on public.customers
for select
to authenticated
using (
  (team_id is null and user_id = (select auth.uid()))
  or (
    team_id is not null
    and private.is_team_member(team_id)
    and (
      private.is_team_admin(team_id)
      or user_id = (select auth.uid())
      or exists (
        select 1 from public.team_customer_access a
        where a.customer_id = customers.id
          and a.user_id = (select auth.uid())
      )
    )
  )
  or (
    team_id is null
    and exists (
      select 1 from public.customer_shares s
      where s.customer_id = customers.id
        and s.recipient_user_id = (select auth.uid())
    )
  )
);

create or replace function private.remove_departing_member_customer_access()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  delete from public.team_customer_access a
  using public.customers c
  where a.customer_id = c.id
    and c.team_id = old.team_id
    and a.user_id = old.user_id;
  return old;
end
$function$;

drop trigger if exists remove_departing_member_customer_access on public.team_members;
create trigger remove_departing_member_customer_access
after delete on public.team_members
for each row execute function private.remove_departing_member_customer_access();
