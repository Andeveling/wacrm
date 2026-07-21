import { beforeEach, describe, expect, it, vi } from 'vitest';

const { updateContactLifecycle, toast } = vi.hoisted(() => ({
  updateContactLifecycle: vi.fn(),
  toast: { error: vi.fn(), success: vi.fn() },
}));

vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }));
vi.mock('react', () => ({ useCallback: <T>(callback: T) => callback }));
vi.mock('sonner', () => ({ toast }));
vi.mock('../_actions/actions', () => ({ updateContactLifecycle }));

import { useContactLifecycle } from './use-contact-lifecycle';
import type { ContactListItem } from '@/lib/contacts/contact-list';

const contacts = [
  { id: '11111111-1111-4111-8111-111111111111', created_at: '2026-01-02T00:00:00Z' } as ContactListItem,
  { id: '22222222-2222-4222-8222-222222222222', created_at: '2026-01-01T00:00:00Z' } as ContactListItem,
];

describe('useContactLifecycle', () => {
  beforeEach(() => vi.clearAllMocks());

  it('rolls back only the failed rows after a partial optimistic bulk update', async () => {
    updateContactLifecycle.mockResolvedValue({ ok: false, failedIds: [contacts[1].id] });
    const removeDisplayedContacts = vi.fn();
    const restoreDisplayedContacts = vi.fn();
    const clearSelectedContacts = vi.fn();
    const update = useContactLifecycle({ contacts, removeDisplayedContacts, restoreDisplayedContacts, clearSelectedContacts });

    await update('archive', contacts.map((contact) => contact.id));

    expect(removeDisplayedContacts).toHaveBeenCalledWith(contacts);
    expect(restoreDisplayedContacts).toHaveBeenCalledWith([contacts[1]]);
    expect(clearSelectedContacts).toHaveBeenCalledOnce();
    expect(toast.error).toHaveBeenCalledWith('toastLifecycleFailed');
  });
});
