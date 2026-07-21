'use client';

import { useTranslations } from 'next-intl';
import { useCallback } from 'react';
import { toast } from 'sonner';
import { updateContactLifecycle } from '../_actions/actions';
import type { ContactWithTags } from './use-contacts';

interface UseContactLifecycleParams {
  contacts: ContactWithTags[];
  removeDisplayedContacts: (rows: ContactWithTags[]) => void;
  restoreDisplayedContacts: (rows: ContactWithTags[]) => void;
  clearSelectedContacts: () => void;
}

export function useContactLifecycle({
  contacts,
  removeDisplayedContacts,
  restoreDisplayedContacts,
  clearSelectedContacts,
}: UseContactLifecycleParams) {
  const t = useTranslations('Contacts.page');

  return useCallback(
    async (action: 'archive' | 'restore', contactIds: string[]) => {
      const visibleIds = new Set(contacts.map((contact) => contact.id));
      const visibleContactIds = contactIds.filter((id) => visibleIds.has(id));
      if (visibleContactIds.length === 0) return;

      const contactsBeingUpdated = contacts.filter((contact) => visibleContactIds.includes(contact.id));

      removeDisplayedContacts(contactsBeingUpdated);
      clearSelectedContacts();

      const lifecycleUpdate = await updateContactLifecycle(action, visibleContactIds);
      if (!lifecycleUpdate.ok) {
        restoreDisplayedContacts(contactsBeingUpdated);
        toast.error(t('toastLifecycleFailed'));
        return;
      }

      if (action === 'archive') {
        toast.success(t('toastArchived', { count: visibleContactIds.length }), {
          action: {
            label: t('undo'),
            onClick: async () => {
              const lifecycleRestore = await updateContactLifecycle('restore', visibleContactIds);
              if (!lifecycleRestore.ok) {
                toast.error(t('toastLifecycleFailed'));
                return;
              }
              restoreDisplayedContacts(contactsBeingUpdated);
            },
          },
        });
      } else {
        toast.success(t('toastRestored', { count: visibleContactIds.length }));
      }
    },
    [contacts, removeDisplayedContacts, restoreDisplayedContacts, clearSelectedContacts, t]
  );
}
