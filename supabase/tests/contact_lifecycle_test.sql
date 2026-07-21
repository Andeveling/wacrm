BEGIN;

SELECT plan(66);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'contacts'
      AND column_name = 'archived_at'
      AND is_nullable = 'YES'
      AND column_default IS NULL
  ),
  'contacts default to active through a nullable archived_at'
);

SELECT ok(
  EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'idx_contacts_account_active'
      AND indexdef LIKE '%WHERE (archived_at IS NULL)%'
  ),
  'active contacts have a partial account index'
);

SELECT ok(
  EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'idx_contacts_account_archived'
      AND indexdef LIKE '%WHERE (archived_at IS NOT NULL)%'
  ),
  'archived contacts have a partial account index'
);

SELECT has_column(
  'public', 'broadcast_recipients', 'cancelled_at',
  'broadcast recipients record when cancellation occurred'
);
SELECT has_column(
  'public', 'broadcast_recipients', 'cancellation_reason',
  'broadcast recipients record why cancellation occurred'
);
SELECT has_column(
  'public', 'broadcast_recipients', 'recipient_phone',
  'broadcast recipients preserve their materialized phone'
);

SELECT ok(
  EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.broadcast_recipients'::regclass
      AND conname = 'broadcast_recipients_status_check'
      AND pg_get_constraintdef(oid) LIKE '%cancelled%'
  ),
  'broadcast recipients accept cancelled as a terminal status'
);

SELECT ok(
  EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.broadcast_recipients'::regclass
      AND conname = 'broadcast_recipients_cancellation_audit_check'
      AND pg_get_constraintdef(oid) LIKE '%contact_archived%'
      AND pg_get_constraintdef(oid) LIKE '%cancellation_reason IS NOT NULL%'
  ),
  'cancelled broadcast recipients require audit fields'
);

SELECT has_column(
  'public', 'automation_pending_executions', 'cancelled_at',
  'pending automation executions record when cancellation occurred'
);
SELECT has_column(
  'public', 'automation_pending_executions', 'cancellation_reason',
  'pending automation executions record why cancellation occurred'
);

SELECT ok(
  EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.automation_pending_executions'::regclass
      AND conname = 'automation_pending_executions_status_check'
      AND pg_get_constraintdef(oid) LIKE '%cancelled%'
  ),
  'pending automation executions accept cancelled as a terminal status'
);

SELECT ok(
  EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.automation_pending_executions'::regclass
      AND conname = 'automation_pending_executions_cancellation_audit_check'
      AND pg_get_constraintdef(oid) LIKE '%contact_archived%'
      AND pg_get_constraintdef(oid) LIKE '%cancellation_reason IS NOT NULL%'
  ),
  'cancelled automation executions require audit fields'
);

SELECT ok(
  EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.flow_runs'::regclass
      AND conname = 'flow_runs_status_check'
      AND pg_get_constraintdef(oid) LIKE '%cancelled%'
  ),
  'flow runs accept cancelled as a terminal status'
);

SELECT ok(
  EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.flow_runs'::regclass
      AND conname = 'flow_runs_cancellation_audit_check'
      AND pg_get_constraintdef(oid) LIKE '%contact_archived%'
      AND pg_get_constraintdef(oid) LIKE '%end_reason IS NOT NULL%'
  ),
  'cancelled flow runs require end audit fields'
);

SELECT is(
  public._bcast_cols_for_status('cancelled'),
  ARRAY[]::TEXT[],
  'cancelled recipients do not alter delivery aggregates'
);

SELECT has_trigger(
  'public', 'broadcast_recipients', 'prevent_cancelled_reactivation',
  'cancelled broadcast recipients cannot be reactivated'
);

SELECT has_trigger(
  'public', 'automation_pending_executions', 'prevent_cancelled_reactivation',
  'cancelled automation executions cannot be reactivated'
);

SELECT has_trigger(
  'public', 'flow_runs', 'prevent_cancelled_reactivation',
  'cancelled flow runs cannot be reactivated'
);

