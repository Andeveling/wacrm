import { ContactsPageClient } from './_components/contacts-page-client';
import { getContactListView } from '@/lib/contacts/contact-list';
import type { ContactListSearchParams } from '@/lib/contacts/contact-list-query';

export default async function ContactsPage({ searchParams }: { searchParams: Promise<ContactListSearchParams> }) {
  const view = await getContactListView(await searchParams);
  return <ContactsPageClient view={view} />;
}
