-- Requires two existing Auth users; all fixtures roll back.
begin;
do $test$
declare owner_id uuid; member_id uuid; target_email text; t uuid:=gen_random_uuid(); c uuid:=gen_random_uuid(); i uuid; result uuid; h text;
begin
 select id into owner_id from auth.users order by id limit 1;
 select id,email into member_id,target_email from auth.users where id<>owner_id order by id limit 1;
 if member_id is null then raise exception 'Two Auth users required'; end if;
 insert into public.teams(id,name,created_by) values(t,'Rollback invitation security test',owner_id);
 insert into public.customers(id,user_id,name) values(c,owner_id,'Rollback privacy test');
 perform set_config('request.jwt.claims',json_build_object('sub',member_id,'role','authenticated')::text,true);
 if public.customer_owner(c) is not null then raise exception 'Owner privacy failed'; end if;
 perform set_config('request.jwt.claims',json_build_object('sub',owner_id,'role','authenticated')::text,true);
 if public.customer_owner(c) is distinct from owner_id then raise exception 'Owner lookup broken'; end if;
 for n in 1..5 loop
   i:=gen_random_uuid(); h:=i::text;
   insert into public.team_invitations(id,team_id,email,role,token_hash,code_hash,invited_by,created_at,expires_at,revoked_at)
   values(i,t,target_email,'member',h,h,owner_id,clock_timestamp()-interval '2 days',
     case when n=2 then clock_timestamp()-interval '1 minute' else clock_timestamp()+interval '1 day' end,
     case when n=3 then clock_timestamp() else null end);
   if n=1 then
     begin perform public.accept_team_invitation(owner_id,h,true); raise exception 'Wrong account allowed'; exception when insufficient_privilege then null; end;
   elsif n in (2,3) then
     begin perform public.accept_team_invitation(member_id,h,true); raise exception 'Invalid invitation allowed'; exception when no_data_found then null; end;
   else
     result:=public.accept_team_invitation(member_id,h,n=4);
     if result<>t then raise exception 'Incorrect team'; end if;
     begin perform public.accept_team_invitation(member_id,h,true); raise exception 'Reuse allowed'; exception when no_data_found then null; end;
   end if;
 end loop;
 if (select count(*) from public.team_members where team_id=t and user_id=member_id)<>1 then raise exception 'Duplicate membership'; end if;
 if has_function_privilege('authenticated','public.accept_team_invitation(uuid,text,boolean)','EXECUTE') then raise exception 'Public acceptance RPC'; end if;
end $test$;
rollback;
