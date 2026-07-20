DROP POLICY IF EXISTS contacts_delete ON public.contacts;

-- The public-API overload must require its account argument. A default value
-- makes PostgreSQL unable to choose it or the dashboard's one-argument RPC.
DROP FUNCTION public.archive_contact(UUID, UUID);
CREATE FUNCTION public.archive_contact(
  p_contact_id UUID,
  p_account_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_account_id UUID;
  v_role account_role_enum;
BEGIN
  IF auth.role() = 'service_role' AND p_account_id IS NOT NULL THEN
    v_account_id := p_account_id;
  ELSIF auth.uid() IS NOT NULL THEN
    SELECT account_id, account_role INTO v_account_id, v_role
    FROM profiles WHERE user_id = auth.uid();
    IF v_account_id IS NULL OR v_role NOT IN ('owner', 'admin', 'agent') THEN
      RAISE EXCEPTION 'This action requires the agent role or higher' USING ERRCODE = '42501';
    END IF;
  ELSE
    RAISE EXCEPTION 'Unauthorized' USING ERRCODE = '42501';
  END IF;

  PERFORM 1 FROM contacts
  WHERE id = p_contact_id AND account_id = v_account_id AND archived_at IS NULL
  FOR UPDATE;
  IF NOT FOUND THEN
    IF EXISTS (SELECT 1 FROM contacts WHERE id = p_contact_id AND account_id = v_account_id) THEN RETURN; END IF;
    RAISE EXCEPTION 'Contact not found' USING ERRCODE = '42501';
  END IF;

  UPDATE contacts SET archived_at = NOW() WHERE id = p_contact_id AND account_id = v_account_id;
  UPDATE broadcast_recipients br SET status = 'cancelled', cancelled_at = NOW(), cancellation_reason = 'contact_archived'
  FROM broadcasts b WHERE br.broadcast_id = b.id AND br.contact_id = p_contact_id AND b.account_id = v_account_id AND br.status = 'pending';
  UPDATE automation_pending_executions SET status = 'cancelled', cancelled_at = NOW(), cancellation_reason = 'contact_archived'
  WHERE contact_id = p_contact_id AND account_id = v_account_id AND status = 'pending';
  UPDATE flow_runs SET status = 'cancelled', ended_at = NOW(), end_reason = 'contact_archived'
  WHERE contact_id = p_contact_id AND account_id = v_account_id AND status = 'active';
END;
$$;

DROP FUNCTION public.restore_contact(UUID, UUID);
CREATE FUNCTION public.restore_contact(
  p_contact_id UUID,
  p_account_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_account_id UUID;
  v_role account_role_enum;
BEGIN
  IF auth.role() = 'service_role' AND p_account_id IS NOT NULL THEN
    v_account_id := p_account_id;
  ELSIF auth.uid() IS NOT NULL THEN
    SELECT account_id, account_role INTO v_account_id, v_role
    FROM profiles WHERE user_id = auth.uid();
    IF v_account_id IS NULL OR v_role NOT IN ('owner', 'admin', 'agent') THEN
      RAISE EXCEPTION 'This action requires the agent role or higher' USING ERRCODE = '42501';
    END IF;
  ELSE
    RAISE EXCEPTION 'Unauthorized' USING ERRCODE = '42501';
  END IF;

  PERFORM 1 FROM contacts WHERE id = p_contact_id AND account_id = v_account_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Contact not found' USING ERRCODE = '42501'; END IF;
  UPDATE contacts SET archived_at = NULL
  WHERE id = p_contact_id AND account_id = v_account_id AND archived_at IS NOT NULL;
END;
$$;

ALTER FUNCTION public.archive_contact(UUID, UUID) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.archive_contact(UUID, UUID) FROM PUBLIC, authenticated, anon;
GRANT EXECUTE ON FUNCTION public.archive_contact(UUID, UUID) TO service_role;
ALTER FUNCTION public.restore_contact(UUID, UUID) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.restore_contact(UUID, UUID) FROM PUBLIC, authenticated, anon;
GRANT EXECUTE ON FUNCTION public.restore_contact(UUID, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.archive_contact(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.filter_contacts_by_tags(
  p_tag_ids UUID[],
  p_search TEXT DEFAULT NULL,
  p_limit INT DEFAULT 25,
  p_offset INT DEFAULT 0,
  p_status TEXT DEFAULT 'active'
)
RETURNS TABLE (contact contacts, total_count BIGINT)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH matched AS (
    SELECT DISTINCT c.id, c.created_at
    FROM contacts c
    JOIN contact_tags ct ON ct.contact_id = c.id
    WHERE ct.tag_id = ANY(p_tag_ids)
      AND ((p_status = 'archived' AND c.archived_at IS NOT NULL) OR (p_status = 'active' AND c.archived_at IS NULL))
      AND (p_search IS NULL OR c.name ILIKE '%' || p_search || '%' OR c.phone ILIKE '%' || p_search || '%' OR c.email ILIKE '%' || p_search || '%')
  ), page AS (
    SELECT id, count(*) OVER() AS total_count
    FROM matched
    ORDER BY created_at DESC, id
    LIMIT p_limit OFFSET p_offset
  )
  SELECT c, page.total_count
  FROM page JOIN contacts c ON c.id = page.id
  ORDER BY c.created_at DESC, c.id;
$$;

REVOKE ALL ON FUNCTION public.filter_contacts_by_tags(UUID[], TEXT, INT, INT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.filter_contacts_by_tags(UUID[], TEXT, INT, INT, TEXT) TO authenticated;
