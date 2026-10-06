-- Functional Personal + Team workspace foundation.
-- Existing customers remain personal because team_id defaults to NULL.
-- To-Dos are intentionally unchanged and remain private to their creator.

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated, service_role;

create table public.teams (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 1 and 100),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.team_members (
  team_id uuid not null references public.teams(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('admin', 'member')),
  joined_at timestamptz not null default now(),
  primary key (team_id, user_id)
);

create table public.team_customer_access (
  customer_id uuid not null references public.customers(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  permission text not null check (permission in ('view', 'edit')),
  granted_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (customer_id, user_id)
);

create table public.team_invitations (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  email text not null,
  role text not null default 'member' check (role in ('admin', 'member')),
  token_hash text not null unique,
  code_hash text not null unique,
  invited_by uuid not null references auth.users(id) on delete restrict,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  check (expires_at > created_at)
);

alter table public.customers
  add column team_id uuid references public.teams(id) on delete restrict;

create index customers_team_id_idx on public.customers(team_id);
create index team_members_user_id_idx on public.team_members(user_id);
create index team_customer_access_user_id_idx on public.team_customer_access(user_id);
create index team_invitations_team_id_idx on public.team_invitations(team_id);
create index team_invitations_email_idx on public.team_invitations(lower(email));

create trigger teams_updated_at before update on public.teams
  for each row execute function public.set_updated_at();
create trigger team_customer_access_updated_at before update on public.team_customer_access
  for each row execute function public.set_updated_at();

create or replace function private.is_team_member(_team_id uuid, _user_id uuid default auth.uid())
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.team_members tm
    where tm.team_id = _team_id and tm.user_id = _user_id
  )
$$;

create or replace function private.is_team_admin(_team_id uuid, _user_id uuid default auth.uid())
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.team_members tm
    where tm.team_id = _team_id and tm.user_id = _user_id and tm.role = 'admin'
  )
$$;

create or replace function private.customer_team(_customer_id uuid)
returns uuid
language sql stable security definer
set search_path = ''
as $$
  select c.team_id from public.customers c where c.id = _customer_id
$$;

revoke all on function private.is_team_member(uuid, uuid) from public;
revoke all on function private.is_team_admin(uuid, uuid) from public;
revoke all on function private.customer_team(uuid) from public;
grant execute on function private.is_team_member(uuid, uuid), private.is_team_admin(uuid, uuid), private.customer_team(uuid)
  to authenticated, service_role;

create or replace function private.add_team_creator()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  if new.created_by <> auth.uid() then
    raise exception 'Team creator must be the signed-in user';
  end if;
  insert into public.team_members (team_id, user_id, role)
  values (new.id, new.created_by, 'admin');
  return new;
end
$$;

revoke all on function private.add_team_creator() from public, anon, authenticated;
create trigger add_team_creator
  after insert on public.teams
  for each row execute function private.add_team_creator();

create or replace function private.protect_team_and_customer_ownership()
returns trigger
language plpgsql security invoker
set search_path = ''
as $body$
begin
  if tg_table_name = 'teams' and new.created_by is distinct from old.created_by then
    raise exception 'Team ownership cannot be changed directly';
  end if;
  if tg_table_name = 'customers'
     and (new.user_id is distinct from old.user_id or new.team_id is distinct from old.team_id) then
    raise exception 'Customer workspace ownership cannot be changed directly';
  end if;
  return new;
end
$body$;

create trigger protect_team_ownership
  before update on public.teams
  for each row execute function private.protect_team_and_customer_ownership();
create trigger protect_customer_ownership
  before update on public.customers
  for each row execute function private.protect_team_and_customer_ownership();

create or replace function private.keep_team_admin()
returns trigger
language plpgsql security definer
set search_path = ''
as $body$
begin
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
$body$;

revoke all on function private.keep_team_admin() from public, anon, authenticated;
create trigger keep_team_admin
  before update or delete on public.team_members
  for each row execute function private.keep_team_admin();

create or replace function public.can_view_customer(_customer_id uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.customers c
    where c.id = _customer_id
      and (
        (c.team_id is null and c.user_id = auth.uid())
        or (c.team_id is not null and (
          private.is_team_admin(c.team_id)
          or c.user_id = auth.uid()
          or exists (
            select 1 from public.team_customer_access a
            where a.customer_id = c.id and a.user_id = auth.uid()
          )
        ))
      )
  )
  or exists (
    select 1 from public.customer_shares s
    where s.customer_id = _customer_id and s.recipient_user_id = auth.uid()
  )
$$;

create or replace function public.can_edit_customer(_customer_id uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.customers c
    where c.id = _customer_id
      and (
        (c.team_id is null and c.user_id = auth.uid())
        or (c.team_id is not null and (
          private.is_team_admin(c.team_id)
          or c.user_id = auth.uid()
          or exists (
            select 1 from public.team_customer_access a
            where a.customer_id = c.id
              and a.user_id = auth.uid()
              and a.permission = 'edit'
          )
        ))
      )
  )
  or exists (
    select 1 from public.customer_shares s
    where s.customer_id = _customer_id
      and s.recipient_user_id = auth.uid()
      and s.permission = 'edit'
  )