SELECT has_function('public', 'archive_contact', ARRAY['uuid'],
  'archive operation is available as a database RPC');
SELECT has_function('public', 'restore_contact', ARRAY['uuid'],
  'restore operation is available as a database RPC');
SELECT function_privs_are(
  'public', 'archive_contact', ARRAY['uuid'], 'authenticated', ARRAY['EXECUTE'],
  'authenticated users can call the role-protected archive operation');
SELECT function_privs_are(
  'public', 'restore_contact', ARRAY['uuid'], 'authenticated', ARRAY['EXECUTE'],
  'authenticated users can call the role-protected restore operation');
SELECT function_privs_are(
  'public', 'archive_contact', ARRAY['uuid'], 'public', ARRAY[]::TEXT[],
  'archive is not publicly executable');
SELECT function_privs_are(
  'public', 'restore_contact', ARRAY['uuid'], 'public', ARRAY[]::TEXT[],
  'restore is not publicly executable');
SELECT function_privs_are(
  'public', 'archive_contact', ARRAY['uuid'], 'anon', ARRAY[]::TEXT[],
  'archive is not executable by anonymous users');
SELECT function_privs_are(
  'public', 'restore_contact', ARRAY['uuid'], 'anon', ARRAY[]::TEXT[],
  'restore is not executable by anonymous users');
SELECT function_privs_are(
  'public', 'archive_contact', ARRAY['uuid'], 'service_role', ARRAY[]::TEXT[],
  'archive is not executable by service role');
SELECT function_privs_are(
  'public', 'restore_contact', ARRAY['uuid'], 'service_role', ARRAY[]::TEXT[],
  'restore is not executable by service role');
SELECT is(
  (SELECT proconfig @> ARRAY['search_path=public']
   FROM pg_proc WHERE oid = 'public.archive_contact(uuid)'::regprocedure),
  true,
  'archive has a safe search path'
);
SELECT is(
  (SELECT proconfig @> ARRAY['search_path=public']
   FROM pg_proc WHERE oid = 'public.restore_contact(uuid)'::regprocedure),
  true,
  'restore has a safe search path'
);
SELECT is(
  (SELECT prosecdef FROM pg_proc WHERE oid = 'public.archive_contact(uuid)'::regprocedure),
  true,
  'archive is security definer'
);
SELECT is(
  (SELECT prosecdef FROM pg_proc WHERE oid = 'public.restore_contact(uuid)'::regprocedure),
  true,
  'restore is security definer'
);
SELECT ok(
  pg_get_functiondef('public.archive_contact(uuid)'::regprocedure) LIKE '%AND br.status = ''pending''%',
  'archive cancels only pending broadcast recipients'
);
SELECT ok(
  pg_get_functiondef('public.archive_contact(uuid)'::regprocedure) LIKE '%AND status = ''pending''%',
  'archive cancels only pending automation executions'
);
SELECT ok(
  pg_get_functiondef('public.archive_contact(uuid)'::regprocedure) LIKE '%AND status = ''active''%',
  'archive cancels only active flow runs'
);
SELECT ok(
  pg_get_functiondef('public.restore_contact(uuid)'::regprocedure) NOT LIKE '%broadcast_recipients%',
  'restore does not reactivate cancelled broadcasts'
);
SELECT ok(
  pg_get_functiondef('public.restore_contact(uuid)'::regprocedure) NOT LIKE '%automation_pending_executions%',
  'restore does not reactivate cancelled automations'
);
SELECT ok(
  pg_get_functiondef('public.restore_contact(uuid)'::regprocedure) NOT LIKE '%flow_runs%',
  'restore does not reactivate cancelled flows'
);

INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password)
VALUES
  ('00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'lifecycle-owner@example.com', ''),
  ('00000000-0000-0000-0000-000000000102', '00000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'lifecycle-agent@example.com', ''),
  ('00000000-0000-0000-0000-000000000103', '00000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'lifecycle-viewer@example.com', ''),
  ('00000000-0000-0000-0000-000000000104', '00000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'lifecycle-outsider@example.com', '');

UPDATE profiles
SET account_id = (SELECT account_id FROM profiles WHERE user_id = '00000000-0000-0000-0000-000000000101'),
    account_role = CASE user_id
      WHEN '00000000-0000-0000-0000-000000000102'::UUID THEN 'agent'::account_role_enum
      WHEN '00000000-0000-0000-0000-000000000103'::UUID THEN 'viewer'::account_role_enum
    END
WHERE user_id IN (
  '00000000-0000-0000-0000-000000000102',
  '00000000-0000-0000-0000-000000000103'
);

INSERT INTO contacts (id, user_id, account_id, phone)
VALUES
  ('00000000-0000-0000-0000-000000000201', '00000000-0000-0000-0000-000000000101', (SELECT account_id FROM profiles WHERE user_id = '00000000-0000-0000-0000-000000000101'), '+10000000201'),
  ('00000000-0000-0000-0000-000000000202', '00000000-0000-0000-0000-000000000104', (SELECT account_id FROM profiles WHERE user_id = '00000000-0000-0000-0000-000000000104'), '+10000000202'),
  ('00000000-0000-0000-0000-000000000203', '00000000-0000-0000-0000-000000000101', (SELECT account_id FROM profiles WHERE user_id = '00000000-0000-0000-0000-000000000101'), '+10000000203');

INSERT INTO pipelines (id, user_id, account_id, name)
VALUES ('00000000-0000-0000-0000-000000000601', '00000000-0000-0000-0000-000000000101', (SELECT account_id FROM profiles WHERE user_id = '00000000-0000-0000-0000-000000000101'), 'Lifecycle pipeline');
INSERT INTO pipeline_stages (id, pipeline_id, name, position)
VALUES ('00000000-0000-0000-0000-000000000611', '00000000-0000-0000-0000-000000000601', 'Qualified', 1);
INSERT INTO deals (id, user_id, account_id, pipeline_id, stage_id, contact_id, title)
VALUES ('00000000-0000-0000-0000-000000000621', '00000000-0000-0000-0000-000000000101', (SELECT account_id FROM profiles WHERE user_id = '00000000-0000-0000-0000-000000000101'), '00000000-0000-0000-0000-000000000601', '00000000-0000-0000-0000-000000000611', '00000000-0000-0000-0000-000000000201', 'Preserved deal');

INSERT INTO broadcasts (id, user_id, account_id, name, template_name)
VALUES ('00000000-0000-0000-0000-000000000301', '00000000-0000-0000-0000-000000000101', (SELECT account_id FROM profiles WHERE user_id = '00000000-0000-0000-0000-000000000101'), 'Lifecycle test', 'test');
INSERT INTO broadcast_recipients (id, broadcast_id, contact_id, status, recipient_phone)
VALUES
  ('00000000-0000-0000-0000-000000000311', '00000000-0000-0000-0000-000000000301', '00000000-0000-0000-0000-000000000201', 'pending', '+10000000201'),
  ('00000000-0000-0000-0000-000000000312', '00000000-0000-0000-0000-000000000301', '00000000-0000-0000-0000-000000000201', 'sent', '+10000000201'),
  ('00000000-0000-0000-0000-000000000313', '00000000-0000-0000-0000-000000000301', '00000000-0000-0000-0000-000000000201', 'delivered', '+10000000201'),
  ('00000000-0000-0000-0000-000000000314', '00000000-0000-0000-0000-000000000301', '00000000-0000-0000-0000-000000000201', 'read', '+10000000201'),
  ('00000000-0000-0000-0000-000000000315', '00000000-0000-0000-0000-000000000301', '00000000-0000-0000-0000-000000000201', 'replied', '+10000000201'),
  ('00000000-0000-0000-0000-000000000316', '00000000-0000-0000-0000-000000000301', '00000000-0000-0000-0000-000000000201', 'failed', '+10000000201'),
  ('00000000-0000-0000-0000-000000000317', '00000000-0000-0000-0000-000000000301', '00000000-0000-0000-0000-000000000203', 'pending', '+10000000203');

INSERT INTO automations (id, user_id, account_id, name, trigger_type)
VALUES ('00000000-0000-0000-0000-000000000401', '00000000-0000-0000-0000-000000000101', (SELECT account_id FROM profiles WHERE user_id = '00000000-0000-0000-0000-000000000101'), 'Lifecycle test', 'manual');
INSERT INTO automation_pending_executions (id, automation_id, user_id, account_id, contact_id, next_step_position, run_at, status)
VALUES
  ('00000000-0000-0000-0000-000000000411', '00000000-0000-0000-0000-000000000401', '00000000-0000-0000-0000-000000000101', (SELECT account_id FROM profiles WHERE user_id = '00000000-0000-0000-0000-000000000101'), '00000000-0000-0000-0000-000000000201', 1, NOW(), 'pending'),
  ('00000000-0000-0000-0000-000000000412', '00000000-0000-0000-0000-000000000401', '00000000-0000-0000-0000-000000000101', (SELECT account_id FROM profiles WHERE user_id = '00000000-0000-0000-0000-000000000101'), '00000000-0000-0000-0000-000000000201', 1, NOW(), 'running'),
  ('00000000-0000-0000-0000-000000000413', '00000000-0000-0000-0000-000000000401', '00000000-0000-0000-0000-000000000101', (SELECT account_id FROM profiles WHERE user_id = '00000000-0000-0000-0000-000000000101'), '00000000-0000-0000-0000-000000000201', 1, NOW(), 'done'),
  ('00000000-0000-0000-0000-000000000414', '00000000-0000-0000-0000-000000000401', '00000000-0000-0000-0000-000000000101', (SELECT account_id FROM profiles WHERE user_id = '00000000-0000-0000-0000-000000000101'), '00000000-0000-0000-0000-000000000201', 1, NOW(), 'failed'),
  ('00000000-0000-0000-0000-000000000415', '00000000-0000-0000-0000-000000000401', '00000000-0000-0000-0000-000000000101', (SELECT account_id FROM profiles WHERE user_id = '00000000-0000-0000-0000-000000000101'), '00000000-0000-0000-0000-000000000203', 1, NOW(), 'pending');

INSERT INTO flows (id, user_id, account_id, name, trigger_type)
VALUES ('00000000-0000-0000-0000-000000000501', '00000000-0000-0000-0000-000000000101', (SELECT account_id FROM profiles WHERE user_id = '00000000-0000-0000-0000-000000000101'), 'Lifecycle test', 'manual');
INSERT INTO flow_runs (id, flow_id, user_id, account_id, contact_id, status)
VALUES
  ('00000000-0000-0000-0000-000000000511', '00000000-0000-0000-0000-000000000501', '00000000-0000-0000-0000-000000000101', (SELECT account_id FROM profiles WHERE user_id = '00000000-0000-0000-0000-000000000101'), '00000000-0000-0000-0000-000000000201', 'active'),
  ('00000000-0000-0000-0000-000000000512', '00000000-0000-0000-0000-000000000501', '00000000-0000-0000-0000-000000000101', (SELECT account_id FROM profiles WHERE user_id = '00000000-0000-0000-0000-000000000101'), '00000000-0000-0000-0000-000000000201', 'completed'),
  ('00000000-0000-0000-0000-000000000514', '00000000-0000-0000-0000-000000000501', '00000000-0000-0000-0000-000000000101', (SELECT account_id FROM profiles WHERE user_id = '00000000-0000-0000-0000-000000000101'), '00000000-0000-0000-0000-000000000201', 'handed_off'),
  ('00000000-0000-0000-0000-000000000515', '00000000-0000-0000-0000-000000000501', '00000000-0000-0000-0000-000000000101', (SELECT account_id FROM profiles WHERE user_id = '00000000-0000-0000-0000-000000000101'), '00000000-0000-0000-0000-000000000201', 'timed_out'),
  ('00000000-0000-0000-0000-000000000516', '00000000-0000-0000-0000-000000000501', '00000000-0000-0000-0000-000000000101', (SELECT account_id FROM profiles WHERE user_id = '00000000-0000-0000-0000-000000000101'), '00000000-0000-0000-0000-000000000201', 'paused_by_agent'),
  ('00000000-0000-0000-0000-000000000517', '00000000-0000-0000-0000-000000000501', '00000000-0000-0000-0000-000000000101', (SELECT account_id FROM profiles WHERE user_id = '00000000-0000-0000-0000-000000000101'), '00000000-0000-0000-0000-000000000201', 'failed');

SELECT lives_ok(
  $$ SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000102', true); SELECT public.archive_contact('00000000-0000-0000-0000-000000000201') $$,
  'an agent can archive a contact'
);
SELECT ok((SELECT archived_at IS NOT NULL FROM contacts WHERE id = '00000000-0000-0000-0000-000000000201'),
  'archive timestamps the contact');
SELECT is((SELECT stage_id FROM deals WHERE id = '00000000-0000-0000-0000-000000000621'), '00000000-0000-0000-0000-000000000611'::UUID,
  'archive preserves the contact deal and its stage');
SELECT is((SELECT string_agg(status, ',' ORDER BY id) FROM broadcast_recipients WHERE contact_id = '00000000-0000-0000-0000-000000000201'), 'cancelled,sent,delivered,read,replied,failed',
  'archive cancels pending broadcasts but preserves sent broadcasts');
SELECT is((SELECT string_agg(status, ',' ORDER BY id) FROM automation_pending_executions WHERE contact_id = '00000000-0000-0000-0000-000000000201'), 'cancelled,running,done,failed',
  'archive cancels pending automations but preserves terminal automations');
SELECT is((SELECT string_agg(status, ',' ORDER BY id) FROM flow_runs WHERE contact_id = '00000000-0000-0000-0000-000000000201'), 'cancelled,completed,handed_off,timed_out,paused_by_agent,failed',
  'archive cancels active flows but preserves terminal flows');
SELECT lives_ok($$ SELECT public.archive_contact('00000000-0000-0000-0000-000000000201') $$,
  'archive is idempotent');
SELECT lives_ok($$ SELECT public.restore_contact('00000000-0000-0000-0000-000000000201') $$,
  'an agent can restore a contact');
SELECT ok((SELECT archived_at IS NULL FROM contacts WHERE id = '00000000-0000-0000-0000-000000000201'),
  'restore clears the archive timestamp');
SELECT lives_ok($$ SELECT public.restore_contact('00000000-0000-0000-0000-000000000201') $$,
  'restore is idempotent');
SELECT is((SELECT string_agg(status, ',' ORDER BY id) FROM broadcast_recipients WHERE contact_id = '00000000-0000-0000-0000-000000000201'), 'cancelled,sent,delivered,read,replied,failed',
  'restore does not reactivate cancelled work');
SELECT is(
  (SELECT recipient_phone FROM broadcast_recipients WHERE id = '00000000-0000-0000-0000-000000000311'),
  '+10000000201',
  'broadcast recipients retain the original materialized phone'
);
UPDATE contacts
SET phone = '+19999999999'
WHERE id = '00000000-0000-0000-0000-000000000201';
SELECT is(
  (SELECT recipient_phone FROM broadcast_recipients WHERE id = '00000000-0000-0000-0000-000000000311'),
  '+10000000201',
  'editing a contact cannot change a materialized recipient'
);
UPDATE broadcast_recipients
SET status = 'sent'
WHERE id = '00000000-0000-0000-0000-000000000311'
  AND status = 'pending';
SELECT is(
  (SELECT status FROM broadcast_recipients WHERE id = '00000000-0000-0000-0000-000000000311'),
  'cancelled',
  'a pending-only send completion cannot overwrite concurrent cancellation'
);
SELECT throws_ok(
  $$ SELECT set_config('request.jwt.claim.sub', '', true); SELECT public.archive_contact('00000000-0000-0000-0000-000000000201') $$,
  '42501', 'Unauthorized', 'an unauthenticated caller cannot archive a contact'
);
SELECT throws_ok(
  $$ SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000103', true); SELECT public.archive_contact('00000000-0000-0000-0000-000000000201') $$,
  '42501', 'This action requires the agent role or higher', 'a viewer cannot archive a contact'
);
SELECT throws_ok(
  $$ SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000102', true); SELECT public.archive_contact('00000000-0000-0000-0000-000000000202') $$,
  '42501', 'Contact not found', 'an agent cannot archive another account contact'
);
SELECT ok((SELECT archived_at IS NULL FROM contacts WHERE id = '00000000-0000-0000-0000-000000000202'),
  'cross-account archive leaves the contact unchanged');
SELECT throws_ok(
  $$ SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000103', true); SELECT public.restore_contact('00000000-0000-0000-0000-000000000201') $$,
  '42501', 'This action requires the agent role or higher', 'a viewer cannot restore a contact'
);
SELECT throws_ok(
  $$ SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000102', true); SELECT public.restore_contact('00000000-0000-0000-0000-000000000202') $$,
  '42501', 'Contact not found', 'an agent cannot restore another account contact'
);
SELECT ok((SELECT archived_at IS NULL FROM contacts WHERE id = '00000000-0000-0000-0000-000000000202'),
  'cross-account restore leaves the contact unchanged');
SELECT lives_ok(
  $$ SELECT public.archive_contact('00000000-0000-0000-0000-000000000201') $$,
  'a contact can be archived again for edit protection'
);
SELECT ok(
  NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'contacts' AND policyname = 'contacts_delete'
  ),
  'the contact delete policy is removed'
);
SELECT throws_ok(
  $$ UPDATE contacts SET name = 'Blocked edit' WHERE id = '00000000-0000-0000-0000-000000000201' $$,
  '23514', 'Archived contacts are read-only', 'ordinary edits to archived contacts are rejected'
);

CREATE FUNCTION public.fail_contact_archive_test() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.contact_id = '00000000-0000-0000-0000-000000000203' THEN
    RAISE EXCEPTION 'force rollback';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER fail_contact_archive_test BEFORE UPDATE ON flow_runs
  FOR EACH ROW EXECUTE FUNCTION public.fail_contact_archive_test();
INSERT INTO flow_runs (id, flow_id, user_id, account_id, contact_id, status)
VALUES ('00000000-0000-0000-0000-000000000513', '00000000-0000-0000-0000-000000000501', '00000000-0000-0000-0000-000000000101', (SELECT account_id FROM profiles WHERE user_id = '00000000-0000-0000-0000-000000000101'), '00000000-0000-0000-0000-000000000203', 'active');
SELECT throws_ok(
  $$ SELECT public.archive_contact('00000000-0000-0000-0000-000000000203') $$,
  'P0001', 'force rollback', 'archive rolls back when a child cancellation fails'
);
SELECT ok((SELECT archived_at IS NULL FROM contacts WHERE id = '00000000-0000-0000-0000-000000000203'),
  'failed archive leaves the contact unarchived');
SELECT is((SELECT status FROM broadcast_recipients WHERE id = '00000000-0000-0000-0000-000000000317'), 'pending',
  'failed archive restores broadcast cancellation');
SELECT is((SELECT status FROM automation_pending_executions WHERE id = '00000000-0000-0000-0000-000000000415'), 'pending',
  'failed archive restores automation cancellation');

SELECT * FROM finish();

ROLLBACK;
