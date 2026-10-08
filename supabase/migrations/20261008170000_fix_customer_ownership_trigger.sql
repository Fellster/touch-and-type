-- The ownership trigger is shared by teams and customers.
-- Branch before referencing table-specific NEW/OLD fields so a customer update
-- never attempts to read the teams-only created_by column.

create or replace function private.protect_team_and_customer_ownership()
returns trigger
language plpgsql security invoker
set search_path = ''
as $body$
begin
  if tg_table_name = 'teams' then
    if new.created_by is distinct from old.created_by then
      raise exception 'Team ownership cannot be changed directly';
    end if;
  elsif tg_table_name = 'customers' then
    if new.user_id is distinct from old.user_id
       or new.team_id is distinct from old.team_id then
      raise exception 'Customer workspace ownership cannot be changed directly';
    end if;
  end if;
  return new;
end
$body$;
