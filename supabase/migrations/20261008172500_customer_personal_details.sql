-- Per-user customer additions.
-- Creators manage their own Notes, Wants, Drawings, and Photos.
-- Team administrators can view every member's additions but cannot change them.

create table if not exists public.customer_personal_details (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  notes text not null default '',
  wants text[] not null default '{}'::text[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (customer_id, user_id)
);

alter table public.customer_personal_details enable row level security;
revoke all on public.customer_personal_details from anon;
grant select, insert, update, delete on public.customer_personal_details to authenticated;
grant all on public.customer_personal_details to service_role;

create trigger customer_personal_details_updated_at
before update on public.customer_personal_details
for each row execute function public.set_updated_at();

create index customer_personal_details_user_id_idx
  on public.customer_personal_details(user_id);

create policy "creator or team admin views personal details"
on public.customer_personal_details for select to authenticated
using (
  public.can_view_customer(customer_id)
  and (
    user_id = (select auth.uid())
    or (
      private.customer_team(customer_id) is not null
      and private.is_team_admin(private.customer_team(customer_id))
    )
  )
);

create policy "users add their personal details"
on public.customer_personal_details for insert to authenticated
with check (user_id = (select auth.uid()) and public.can_view_customer(customer_id));

create policy "users update their personal details"
on public.customer_personal_details for update to authenticated
using (user_id = (select auth.uid()) and public.can_view_customer(customer_id))
with check (user_id = (select auth.uid()) and public.can_view_customer(customer_id));

create policy "users delete their personal details"
on public.customer_personal_details for delete to authenticated
using (user_id = (select auth.uid()) and public.can_view_customer(customer_id));

drop policy if exists "view drawings of visible customers" on public.drawings;
drop policy if exists "add drawings to editable customers" on public.drawings;
drop policy if exists "update drawing text of editable customers" on public.drawings;
drop policy if exists "delete drawings of editable customers" on public.drawings;

create policy "creator or team admin views drawings"
on public.drawings for select to authenticated
using (
  public.can_view_customer(customer_id)
  and (
    user_id = (select auth.uid())
    or (
      private.customer_team(customer_id) is not null
      and private.is_team_admin(private.customer_team(customer_id))
    )
  )
);
create policy "visible users add their own drawings"
on public.drawings for insert to authenticated
with check (user_id = (select auth.uid()) and public.can_view_customer(customer_id));
create policy "creators update their own drawings"
on public.drawings for update to authenticated
using (user_id = (select auth.uid()) and public.can_view_customer(customer_id))
with check (user_id = (select auth.uid()) and public.can_view_customer(customer_id));
create policy "creators delete their own drawings"
on public.drawings for delete to authenticated
using (user_id = (select auth.uid()) and public.can_view_customer(customer_id));

drop policy if exists "view photos of visible customers" on public.photos;
drop policy if exists "add photos to editable customers" on public.photos;
drop policy if exists "delete photos of editable customers" on public.photos;

create policy "creator or team admin views photos"
on public.photos for select to authenticated
using (
  public.can_view_customer(customer_id)
  and (
    user_id = (select auth.uid())
    or (
      private.customer_team(customer_id) is not null
      and private.is_team_admin(private.customer_team(customer_id))
    )
  )
);
create policy "visible users add their own photos"
on public.photos for insert to authenticated
with check (user_id = (select auth.uid()) and public.can_view_customer(customer_id));
create policy "creators delete their own photos"
on public.photos for delete to authenticated
using (user_id = (select auth.uid()) and public.can_view_customer(customer_id));

drop policy if exists "read customer media" on storage.objects;
drop policy if exists "write customer media" on storage.objects;
drop policy if exists "delete customer media" on storage.objects;

create policy "read customer media"
on storage.objects for select to authenticated
using (
  bucket_id = any (array['photos'::text, 'drawings'::text])
  and public.can_view_customer(nullif((storage.foldername(name))[2], '')::uuid)
  and (
    (select auth.uid())::text = (storage.foldername(name))[1]
    or (
      private.customer_team(nullif((storage.foldername(name))[2], '')::uuid) is not null
      and private.is_team_admin(private.customer_team(nullif((storage.foldername(name))[2], '')::uuid))
    )
  )
);
create policy "write customer media"
on storage.objects for insert to authenticated
with check (
  bucket_id = any (array['photos'::text, 'drawings'::text])
  and (select auth.uid())::text = (storage.foldername(name))[1]
  and public.can_view_customer(nullif((storage.foldername(name))[2], '')::uuid)
);
create policy "delete customer media"
on storage.objects for delete to authenticated
using (
  bucket_id = any (array['photos'::text, 'drawings'::text])
  and (select auth.uid())::text = (storage.foldername(name))[1]
  and public.can_view_customer(nullif((storage.foldername(name))[2], '')::uuid)
);