$$;

drop policy if exists "view own or shared customers" on public.customers;
drop policy if exists "insert own customers" on public.customers;
drop policy if exists "edit own or edit-shared customers" on public.customers;
drop policy if exists "owner deletes customers" on public.customers;

create policy "view accessible customers" on public.customers
  for select to authenticated
  using (public.can_view_customer(id));

create policy "insert personal or team customers" on public.customers
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and (team_id is null or private.is_team_member(team_id))
  );

create policy "edit accessible customers without moving ownership" on public.customers
  for update to authenticated
  using (public.can_edit_customer(id))
  with check (public.can_edit_customer(id));

create policy "delete personal or team customers" on public.customers
  for delete to authenticated
  using (
    (team_id is null and user_id = (select auth.uid()))
    or (team_id is not null and private.is_team_admin(team_id))
  );

alter table public.teams enable row level security;
alter table public.team_members enable row level security;
alter table public.team_customer_access enable row level security;
alter table public.team_invitations enable row level security;

create policy "members view teams" on public.teams
  for select to authenticated using (private.is_team_member(id));
create policy "users create teams" on public.teams
  for insert to authenticated with check (created_by = (select auth.uid()));
create policy "admins update teams" on public.teams
  for update to authenticated using (private.is_team_admin(id))
  with check (private.is_team_admin(id) and created_by = public.teams.created_by);
create policy "admins delete teams" on public.teams
  for delete to authenticated using (private.is_team_admin(id));

create policy "members view team roster" on public.team_members
  for select to authenticated using (private.is_team_member(team_id));
create policy "admins add members" on public.team_members
  for insert to authenticated with check (private.is_team_admin(team_id));
create policy "admins change members" on public.team_members
  for update to authenticated using (private.is_team_admin(team_id))
  with check (private.is_team_admin(team_id));
create policy "admins remove members" on public.team_members
  for delete to authenticated using (
    private.is_team_admin(team_id)
    and user_id <> (select auth.uid())
  );

create policy "members view relevant customer access" on public.team_customer_access
  for select to authenticated using (
    private.is_team_admin(private.customer_team(customer_id))
    or user_id = (select auth.uid())
  );
create policy "admins grant customer access" on public.team_customer_access
  for insert to authenticated with check (
    private.is_team_admin(private.customer_team(customer_id))
    and private.is_team_member(private.customer_team(customer_id), user_id)
    and granted_by = (select auth.uid())
  );
create policy "admins change customer access" on public.team_customer_access
  for update to authenticated using (
    private.is_team_admin(private.customer_team(customer_id))
  ) with check (
    private.is_team_admin(private.customer_team(customer_id))
    and private.is_team_member(private.customer_team(customer_id), user_id)
  );
create policy "admins revoke customer access" on public.team_customer_access
  for delete to authenticated using (
    private.is_team_admin(private.customer_team(customer_id))
  );

create policy "admins manage invitations" on public.team_invitations
  for all to authenticated
  using (private.is_team_admin(team_id))
  with check (
    private.is_team_admin(team_id)
    and invited_by = (select auth.uid())
  );

-- Direct one-to-one sharing remains available only for Personal customers.
-- Team customer access is controlled by Team administrators above.
drop policy if exists "owner or recipient reads shares" on public.customer_shares;
drop policy if exists "owner creates shares" on public.customer_shares;
drop policy if exists "owner updates shares" on public.customer_shares;
drop policy if exists "owner revokes shares" on public.customer_shares;

create policy "personal owner or recipient reads shares" on public.customer_shares
  for select to authenticated using (
    recipient_user_id = (select auth.uid())
    or (
      private.customer_team(customer_id) is null
      and public.customer_owner(customer_id) = (select auth.uid())
    )
  );
create policy "personal owner creates shares" on public.customer_shares
  for insert to authenticated with check (
    private.customer_team(customer_id) is null
    and public.customer_owner(customer_id) = (select auth.uid())
    and granted_by = (select auth.uid())
    and recipient_user_id <> (select auth.uid())
  );
create policy "personal owner updates shares" on public.customer_shares
  for update to authenticated using (
    private.customer_team(customer_id) is null
    and public.customer_owner(customer_id) = (select auth.uid())
  ) with check (
    private.customer_team(customer_id) is null
    and public.customer_owner(customer_id) = (select auth.uid())
    and granted_by = (select auth.uid())
  );
create policy "personal owner revokes shares" on public.customer_shares
  for delete to authenticated using (
    private.customer_team(customer_id) is null
    and public.customer_owner(customer_id) = (select auth.uid())
  );

revoke all on public.teams, public.team_members, public.team_customer_access, public.team_invitations from anon;
grant select, insert, update, delete on public.teams, public.team_members, public.team_customer_access, public.team_invitations to authenticated;
grant all on public.teams, public.team_members, public.team_customer_access, public.team_invitations to service_role;

comment on column public.customers.team_id is
  'NULL means Personal. A value means the customer belongs to that Team. Existing rows remain Personal.';
comment on table public.team_invitations is
  'Stores only a hash of the email-link or temporary-code token. Acceptance must be handled by a server-side function.';
