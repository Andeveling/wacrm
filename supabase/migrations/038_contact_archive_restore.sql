-- Transactional contact lifecycle operations. They are intentionally not wired
-- to an API route or UI until every contact consumer handles archived rows.

CREATE OR REPLACE FUNCTION public.archive_contact(p_contact_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_account_id UUID;
  v_role account_role_enum;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Unauthorized' USING ERRCODE = '42501';
  END IF;

  SELECT account_id, account_role
  INTO v_account_id, v_role
  FROM profiles
  WHERE user_id = auth.uid();

  IF v_account_id IS NULL OR v_role NOT IN ('owner', 'admin', 'agent') THEN
    RAISE EXCEPTION 'This action requires the agent role or higher'
      USING ERRCODE = '42501';
  END IF;

  -- The row lock makes the archive timestamp and all cancellations one unit.
  PERFORM 1
  FROM contacts
  WHERE id = p_contact_id
    AND account_id = v_account_id
    AND archived_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    IF EXISTS (
      SELECT 1 FROM contacts WHERE id = p_contact_id AND account_id = v_account_id
    ) THEN
      RETURN;
    END IF;
    RAISE EXCEPTION 'Contact not found' USING ERRCODE = '42501';
  END IF;

  UPDATE contacts
  SET archived_at = NOW()
  WHERE id = p_contact_id
    AND account_id = v_account_id;

  UPDATE broadcast_recipients br
  SET status = 'cancelled',
      cancelled_at = NOW(),
      cancellation_reason = 'contact_archived'
  FROM broadcasts b
  WHERE br.broadcast_id = b.id
    AND br.contact_id = p_contact_id
    AND b.account_id = v_account_id
    AND br.status = 'pending';

  UPDATE automation_pending_executions
  SET status = 'cancelled',
      cancelled_at = NOW(),
      cancellation_reason = 'contact_archived'
  WHERE contact_id = p_contact_id
    AND account_id = v_account_id
    AND status = 'pending';

  UPDATE flow_runs
  SET status = 'cancelled',
      ended_at = NOW(),
      end_reason = 'contact_archived'
  WHERE contact_id = p_contact_id
    AND account_id = v_account_id
    AND status = 'active';
END;
$$;

CREATE OR REPLACE FUNCTION public.restore_contact(p_contact_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_account_id UUID;
  v_role account_role_enum;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Unauthorized' USING ERRCODE = '42501';
  END IF;

  SELECT account_id, account_role
  INTO v_account_id, v_role
  FROM profiles
  WHERE user_id = auth.uid();

  IF v_account_id IS NULL OR v_role NOT IN ('owner', 'admin', 'agent') THEN
    RAISE EXCEPTION 'This action requires the agent role or higher'
      USING ERRCODE = '42501';
  END IF;

  PERFORM 1
  FROM contacts
  WHERE id = p_contact_id
    AND account_id = v_account_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Contact not found' USING ERRCODE = '42501';
  END IF;

  UPDATE contacts
  SET archived_at = NULL
  WHERE id = p_contact_id
    AND account_id = v_account_id
    AND archived_at IS NOT NULL;
END;
$$;

ALTER FUNCTION public.archive_contact(UUID) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.archive_contact(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.archive_contact(UUID) FROM authenticated, anon, service_role;

ALTER FUNCTION public.restore_contact(UUID) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.restore_contact(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.restore_contact(UUID) FROM authenticated, anon, service_role;
