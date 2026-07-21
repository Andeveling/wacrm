'use client';

import { useTranslations } from 'next-intl';
import { useCallback } from 'react';
import { toast } from 'sonner';
import type { ContactListItem } from '@/lib/contacts/contact-list';
import { updateContactLifecycle } from '../_actions/actions';

interface UseContactLifecycleParams {
  contacts: ContactListItem[];
  clearSelectedContacts: () => void;
  removeDisplayedContacts?: (rows: ContactListItem[]) => void;
  restoreDisplayedContacts?: (rows: ContactListItem[]) => void;
  onUpdated?: () => void;
}

export function useContactLifecycle({
  contacts,
  clearSelectedContacts,
  removeDisplayedContacts,
  restoreDisplayedContacts,
  onUpdated,
}: UseContactLifecycleParams) {
  const t = useTranslations('Contacts.page');

  return useCallback(
    async (action: 'archive' | 'restore', contactIds: string[]) => {
      const visibleIds = new Set(contacts.map((contact) => contact.id));
      const visibleContactIds = contactIds.filter((id) => visibleIds.has(id));
      if (visibleContactIds.length === 0) return;

      const contactsBeingUpdated = contacts.filter((contact) => visibleContactIds.includes(contact.id));
      removeDisplayedContacts?.(contactsBeingUpdated);
      clearSelectedContacts();

      const lifecycleUpdate = await updateContactLifecycle(action, visibleContactIds);
      if (!lifecycleUpdate.ok) {
        const failedIds = new Set(lifecycleUpdate.failedIds ?? visibleContactIds);
        restoreDisplayedContacts?.(contactsBeingUpdated.filter((contact) => failedIds.has(contact.id)));
        if (failedIds.size < visibleContactIds.length) onUpdated?.();
        toast.error(t('toastLifecycleFailed'));
        return;
      }

      onUpdated?.();

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
              restoreDisplayedContacts?.(contactsBeingUpdated);
              onUpdated?.();
            },
          },
        });
      } else {
        toast.success(t('toastRestored', { count: visibleContactIds.length }));
      }
    },
    [contacts, clearSelectedContacts, removeDisplayedContacts, restoreDisplayedContacts, onUpdated, t]
  );
}
