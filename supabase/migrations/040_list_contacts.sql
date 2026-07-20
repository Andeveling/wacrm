CREATE OR REPLACE FUNCTION public.list_contacts(
  p_search TEXT DEFAULT NULL,
  p_tag_ids UUID[] DEFAULT ARRAY[]::UUID[],
  p_status TEXT DEFAULT 'active',
  p_page INT DEFAULT 1
)
RETURNS TABLE (items JSONB, total_count BIGINT)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH matched AS MATERIALIZED (
    SELECT c.*
    FROM contacts c
    WHERE (
        (p_status = 'archived' AND c.archived_at IS NOT NULL)
        OR (p_status = 'active' AND c.archived_at IS NULL)
      )
      AND (
        p_search IS NULL
        OR c.name ILIKE '%' || p_search || '%'
        OR c.phone ILIKE '%' || p_search || '%'
        OR c.email ILIKE '%' || p_search || '%'
      )
      AND (
        cardinality(COALESCE(p_tag_ids, ARRAY[]::UUID[])) = 0
        OR EXISTS (
          SELECT 1
          FROM contact_tags ct
          WHERE ct.contact_id = c.id
            AND ct.tag_id = ANY(p_tag_ids)
        )
      )
  ),
  page AS (
    SELECT c.*
    FROM matched c
    ORDER BY c.created_at DESC, c.id
    LIMIT 25 OFFSET (GREATEST(p_page, 1)::BIGINT - 1) * 25
  ),
  enriched AS (
    SELECT
      to_jsonb(c) || jsonb_build_object(
        'tags', COALESCE((
          SELECT jsonb_agg(to_jsonb(t) ORDER BY t.name, t.id)
          FROM contact_tags ct
          JOIN tags t ON t.id = ct.tag_id
          WHERE ct.contact_id = c.id
        ), '[]'::JSONB)
      ) AS item,
      c.created_at,
      c.id
    FROM page c
  )
  SELECT
    COALESCE(jsonb_agg(item ORDER BY created_at DESC, id), '[]'::JSONB),
    (SELECT count(*) FROM matched)
  FROM enriched;
$$;

GRANT SELECT ON contacts, contact_tags, tags TO authenticated;
ALTER FUNCTION public.list_contacts(TEXT, UUID[], TEXT, INT) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.list_contacts(TEXT, UUID[], TEXT, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_contacts(TEXT, UUID[], TEXT, INT) TO authenticated;
