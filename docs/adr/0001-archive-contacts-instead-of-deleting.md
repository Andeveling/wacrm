# Archive contacts instead of deleting them

Routine contact removal is archival because physical deletion can cascade through conversations and messages, destroying CRM history. A nullable `contacts.archived_at` records archival: archived contacts are excluded from the default list and outbound communication, while conversations and history are retained.

Archival is a transactional domain operation exposed through an authorized database function. It marks pending broadcasts and automation executions, as well as active flow runs, with an explicit terminal `cancelled` state and the `contact_archived` reason; already started, sent, or completed work is not rewritten.

An archived contact can be restored manually, by creating or importing its phone number again, or automatically when it sends a new inbound message. Conversations and deals remain visible with an archived indicator, retain their own lifecycle, and block outbound communication until restoration. Archiving and restoration require the `agent` role or higher; irreversible purging is a separate administrative concern outside this decision.
