-- Harden shared-customer media and storage permissions.
-- Edit recipients may change drawing OCR text and delete/add media, but they may not
-- reassign media rows to a different customer/user or rename/move storage objects.

CREATE OR REPLACE FUNCTION public.protect_media_identity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF NEW.customer_id IS DISTINCT FROM OLD.customer_id
     OR NEW.user_id IS DISTINCT FROM OLD.user_id
     OR NEW.storage_path IS DISTINCT FROM OLD.storage_path THEN
    RAISE EXCEPTION 'Media ownership and storage identity cannot be changed';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_photos_identity ON public.photos;
CREATE TRIGGER protect_photos_identity
  BEFORE UPDATE ON public.photos
  FOR EACH ROW EXECUTE FUNCTION public.protect_media_identity();

DROP TRIGGER IF EXISTS protect_drawings_identity ON public.drawings;
CREATE TRIGGER protect_drawings_identity
  BEFORE UPDATE ON public.drawings
  FOR EACH ROW EXECUTE FUNCTION public.protect_media_identity();

-- Photos have no editable metadata in the application. Disallow row updates entirely.
DROP POLICY IF EXISTS "update photos of editable customers" ON public.photos;

-- Drawings only need OCR text updates. The trigger above makes customer_id, user_id,
-- and storage_path immutable even for edit-level recipients.
DROP POLICY IF EXISTS "update drawings of editable customers" ON public.drawings;
CREATE POLICY "update drawing text of editable customers" ON public.drawings
  FOR UPDATE TO authenticated
  USING (public.can_edit_customer(customer_id))
  WITH CHECK (public.can_edit_customer(customer_id));

-- The app uploads and deletes objects, but never renames/moves them. Removing UPDATE
-- closes a path that could otherwise be used to move an object to a different folder.
DROP POLICY IF EXISTS "update customer media" ON storage.objects;
