-- Contact lifecycle primitives. Archive/restore operations are added separately.

ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_contacts_account_active
  ON contacts(account_id, created_at DESC)
  WHERE archived_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_contacts_account_archived
  ON contacts(account_id, archived_at DESC)
  WHERE archived_at IS NOT NULL;

ALTER TABLE broadcast_recipients
  ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancellation_reason TEXT;

ALTER TABLE broadcast_recipients
  DROP CONSTRAINT IF EXISTS broadcast_recipients_status_check,
  DROP CONSTRAINT IF EXISTS broadcast_recipients_cancellation_audit_check;

ALTER TABLE broadcast_recipients
  ADD CONSTRAINT broadcast_recipients_status_check
    CHECK (status IN ('pending', 'sent', 'delivered', 'read', 'replied', 'failed', 'cancelled')),
  ADD CONSTRAINT broadcast_recipients_cancellation_audit_check
    CHECK (
      status <> 'cancelled'
      OR (
        cancelled_at IS NOT NULL
        AND cancellation_reason IS NOT NULL
        AND cancellation_reason = 'contact_archived'
      )
    );

ALTER TABLE automation_pending_executions
  ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancellation_reason TEXT;

ALTER TABLE automation_pending_executions
  DROP CONSTRAINT IF EXISTS automation_pending_executions_status_check,
  DROP CONSTRAINT IF EXISTS automation_pending_executions_cancellation_audit_check;

ALTER TABLE automation_pending_executions
  ADD CONSTRAINT automation_pending_executions_status_check
    CHECK (status IN ('pending', 'running', 'done', 'failed', 'cancelled')),
  ADD CONSTRAINT automation_pending_executions_cancellation_audit_check
    CHECK (
      status <> 'cancelled'
      OR (
        cancelled_at IS NOT NULL
        AND cancellation_reason IS NOT NULL
        AND cancellation_reason = 'contact_archived'
      )
    );

-- flow_runs already has ended_at/end_reason, so reuse those audit fields.
ALTER TABLE flow_runs
  DROP CONSTRAINT IF EXISTS flow_runs_status_check,
  DROP CONSTRAINT IF EXISTS flow_runs_cancellation_audit_check;

ALTER TABLE flow_runs
  ADD CONSTRAINT flow_runs_status_check
    CHECK (status IN (
      'active', 'completed', 'handed_off', 'timed_out',
      'paused_by_agent', 'failed', 'cancelled'
    )),
  ADD CONSTRAINT flow_runs_cancellation_audit_check
    CHECK (
      status <> 'cancelled'
      OR (
        ended_at IS NOT NULL
        AND end_reason IS NOT NULL
        AND end_reason = 'contact_archived'
      )
    );

CREATE OR REPLACE FUNCTION public.prevent_cancelled_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status = 'cancelled' AND NEW.status IS DISTINCT FROM 'cancelled' THEN
    RAISE EXCEPTION 'cancelled is a terminal status'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS prevent_cancelled_reactivation ON broadcast_recipients;
CREATE TRIGGER prevent_cancelled_reactivation
  BEFORE UPDATE OF status ON broadcast_recipients
  FOR EACH ROW EXECUTE FUNCTION public.prevent_cancelled_status_change();

DROP TRIGGER IF EXISTS prevent_cancelled_reactivation ON automation_pending_executions;
CREATE TRIGGER prevent_cancelled_reactivation
  BEFORE UPDATE OF status ON automation_pending_executions
  FOR EACH ROW EXECUTE FUNCTION public.prevent_cancelled_status_change();

DROP TRIGGER IF EXISTS prevent_cancelled_reactivation ON flow_runs;
CREATE TRIGGER prevent_cancelled_reactivation
  BEFORE UPDATE OF status ON flow_runs
  FOR EACH ROW EXECUTE FUNCTION public.prevent_cancelled_status_change();

-- Cancelled recipients are terminal but contribute to no delivery counter.
CREATE OR REPLACE FUNCTION public._bcast_cols_for_status(s TEXT)
RETURNS TEXT[] AS $$
BEGIN
  IF s IN ('pending', 'cancelled') THEN RETURN ARRAY[]::TEXT[]; END IF;
  IF s = 'sent'      THEN RETURN ARRAY['sent_count']; END IF;
  IF s = 'delivered' THEN RETURN ARRAY['sent_count','delivered_count']; END IF;
  IF s = 'read'      THEN RETURN ARRAY['sent_count','delivered_count','read_count']; END IF;
  IF s = 'replied'   THEN RETURN ARRAY['sent_count','delivered_count','read_count','replied_count']; END IF;
  IF s = 'failed'    THEN RETURN ARRAY['failed_count']; END IF;
  RETURN ARRAY[]::TEXT[];
END;
$$ LANGUAGE plpgsql IMMUTABLE;
