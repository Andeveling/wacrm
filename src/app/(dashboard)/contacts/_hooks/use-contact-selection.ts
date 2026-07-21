'use client';

import { useCallback, useState } from 'react';

export function useContactSelection() {
  const [selectedContactIds, setSelectedContactIds] = useState<Set<string>>(new Set());

  const toggleContact = useCallback((contactId: string) => {
    setSelectedContactIds((selectedContactIds) => {
      const updatedSelection = new Set(selectedContactIds);
      if (updatedSelection.has(contactId)) updatedSelection.delete(contactId);
      else updatedSelection.add(contactId);
      return updatedSelection;
    });
  }, []);

  const toggleVisibleContacts = useCallback((contactIds: string[]) => {
    setSelectedContactIds((selectedContactIds) => {
      const updatedSelection = new Set(selectedContactIds);
      const allVisibleContactsSelected = contactIds.length > 0 && contactIds.every((contactId) => updatedSelection.has(contactId));

      contactIds.forEach((contactId) => {
        if (allVisibleContactsSelected) updatedSelection.delete(contactId);
        else updatedSelection.add(contactId);
      });
      return updatedSelection;
    });
  }, []);

  const clearSelectedContacts = useCallback(() => setSelectedContactIds(new Set()), []);

  return {
    selectedContactIds,
    toggleContact,
    toggleVisibleContacts,
    clearSelectedContacts,
  };
}
