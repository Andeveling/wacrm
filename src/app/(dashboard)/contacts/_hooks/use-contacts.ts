// Contact list behavior lives in the server-side Contact list module.
// Keep these aliases while lifecycle tests and components migrate to its types.
import type { ContactListItem } from '@/lib/contacts/contact-list';
import type { ContactListQuery } from '@/lib/contacts/contact-list-query';

export type ContactWithTags = ContactListItem;
export type ContactStatus = ContactListQuery['status'];
