'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

import { ContactDetailView } from '@/components/contacts/contact-detail-view';
import { ContactForm } from '@/components/contacts/contact-form';
import { CustomFieldsManager } from '@/components/contacts/custom-fields-manager';
import { ImportModal } from '@/components/contacts/import-modal';
import { useCan } from '@/hooks/use-can';
import type { ContactListView } from '@/lib/contacts/contact-list';
import { createClient } from '@/lib/supabase/client';
import type { Contact, ContactTag, Tag } from '@/types';

import { ContactsBulkBar } from './contacts-bulk-bar';
import { ContactsFilters } from './contacts-filters';
import { ContactsHeader } from './contacts-header';
import { ContactsPagination } from './contacts-pagination';
import { ContactsTable } from './contacts-table';
import { useContactLifecycle } from '../_hooks/use-contact-lifecycle';
import { useContactSelection } from '../_hooks/use-contact-selection';

export function ContactsPageClient({ view }: { view: ContactListView }) {
  const supabase = createClient();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const canEdit = useCan('send-messages');
  const canEditSettings = useCan('edit-settings');
  const selection = useContactSelection();
  const [formOpen, setFormOpen] = useState(false);
  const [editContact, setEditContact] = useState<Contact | null>(null);
  const [editContactTags, setEditContactTags] = useState<ContactTag[]>([]);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailContactId, setDetailContactId] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [customFieldsOpen, setCustomFieldsOpen] = useState(false);
  const [displayedContacts, setDisplayedContacts] = useState(view.items);

  useEffect(() => {
    // The server refresh after a lifecycle update is the source of truth.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDisplayedContacts(view.items);
  }, [view.items]);

  const tagsById = Object.fromEntries(view.tagOptions.map((tag) => [tag.id, tag]));

  function navigate(next: { search?: string; tagIds?: string[]; status?: 'active' | 'archived'; page?: number }) {
    const params = new URLSearchParams(searchParams.toString());
    const search = next.search ?? view.query.search;
    const tagIds = next.tagIds ?? view.query.tagIds;
    const status = next.status ?? view.query.status;
    const page = next.page ?? view.query.page;

    if (search) params.set('q', search);
    else params.delete('q');
    params.delete('tag');
    tagIds.forEach((tagId) => {
      params.append('tag', tagId);
    });
    if (status === 'archived') params.set('status', status);
    else params.delete('status');
    if (page > 1) params.set('page', String(page));
    else params.delete('page');

    router.push(`${pathname}${params.size ? `?${params}` : ''}`);
  }

  const updateLifecycle = useContactLifecycle({
    contacts: displayedContacts,
    clearSelectedContacts: selection.clearSelectedContacts,
    removeDisplayedContacts: (rows) => {
      const ids = new Set(rows.map((contact) => contact.id));
      setDisplayedContacts((contacts) => contacts.filter((contact) => !ids.has(contact.id)));
    },
    restoreDisplayedContacts: (rows) => {
      setDisplayedContacts((contacts) =>
        [...rows, ...contacts]
          .filter((contact, index, all) => all.findIndex((candidate) => candidate.id === contact.id) === index)
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      );
    },
    onUpdated: router.refresh,
  });

  function openAddForm() {
    setEditContact(null);
    setEditContactTags([]);
    setFormOpen(true);
  }

  async function openEditForm(contact: Contact) {
    const { data } = await supabase.from('contact_tags').select('*').eq('contact_id', contact.id);
    setEditContact(contact);
    setEditContactTags(data ?? []);
    setFormOpen(true);
  }

  function openDetail(contactId: string) {
    setDetailContactId(contactId);
    setDetailOpen(true);
  }

  function toggleTag(tagId: string) {
    navigate({
      tagIds: view.query.tagIds.includes(tagId) ? view.query.tagIds.filter((id) => id !== tagId) : [...view.query.tagIds, tagId],
      page: 1,
    });
  }

  return (
    <div className="space-y-6">
      <ContactsHeader
        totalCount={view.pagination.total}
        canEdit={canEdit}
        canEditSettings={canEditSettings}
        onAdd={openAddForm}
        onImport={() => setImportOpen(true)}
        onCustomFields={() => setCustomFieldsOpen(true)}
      />

      <ContactsFilters
        status={view.query.status}
        onStatusChange={(status) => navigate({ status, page: 1 })}
        search={view.query.search}
        onSearchChange={(search) => navigate({ search, page: 1 })}
        allTags={view.tagOptions}
        selectedTagIds={view.query.tagIds}
        tagsById={tagsById as Record<string, Tag>}
        onToggleTag={toggleTag}
        onClearTags={() => navigate({ tagIds: [], page: 1 })}
      />

      {selection.selectedContactIds.size > 0 && (
        <ContactsBulkBar
          count={selection.selectedContactIds.size}
          status={view.query.status}
          canEdit={canEdit}
          onClear={selection.clearSelectedContacts}
          onArchiveOrRestore={() => updateLifecycle(view.query.status === 'active' ? 'archive' : 'restore', [...selection.selectedContactIds])}
        />
      )}

      <ContactsTable
        contacts={displayedContacts}
        loading={false}
        hasActiveFilters={view.query.search.length > 0 || view.query.tagIds.length > 0}
        status={view.query.status}
        selectedIds={selection.selectedContactIds}
        canEdit={canEdit}
        onSelectAll={() => selection.toggleVisibleContacts(displayedContacts.map((contact) => contact.id))}
        onSelect={selection.toggleContact}
        onOpenDetail={openDetail}
        onEdit={openEditForm}
        onArchiveOrRestore={(id) => updateLifecycle(view.query.status === 'active' ? 'archive' : 'restore', [id])}
        onAdd={openAddForm}
      />

      <ContactsPagination
        page={view.pagination.page - 1}
        totalPages={view.pagination.totalPages}
        totalCount={view.pagination.total}
        pageSize={view.pagination.pageSize}
        hasPrev={view.pagination.page > 1}
        hasNext={view.pagination.page < view.pagination.totalPages}
        onPrev={() => navigate({ page: view.pagination.page - 1 })}
        onNext={() => navigate({ page: view.pagination.page + 1 })}
      />

      <ContactForm
        open={formOpen}
        onOpenChange={setFormOpen}
        contact={editContact}
        contactTags={editContactTags}
        onSaved={router.refresh}
        onViewExisting={(id) => {
          setFormOpen(false);
          openDetail(id);
        }}
      />

      <ContactDetailView open={detailOpen} onOpenChange={setDetailOpen} contactId={detailContactId} onUpdated={router.refresh} />

      <ImportModal open={importOpen} onOpenChange={setImportOpen} onImported={router.refresh} />

      {canEditSettings && <CustomFieldsManager open={customFieldsOpen} onOpenChange={setCustomFieldsOpen} />}
    </div>
  );
}
