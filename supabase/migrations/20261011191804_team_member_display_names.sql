alter table public.team_members add column if not exists display_name text;
alter table public.team_members add constraint team_member_display_name_length check (display_name is null or (length(trim(display_name)) between 1 and 100));
