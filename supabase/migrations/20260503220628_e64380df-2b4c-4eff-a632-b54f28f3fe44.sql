
-- customers table
create table public.customers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  name text not null,
  phone text,
  email text,
  designers text[] not null default '{}',
  shoe_size numeric(3,1),
  width text,
  looking_for text[] not null default '{}',
  typed_notes text,
  custom_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.customers enable row level security;

create policy "owner read customers" on public.customers for select using (auth.uid() = user_id);
create policy "owner insert customers" on public.customers for insert with check (auth.uid() = user_id);
create policy "owner update customers" on public.customers for update using (auth.uid() = user_id);
create policy "owner delete customers" on public.customers for delete using (auth.uid() = user_id);

create index customers_user_id_idx on public.customers(user_id);
create index customers_name_idx on public.customers(name);

-- custom_fields table
create table public.custom_fields (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  key text not null,
  label text not null,
  field_type text not null default 'text', -- text, number, tags, date, boolean
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  unique (user_id, key)
);
alter table public.custom_fields enable row level security;

create policy "owner read fields" on public.custom_fields for select using (auth.uid() = user_id);
create policy "owner insert fields" on public.custom_fields for insert with check (auth.uid() = user_id);
create policy "owner update fields" on public.custom_fields for update using (auth.uid() = user_id);
create policy "owner delete fields" on public.custom_fields for delete using (auth.uid() = user_id);

-- drawings table
create table public.drawings (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  user_id uuid not null,
  storage_path text not null,
  ocr_text text,
  created_at timestamptz not null default now()
);
alter table public.drawings enable row level security;

create policy "owner read drawings" on public.drawings for select using (auth.uid() = user_id);
create policy "owner insert drawings" on public.drawings for insert with check (auth.uid() = user_id);
create policy "owner update drawings" on public.drawings for update using (auth.uid() = user_id);
create policy "owner delete drawings" on public.drawings for delete using (auth.uid() = user_id);

create index drawings_customer_idx on public.drawings(customer_id);

-- photos table
create table public.photos (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  user_id uuid not null,
  storage_path text not null,
  created_at timestamptz not null default now()
);
alter table public.photos enable row level security;

create policy "owner read photos" on public.photos for select using (auth.uid() = user_id);
create policy "owner insert photos" on public.photos for insert with check (auth.uid() = user_id);
create policy "owner update photos" on public.photos for update using (auth.uid() = user_id);
create policy "owner delete photos" on public.photos for delete using (auth.uid() = user_id);

create index photos_customer_idx on public.photos(customer_id);

-- updated_at trigger
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

create trigger customers_updated_at before update on public.customers
for each row execute function public.set_updated_at();

-- storage buckets
insert into storage.buckets (id, name, public) values ('drawings', 'drawings', false)
on conflict (id) do nothing;
insert into storage.buckets (id, name, public) values ('photos', 'photos', false)
on conflict (id) do nothing;

-- storage policies: users only access their own folder (path starts with their uid)
create policy "owner read drawings storage" on storage.objects for select
  using (bucket_id = 'drawings' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "owner insert drawings storage" on storage.objects for insert
  with check (bucket_id = 'drawings' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "owner delete drawings storage" on storage.objects for delete
  using (bucket_id = 'drawings' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "owner read photos storage" on storage.objects for select
  using (bucket_id = 'photos' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "owner insert photos storage" on storage.objects for insert
  with check (bucket_id = 'photos' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "owner delete photos storage" on storage.objects for delete
  using (bucket_id = 'photos' and auth.uid()::text = (storage.foldername(name))[1]);
