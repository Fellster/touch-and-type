REVOKE EXECUTE ON FUNCTION public.can_view_customer(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.can_edit_customer(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.customer_owner(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_view_customer(uuid), public.can_edit_customer(uuid), public.customer_owner(uuid) TO authenticated, service_role;