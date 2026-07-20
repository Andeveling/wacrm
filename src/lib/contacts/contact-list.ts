import 'server-only';

import { createClient } from '@/lib/supabase/server';
import type { Contact, Tag } from '@/types';
import {
  type ContactListQuery,
  type ContactListSearchParams,
  parseContactListQuery,
} from './contact-list-query';

const PAGE_SIZE = 25;

export interface ContactListItem extends Contact {
  tags: Tag[];
}

export interface ContactListView {
  items: ContactListItem[];
  tagOptions: Tag[];
  query: ContactListQuery;
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

export async function getContactListView(
  searchParams: ContactListSearchParams
): Promise<ContactListView> {
  const query = parseContactListQuery(searchParams);
  const supabase = await createClient();
  const [listResult, tagsResult] = await Promise.all([
    supabase.rpc('list_contacts', {
      p_search: query.search || null,
      p_tag_ids: query.tagIds,
      p_status: query.status,
      p_page: query.page,
    }),
    supabase.from('tags').select('*').order('name'),
  ]);

  if (listResult.error) throw listResult.error;
  if (tagsResult.error) throw tagsResult.error;

  const row = (listResult.data?.[0] ?? { items: [], total_count: 0 }) as {
    items: ContactListItem[];
    total_count: number | string;
  };
  const total = Number(row.total_count);

  return {
    items: row.items,
    tagOptions: tagsResult.data ?? [],
    query,
    pagination: {
      page: query.page,
      pageSize: PAGE_SIZE,
      total,
      totalPages: Math.ceil(total / PAGE_SIZE),
    },
  };
}
