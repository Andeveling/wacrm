# WACRM Domain

Domain language for the CRM capabilities represented in WACRM.

## Language

**Tag filter**:
A contact-list criterion that matches a contact when it has at least one of the selected tags.
_Avoid_: All-tags filter, tag intersection

**Contact search**:
A contact-list criterion that partially matches a contact's name, phone number, or email address. Tags are selected through a Tag filter instead of participating in Contact search.
_Avoid_: Tag search, global search

**Contact identity**:
Within an account, a phone number identifies one contact across archival and restoration. Creating or using Contact import for that phone restores the archived contact by merging non-empty values and adding tags instead of creating a duplicate.
_Avoid_: Active-only identity, duplicate contact

**Contact import**:
An ingestion into the contact directory that may create contacts or restore existing Archived contacts.
_Avoid_: Broadcast CSV, generic CSV import

**Broadcast CSV**:
A recipient source for one broadcast. Archived contacts are excluded and never restored by audience selection.
_Avoid_: Contact import, generic CSV import

**Archived contact**:
A read-only contact excluded from the default contact list and outbound communication while retaining its conversations and history; pending outbound work is canceled. It remains discoverable in the archived-contact list and is restored manually or automatically when it sends a new inbound message.
_Avoid_: Deleted contact, removed contact
