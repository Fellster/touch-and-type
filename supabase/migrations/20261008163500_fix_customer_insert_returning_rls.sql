-- Allow INSERT ... RETURNING to evaluate the new customer row directly.
-- Access remains limited to personal owners, Team administrators, the customer
-- creator, explicitly granted Team members, and Personal share recipients.

alter policy "view accessible customers" on public.customers
using (
  (team_id is null and user_id = (select auth.uid()))
  or (
    team_id is not null
    and (
      private.is_team_admin(team_id)
      or user_id = (select auth.uid())
      or exists (
        select 1
        from public.team_customer_access a
        where a.customer_id = customers.id
          and a.user_id = (select auth.uid())
      )
    )
  )
  or exists (
    select 1
    from public.customer_shares s
    where s.customer_id = customers.id
      and s.recipient_user_id = (select auth.uid())
  )
);
