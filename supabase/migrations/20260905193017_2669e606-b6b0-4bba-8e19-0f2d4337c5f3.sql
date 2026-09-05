-- 1. Helper: customer owner lookup (security definer to avoid recursive RLS)
CREATE OR REPLACE FUNCTION public.customer_owner(_customer_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT user_id FROM public.customers WHERE id = _customer_id
$$;

-- 2. customer_shares table
CREATE TABLE public.customer_shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  recipient_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  permission text NOT NULL DEFAULT 'view' CHECK (permission IN ('view','edit')),
  granted_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (customer_id, recipient_user_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_shares TO authenticated;
GRANT ALL ON public.customer_shares TO service_role;
ALTER TABLE public.customer_shares ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner or recipient reads shares" ON public.customer_shares
  FOR SELECT TO authenticated
  USING (public.customer_owner(customer_id) = auth.uid() OR recipient_user_id = auth.uid());
CREATE POLICY "owner creates shares" ON public.customer_shares
  FOR INSERT TO authenticated
  WITH CHECK (public.customer_owner(customer_id) = auth.uid() AND granted_by = auth.uid() AND recipient_user_id <> auth.uid());
CREATE POLICY "owner updates shares" ON public.customer_shares
  FOR UPDATE TO authenticated
  USING (public.customer_owner(customer_id) = auth.uid())
  WITH CHECK (public.customer_owner(customer_id) = auth.uid());
CREATE POLICY "owner revokes shares" ON public.customer_shares
  FOR DELETE TO authenticated
  USING (public.customer_owner(customer_id) = auth.uid());

CREATE INDEX customer_shares_recipient_idx ON public.customer_shares(recipient_user_id);
CREATE INDEX customer_shares_customer_idx ON public.customer_shares(customer_id);
CREATE TRIGGER customer_shares_updated_at BEFORE UPDATE ON public.customer_shares
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 3. Access helpers
CREATE OR REPLACE FUNCTION public.can_view_customer(_customer_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.customers c WHERE c.id = _customer_id AND c.user_id = auth.uid())
      OR EXISTS (SELECT 1 FROM public.customer_shares s WHERE s.customer_id = _customer_id AND s.recipient_user_id = auth.uid())
$$;

CREATE OR REPLACE FUNCTION public.can_edit_customer(_customer_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.customers c WHERE c.id = _customer_id AND c.user_id = auth.uid())
      OR EXISTS (SELECT 1 FROM public.customer_shares s WHERE s.customer_id = _customer_id AND s.recipient_user_id = auth.uid() AND s.permission = 'edit')
$$;

GRANT EXECUTE ON FUNCTION public.can_view_customer(uuid), public.can_edit_customer(uuid), public.customer_owner(uuid) TO authenticated, service_role;

-- 4. Foreign keys to accounts
ALTER TABLE public.customers ADD CONSTRAINT customers_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.photos ADD CONSTRAINT photos_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.drawings ADD CONSTRAINT drawings_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.custom_fields ADD CONSTRAINT custom_fields_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- 5. customers policies
DROP POLICY IF EXISTS "owner read customers" ON public.customers;
DROP POLICY IF EXISTS "owner insert customers" ON public.customers;
DROP POLICY IF EXISTS "owner update customers" ON public.customers;
DROP POLICY IF EXISTS "owner delete customers" ON public.customers;

CREATE POLICY "view own or shared customers" ON public.customers
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.can_view_customer(id));
CREATE POLICY "insert own customers" ON public.customers
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "edit own or edit-shared customers" ON public.customers
  FOR UPDATE TO authenticated USING (public.can_edit_customer(id)) WITH CHECK (public.can_edit_customer(id) AND user_id = public.customer_owner(id));
CREATE POLICY "owner deletes customers" ON public.customers
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- 6. photos policies
DROP POLICY IF EXISTS "owner read photos" ON public.photos;
DROP POLICY IF EXISTS "owner insert photos" ON public.photos;
DROP POLICY IF EXISTS "owner update photos" ON public.photos;
DROP POLICY IF EXISTS "owner delete photos" ON public.photos;

CREATE POLICY "view photos of visible customers" ON public.photos
  FOR SELECT TO authenticated USING (public.can_view_customer(customer_id));
CREATE POLICY "add photos to editable customers" ON public.photos
  FOR INSERT TO authenticated WITH CHECK (public.can_edit_customer(customer_id) AND user_id = auth.uid());
CREATE POLICY "update photos of editable customers" ON public.photos
  FOR UPDATE TO authenticated USING (public.can_edit_customer(customer_id)) WITH CHECK (public.can_edit_customer(customer_id));
CREATE POLICY "delete photos of editable customers" ON public.photos
  FOR DELETE TO authenticated USING (public.can_edit_customer(customer_id));

-- 7. drawings policies
DROP POLICY IF EXISTS "owner read drawings" ON public.drawings;
DROP POLICY IF EXISTS "owner insert drawings" ON public.drawings;
DROP POLICY IF EXISTS "owner update drawings" ON public.drawings;
DROP POLICY IF EXISTS "owner delete drawings" ON public.drawings;

CREATE POLICY "view drawings of visible customers" ON public.drawings
  FOR SELECT TO authenticated USING (public.can_view_customer(customer_id));
CREATE POLICY "add drawings to editable customers" ON public.drawings
  FOR INSERT TO authenticated WITH CHECK (public.can_edit_customer(customer_id) AND user_id = auth.uid());
CREATE POLICY "update drawings of editable customers" ON public.drawings
  FOR UPDATE TO authenticated USING (public.can_edit_customer(customer_id)) WITH CHECK (public.can_edit_customer(customer_id));
CREATE POLICY "delete drawings of editable customers" ON public.drawings
  FOR DELETE TO authenticated USING (public.can_edit_customer(customer_id));

-- 8. custom_fields + todos: keep private, tighten to authenticated
DROP POLICY IF EXISTS "owner read fields" ON public.custom_fields;
DROP POLICY IF EXISTS "owner insert fields" ON public.custom_fields;
DROP POLICY IF EXISTS "owner update fields" ON public.custom_fields;
DROP POLICY IF EXISTS "owner delete fields" ON public.custom_fields;
CREATE POLICY "owner manages fields" ON public.custom_fields
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users manage their own todos" ON public.todos;
CREATE POLICY "owner manages todos" ON public.todos
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- 9. Grants: signed-out role gets nothing
REVOKE ALL ON public.customers, public.photos, public.drawings, public.custom_fields, public.todos, public.customer_shares FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customers, public.photos, public.drawings, public.custom_fields, public.todos TO authenticated;
GRANT ALL ON public.customers, public.photos, public.drawings, public.custom_fields, public.todos TO service_role;

-- 10. Storage policies follow customer sharing (path = <owner>/<customer_id>/<file>)
DROP POLICY IF EXISTS "owner read drawings storage" ON storage.objects;
DROP POLICY IF EXISTS "owner insert drawings storage" ON storage.objects;
DROP POLICY IF EXISTS "owner delete drawings storage" ON storage.objects;
DROP POLICY IF EXISTS "owner read photos storage" ON storage.objects;
DROP POLICY IF EXISTS "owner insert photos storage" ON storage.objects;
DROP POLICY IF EXISTS "owner delete photos storage" ON storage.objects;
DROP POLICY IF EXISTS "Owners can update own drawings objects" ON storage.objects;
DROP POLICY IF EXISTS "Owners can update own photos objects" ON storage.objects;

CREATE POLICY "read customer media" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id IN ('photos','drawings') AND public.can_view_customer(NULLIF((storage.foldername(name))[2], '')::uuid));
CREATE POLICY "write customer media" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id IN ('photos','drawings') AND auth.uid()::text = (storage.foldername(name))[1]
              AND public.can_edit_customer(NULLIF((storage.foldername(name))[2], '')::uuid));
CREATE POLICY "update customer media" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id IN ('photos','drawings') AND public.can_edit_customer(NULLIF((storage.foldername(name))[2], '')::uuid))
  WITH CHECK (bucket_id IN ('photos','drawings') AND public.can_edit_customer(NULLIF((storage.foldername(name))[2], '')::uuid));
CREATE POLICY "delete customer media" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id IN ('photos','drawings') AND public.can_edit_customer(NULLIF((storage.foldername(name))[2], '')::uuid));