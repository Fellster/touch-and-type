create or replace function public.customer_owner(_customer_id uuid)
returns uuid language sql stable security definer set search_path = '' as $$
 select c.user_id from public.customers c
 where c.id = _customer_id and public.can_view_customer(c.id)
$$;

create or replace function public.accept_team_invitation(_actor uuid, _hash text, _use_token boolean)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare invitation public.team_invitations%rowtype; actor_email text;
begin
 select email into actor_email from auth.users where id = _actor;
 if actor_email is null then raise exception 'Unauthorized' using errcode='28000'; end if;
 select * into invitation from public.team_invitations
 where case when _use_token then token_hash = _hash else code_hash = _hash end
 for update;
 if not found or invitation.revoked_at is not null or invitation.accepted_at is not null
    or invitation.expires_at <= clock_timestamp() then
   raise exception 'This invitation is invalid or has expired.' using errcode='P0002';
 end if;
 if lower(actor_email) <> lower(invitation.email) then
   raise exception 'Sign in with the email address that received this invitation.' using errcode='42501';
 end if;
 insert into public.team_members(team_id,user_id,role)
 values(invitation.team_id,_actor,invitation.role)
 on conflict(team_id,user_id) do nothing;
 update public.team_invitations set accepted_at=clock_timestamp() where id=invitation.id;
 return invitation.team_id;
end $$;
revoke all on function public.accept_team_invitation(uuid,text,boolean) from public,anon,authenticated;
grant execute on function public.accept_team_invitation(uuid,text,boolean) to service_role;
