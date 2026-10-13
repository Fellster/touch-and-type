alter function public.accept_team_invitation(uuid,text,boolean) security definer;
revoke all on function public.accept_team_invitation(uuid,text,boolean) from public,anon,authenticated;
grant execute on function public.accept_team_invitation(uuid,text,boolean) to service_role;
