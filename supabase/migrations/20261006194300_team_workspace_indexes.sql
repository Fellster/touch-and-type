create index if not exists teams_created_by_idx on public.teams(created_by);
create index if not exists team_customer_access_granted_by_idx on public.team_customer_access(granted_by);
create index if not exists team_invitations_invited_by_idx on public.team_invitations(invited_by);
