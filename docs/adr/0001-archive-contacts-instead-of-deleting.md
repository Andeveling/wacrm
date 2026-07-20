# Archive contacts instead of deleting them

Routine contact removal is archival because physical deletion can cascade through conversations and messages, destroying CRM history. A nullable `contacts.archived_at` records archival: archived contacts are excluded from the default list and outbound communication, while conversations and history are retained.

Archival is a transactional domain operation exposed through an authorized database function. It marks pending broadcasts and automation executions, as well as active flow runs, with an explicit terminal `cancelled` state and the `contact_archived` reason; already started, sent, or completed work is not rewritten. Cancellation remains terminal after restoration, and outbound adapters recheck that the contact is active immediately before an external send.

An archived contact is read-only and can be restored manually, by creating or Contact-importing its phone number again, or automatically when it sends a new inbound message. Contact import merges non-empty data and adds tags, while Broadcast CSV excludes archived recipients without restoring them. Conversations and deals remain visible with an archived indicator, retain their own lifecycle, and block outbound communication until restoration. Operational counts and audiences exclude archived contacts, while historical creation metrics retain them.

The rule applies consistently to the dashboard and public API: routine `DELETE` archives, list operations distinguish active from archived contacts, and creation with an archived phone restores and merges non-empty data. Archiving and restoration require the `agent` role or higher; irreversible purging is a separate administrative concern outside this decision.
