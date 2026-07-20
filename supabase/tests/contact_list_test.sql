BEGIN;

SELECT plan(16);

SELECT has_function(
  'public', 'list_contacts', ARRAY['text', 'uuid[]', 'text', 'integer'],
  'the contact list RPC exists'
);
SELECT is(
  (SELECT prosecdef FROM pg_proc WHERE oid = 'public.list_contacts(text,uuid[],text,integer)'::regprocedure),
  false,
  'the contact list RPC uses caller RLS'
);
SELECT function_privs_are(
  'public', 'list_contacts', ARRAY['text', 'uuid[]', 'text', 'integer'],
  'authenticated', ARRAY['EXECUTE'],
  'authenticated callers can list contacts'
);
SELECT function_privs_are(
  'public', 'list_contacts', ARRAY['text', 'uuid[]', 'text', 'integer'],
  'public', ARRAY[]::TEXT[],
  'the contact list RPC is not public'
);

INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password)
VALUES
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'list-owner@example.com', ''),
  ('20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'list-outsider@example.com', '');

INSERT INTO contacts (id, user_id, account_id, phone, name, email, created_at)
SELECT
  ('10000000-0000-0000-0000-' || lpad(n::TEXT, 12, '0'))::UUID,
  '10000000-0000-0000-0000-000000000001',
  (SELECT account_id FROM profiles WHERE user_id = '10000000-0000-0000-0000-000000000001'),
  '+1555000' || lpad(n::TEXT, 4, '0'),
  'Contact ' || n,
  'contact' || n || '@example.com',
  '2026-01-01'::TIMESTAMPTZ + n * INTERVAL '1 minute'
FROM generate_series(1, 27) n;

UPDATE contacts SET name = 'Ada Lovelace' WHERE id = '10000000-0000-0000-0000-000000000007';
UPDATE contacts SET phone = '+34911222333' WHERE id = '10000000-0000-0000-0000-000000000008';
UPDATE contacts SET email = 'unique@example.test' WHERE id = '10000000-0000-0000-0000-000000000009';

INSERT INTO contacts (id, user_id, account_id, phone, name, archived_at, created_at)
VALUES
  ('10000000-0000-0000-0000-000000000099', '10000000-0000-0000-0000-000000000001', (SELECT account_id FROM profiles WHERE user_id = '10000000-0000-0000-0000-000000000001'), '+15559999999', 'Archived result', NOW(), '2026-02-01'),
  ('20000000-0000-0000-0000-000000000099', '20000000-0000-0000-0000-000000000001', (SELECT account_id FROM profiles WHERE user_id = '20000000-0000-0000-0000-000000000001'), '+15558888888', 'Outsider secret', NULL, '2026-03-01');

INSERT INTO tags (id, user_id, account_id, name, color)
VALUES
  ('10000000-0000-4000-8000-000000000001', '10000000-0000-0000-0000-000000000001', (SELECT account_id FROM profiles WHERE user_id = '10000000-0000-0000-0000-000000000001'), 'Customers', '#111111'),
  ('10000000-0000-4000-8000-000000000002', '10000000-0000-0000-0000-000000000001', (SELECT account_id FROM profiles WHERE user_id = '10000000-0000-0000-0000-000000000001'), 'Leads', '#222222');

INSERT INTO contact_tags (contact_id, tag_id)
VALUES
  ('10000000-0000-0000-0000-000000000001', '10000000-0000-4000-8000-000000000001'),
  ('10000000-0000-0000-0000-000000000002', '10000000-0000-4000-8000-000000000002'),
  ('10000000-0000-0000-0000-000000000003', '10000000-0000-4000-8000-000000000001'),
  ('10000000-0000-0000-0000-000000000003', '10000000-0000-4000-8000-000000000002');

SELECT set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);
SET LOCAL ROLE authenticated;

SELECT is((SELECT total_count FROM list_contacts()), 27::BIGINT, 'active is the default state');
SELECT is(jsonb_array_length((SELECT items FROM list_contacts())), 25, 'pages contain 25 contacts');
SELECT is((SELECT total_count FROM list_contacts(p_page => 2)), 27::BIGINT, 'later pages preserve the exact total');
SELECT is(jsonb_array_length((SELECT items FROM list_contacts(p_page => 2))), 2, 'the second page contains the remainder');
SELECT is((SELECT total_count FROM list_contacts(p_status => 'archived')), 1::BIGINT, 'archived contacts are listed separately');
SELECT is((SELECT total_count FROM list_contacts(p_search => 'lovelace')), 1::BIGINT, 'search matches names');
SELECT is((SELECT total_count FROM list_contacts(p_search => '911222')), 1::BIGINT, 'search matches phone numbers');
SELECT is((SELECT total_count FROM list_contacts(p_search => 'unique@example.test')), 1::BIGINT, 'search matches emails');
SELECT is(
  (SELECT total_count FROM list_contacts(p_tag_ids => ARRAY[
    '10000000-0000-4000-8000-000000000001'::UUID,
    '10000000-0000-4000-8000-000000000001'::UUID,
    '10000000-0000-4000-8000-000000000002'::UUID
  ])),
  3::BIGINT,
  'repeated tags use deduplicated OR semantics'
);
SELECT is(
  (SELECT items->0->'tags'->0->>'name' FROM list_contacts(
    p_tag_ids => ARRAY['10000000-0000-4000-8000-000000000001'::UUID],
    p_search => 'Contact 3'
  )),
  'Customers',
  'contacts include enriched tags'
);
SELECT is((SELECT total_count FROM list_contacts(p_search => 'Outsider secret')), 0::BIGINT, 'RLS hides another account');
SELECT is(jsonb_array_length((SELECT items FROM list_contacts(p_search => 'missing'))), 0, 'empty pages return an empty item array');

SELECT * FROM finish();

ROLLBACK;
