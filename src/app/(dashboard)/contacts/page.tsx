'use client';

import { useState } from 'react';
import { ContactDetailView } from '@/components/contacts/contact-detail-view';
import { ContactForm } from '@/components/contacts/contact-form';
import { CustomFieldsManager } from '@/components/contacts/custom-fields-manager';
import { ImportModal } from '@/components/contacts/import-modal';
import { useCan } from '@/hooks/use-can';
import { createClient } from '@/lib/supabase/client';
import type { Contact, ContactTag } from '@/types';

import { ContactsBulkBar } from './_components/contacts-bulk-bar';
import { ContactsFilters } from './_components/contacts-filters';
import { ContactsHeader } from './_components/contacts-header';
import { ContactsPagination } from './_components/contacts-pagination';
import { ContactsTable } from './_components/contacts-table';
import { useContactLifecycle } from './_hooks/use-contact-lifecycle';
import { useContactSelection } from './_hooks/use-contact-selection';
import { PAGE_SIZE, useContacts } from './_hooks/use-contacts';

export default function ContactsPage() {
  const supabase = createClient();
  const canEdit = useCan('send-messages');
  const canEditSettings = useCan('edit-settings');

  const selection = useContactSelection();

  const {
    contacts,
    loading,
    totalCount,
    search,
    setSearch,
    page,
    setPage,
    totalPages,
    hasNext,
    hasPrev,
    status,
    setStatus,
    selectedTagIds,
    toggleTagFilter,
    clearTagFilters,
    tagsById,
    allTags,
    hasActiveFilters,
    reloadContacts,
    reloadTags,
    removeDisplayedContacts,
    restoreDisplayedContacts,
  } = useContacts({
    onContactsWillRefresh: selection.clearSelectedContacts,
  });

  const updateLifecycle = useContactLifecycle({
    contacts,
    removeDisplayedContacts,
    restoreDisplayedContacts,
    clearSelectedContacts: selection.clearSelectedContacts,
  });

  const [formOpen, setFormOpen] = useState(false);
  const [editContact, setEditContact] = useState<Contact | null>(null);
  const [editContactTags, setEditContactTags] = useState<ContactTag[]>([]);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailContactId, setDetailContactId] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [customFieldsOpen, setCustomFieldsOpen] = useState(false);

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

  return (
    <div className="space-y-6">
      <ContactsHeader
        totalCount={totalCount}
        canEdit={canEdit}
        canEditSettings={canEditSettings}
        onAdd={openAddForm}
        onImport={() => setImportOpen(true)}
        onCustomFields={() => setCustomFieldsOpen(true)}
      />

      <ContactsFilters
        status={status}
        onStatusChange={setStatus}
        search={search}
        onSearchChange={setSearch}
        allTags={allTags}
        selectedTagIds={selectedTagIds}
        tagsById={tagsById}
        onToggleTag={toggleTagFilter}
        onClearTags={clearTagFilters}
      />

      {selection.selectedContactIds.size > 0 && (
        <ContactsBulkBar
          count={selection.selectedContactIds.size}
          status={status}
          canEdit={canEdit}
          onClear={selection.clearSelectedContacts}
          onArchiveOrRestore={() => updateLifecycle(status === 'active' ? 'archive' : 'restore', [...selection.selectedContactIds])}
        />
      )}

      <ContactsTable
        contacts={contacts}
        loading={loading}
        hasActiveFilters={hasActiveFilters}
        status={status}
        selectedIds={selection.selectedContactIds}
        canEdit={canEdit}
        onSelectAll={() => selection.toggleVisibleContacts(contacts.map((contact) => contact.id))}
        onSelect={selection.toggleContact}
        onOpenDetail={openDetail}
        onEdit={openEditForm}
        onArchiveOrRestore={(id) => updateLifecycle(status === 'active' ? 'archive' : 'restore', [id])}
        onAdd={openAddForm}
      />

      <ContactsPagination
        page={page}
        totalPages={totalPages}
        totalCount={totalCount}
        pageSize={PAGE_SIZE}
        hasPrev={hasPrev}
        hasNext={hasNext}
        onPrev={() => setPage((p) => p - 1)}
        onNext={() => setPage((p) => p + 1)}
      />

      <ContactForm
        open={formOpen}
        onOpenChange={setFormOpen}
        contact={editContact}
        contactTags={editContactTags}
        onSaved={() => {
          reloadContacts();
          reloadTags();
        }}
        onViewExisting={(id) => {
          setFormOpen(false);
          openDetail(id);
        }}
      />

      <ContactDetailView open={detailOpen} onOpenChange={setDetailOpen} contactId={detailContactId} onUpdated={reloadContacts} />

      <ImportModal open={importOpen} onOpenChange={setImportOpen} onImported={reloadContacts} />

      {canEditSettings && <CustomFieldsManager open={customFieldsOpen} onOpenChange={setCustomFieldsOpen} />}
    </div>
  );
}
