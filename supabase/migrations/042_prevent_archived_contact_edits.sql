-- Archived contacts can only transition back to active through restore.
CREATE OR REPLACE FUNCTION public.prevent_archived_contact_edit()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF OLD.archived_at IS NOT NULL AND NEW.archived_at IS NOT NULL THEN
    RAISE EXCEPTION 'Archived contacts are read-only' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_archived_contact_edit ON public.contacts;
CREATE TRIGGER prevent_archived_contact_edit
  BEFORE UPDATE ON public.contacts
  FOR EACH ROW EXECUTE FUNCTION public.prevent_archived_contact_edit();
