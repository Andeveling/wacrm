-- A broadcast recipient is a materialized delivery target: keep its phone
-- stable even if the contact is edited after the broadcast is created.
ALTER TABLE broadcast_recipients
  ADD COLUMN IF NOT EXISTS recipient_phone TEXT;

UPDATE broadcast_recipients br
SET recipient_phone = c.phone
FROM contacts c
WHERE c.id = br.contact_id
  AND br.recipient_phone IS NULL;

CREATE INDEX IF NOT EXISTS idx_broadcast_recipients_pending_contact
  ON broadcast_recipients (id, contact_id)
  WHERE status = 'pending';
