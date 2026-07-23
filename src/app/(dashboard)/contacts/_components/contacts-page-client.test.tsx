import type { ReactElement } from 'react';
import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  bulkBar: vi.fn(),
  clearSelectedContacts: vi.fn(),
  filters: vi.fn(),
  header: vi.fn(),
  pagination: vi.fn(),
  push: vi.fn(),
  replace: vi.fn(),
  refresh: vi.fn(),
  table: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  usePathname: () => '/contacts',
  useRouter: () => ({ push: mocks.push, replace: mocks.replace, refresh: mocks.refresh }),
  useSearchParams: () => new URLSearchParams(),
}));

/**
 * `react` mock — keeps the real implementations of hooks we don't care
 * about and stubs out the ones the page interacts with in a way that
 * matters for these assertions.
 *
 *   - `useState` / `useEffect` are stubbed because the assertions
 *     below never read state and never observe effect side-effects;
 *     using no-ops lets `ContactsPageClient` render without mounting
 *     a real React tree.
 */
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
vi.mock('./contacts-bulk-bar', () => ({ ContactsBulkBar: mocks.bulkBar }));
vi.mock('./contacts-filters', () => ({ ContactsFilters: mocks.filters }));
vi.mock('./contacts-header', () => ({ ContactsHeader: mocks.header }));
vi.mock('./contacts-pagination', () => ({ ContactsPagination: mocks.pagination }));
vi.mock('./contacts-table', () => ({ ContactsTable: mocks.table }));
vi.mock('../_hooks/use-contact-lifecycle', () => ({ useContactLifecycle: () => vi.fn() }));
vi.mock('../_hooks/use-contact-selection', () => ({
  useContactSelection: () => ({
    selectedContactIds: new Set<string>(),
    clearSelectedContacts: mocks.clearSelectedContacts,
    toggleContact: vi.fn(),
    toggleVisibleContacts: vi.fn(),
  }),
}));

import type { ContactListItem, ContactListView } from '@/lib/contacts/contact-list';
import { ContactsPageClient } from './contacts-page-client';

/**
 * The page client never mounts in this suite — we call it as a
 * function and walk the returned React element tree. Each child is a
 * stubbed component reference (e.g. `mocks.filters`) so we can pluck
 * its props by component identity, which avoids depending on the
 * render order or wrapping elements.
 */
function renderPageClient(view: ContactListView) {
  const element = ContactsPageClient({ view });
  const children = (element.props.children as ReactElement[]).filter((c): c is ReactElement => c != null);
  const childProps = (component: ReactElement['type']) => {
    const child = children.find((c) => c?.type === component);
    if (!child) throw new Error(`component not rendered: ${String(component)}`);
    return child.props as Record<string, unknown>;
  };
  return {
    filters: childProps(mocks.filters),
    table: childProps(mocks.table),
    pagination: childProps(mocks.pagination),
    header: childProps(mocks.header),
  };
}

const baseView: ContactListView = {
  items: [
    {
      id: 'contact-1',
      user_id: 'user',
      account_id: 'account',
      phone: '+10000000000',
      archived_at: null,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
      tags: [],
    } satisfies ContactListItem,
  ],
  tagOptions: [{ id: 'tag-1', user_id: 'user', name: 'VIP', color: '#000000', created_at: '2026-01-01' }],
  query: { search: '', tagIds: [], status: 'active', page: 1 },
  pagination: { page: 1, pageSize: 25, total: 30, totalPages: 2 },
};

describe('ContactsPageClient navigation', () => {
  it('clears selection before changing page, search, tags, or status', () => {
    const { filters, pagination } = renderPageClient(baseView);
    const filtersProps = filters as {
      onSearchSubmit: (search: string) => void;
      onStatusChange: (status: 'active' | 'archived') => void;
      onToggleTag: (tagId: string) => void;
    };
    const paginationProps = pagination as { onNext: () => void };

    filtersProps.onSearchSubmit('Ada');
    filtersProps.onToggleTag('tag-1');
    filtersProps.onStatusChange('archived');
    paginationProps.onNext();

    expect(mocks.clearSelectedContacts).toHaveBeenCalledTimes(4);
    expect(mocks.replace).toHaveBeenCalledExactlyOnceWith('/contacts?q=Ada', { scroll: false });
    expect(mocks.push.mock.calls).toEqual([
      ['/contacts?tag=tag-1', { scroll: false }],
      ['/contacts?status=archived', { scroll: false }],
      ['/contacts?page=2', { scroll: false }],
    ]);
  });

  it('replaces history for search submissions', () => {
    const { filters } = renderPageClient(baseView);
    (filters as { onSearchSubmit: (s: string) => void }).onSearchSubmit('Ada');
    expect(mocks.replace).toHaveBeenCalledExactlyOnceWith('/contacts?q=Ada', { scroll: false });
  });
});

describe('ContactsPageClient wiring', () => {
  it('forwards the URL-derived search term to the filter', () => {
    const view: ContactListView = {
      ...baseView,
      query: { ...baseView.query, search: 'Ada' },
    };
    const { filters } = renderPageClient(view);
    const props = filters as {
      search: string;
      onSearchSubmit: (s: string) => void;
    };

    expect(props.search).toBe('Ada');
    expect(typeof props.onSearchSubmit).toBe('function');
  });

  it('uses the optimistic displayed contacts as the table source', () => {
    const { table } = renderPageClient(baseView);
    expect((table as { contacts: ContactListItem[] }).contacts).toBe(baseView.items);
  });

  it('omits the bulk bar when no contacts are selected', () => {
    // Selection is empty, so the parent renders
    // `{size > 0 && <ContactsBulkBar />}`. Asserting the bulk bar is
    // absent guarantees the gating condition didn't silently break
    // (e.g. an accidental `>= 0`).
    const element = ContactsPageClient({ view: baseView });
    const children = (element.props.children as ReactElement[]).filter((c): c is ReactElement => c != null);
    expect(children.some((c) => c?.type === mocks.bulkBar)).toBe(false);
  });
});
