import type { ReactElement } from 'react';
import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  clearSelectedContacts: vi.fn(),
  filters: vi.fn(),
  pagination: vi.fn(),
  push: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  usePathname: () => '/contacts',
  useRouter: () => ({ push: mocks.push, refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock('react', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react')>()),
  useEffect: vi.fn(),
  useState<T>(initial: T) {
    return [initial, vi.fn()];
  },
}));
vi.mock('@/components/contacts/contact-detail-view', () => ({ ContactDetailView: vi.fn() }));
vi.mock('@/components/contacts/contact-form', () => ({ ContactForm: vi.fn() }));
vi.mock('@/components/contacts/custom-fields-manager', () => ({ CustomFieldsManager: vi.fn() }));
vi.mock('@/components/contacts/import-modal', () => ({ ImportModal: vi.fn() }));
vi.mock('@/hooks/use-can', () => ({ useCan: () => true }));
vi.mock('@/lib/supabase/client', () => ({ createClient: () => ({ from: vi.fn() }) }));
vi.mock('./contacts-bulk-bar', () => ({ ContactsBulkBar: vi.fn() }));
vi.mock('./contacts-filters', () => ({ ContactsFilters: mocks.filters }));
vi.mock('./contacts-header', () => ({ ContactsHeader: vi.fn() }));
vi.mock('./contacts-pagination', () => ({ ContactsPagination: mocks.pagination }));
vi.mock('./contacts-table', () => ({ ContactsTable: vi.fn() }));
vi.mock('../_hooks/use-contact-lifecycle', () => ({ useContactLifecycle: () => vi.fn() }));
vi.mock('../_hooks/use-contact-selection', () => ({
  useContactSelection: () => ({
    selectedContactIds: new Set<string>(),
    clearSelectedContacts: mocks.clearSelectedContacts,
    toggleContact: vi.fn(),
    toggleVisibleContacts: vi.fn(),
  }),
}));

import type { ContactListView } from '@/lib/contacts/contact-list';
import { ContactsPageClient } from './contacts-page-client';

describe('ContactsPageClient navigation', () => {
  it('clears selection before changing page, search, tags, or status', () => {
    const element = ContactsPageClient({
      view: {
        items: [],
        tagOptions: [{ id: 'tag-1', user_id: 'user', name: 'VIP', color: '#000000', created_at: '2026-01-01' }],
        query: { search: '', tagIds: [], status: 'active', page: 1 },
        pagination: { page: 1, pageSize: 25, total: 30, totalPages: 2 },
      } as ContactListView,
    });
    const children = element.props.children as ReactElement[];
    const filters = children.find((child) => child?.type === mocks.filters)?.props as {
      onSearchChange: (search: string) => void;
      onStatusChange: (status: 'active' | 'archived') => void;
      onToggleTag: (tagId: string) => void;
    };
    const pagination = children.find((child) => child?.type === mocks.pagination)?.props as { onNext: () => void };

    filters.onSearchChange('Ada');
    filters.onToggleTag('tag-1');
    filters.onStatusChange('archived');
    pagination.onNext();

    expect(mocks.clearSelectedContacts).toHaveBeenCalledTimes(4);
    expect(mocks.push.mock.calls).toEqual([
      ['/contacts?q=Ada'],
      ['/contacts?tag=tag-1'],
      ['/contacts?status=archived'],
      ['/contacts?page=2'],
    ]);
  });
});
