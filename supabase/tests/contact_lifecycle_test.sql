BEGIN;

SELECT plan(17);

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

SELECT * FROM finish();

ROLLBACK;
