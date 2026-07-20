export type ContactListSearchParams = Record<
  string,
  string | string[] | undefined
>;

export interface ContactListQuery {
  search: string;
  tagIds: string[];
  page: number;
  status: 'active' | 'archived';
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function parseContactListQuery(
  params: ContactListSearchParams
): ContactListQuery {
  const search =
    typeof params.q === 'string' ? params.q.trim().replace(/\s+/g, ' ') : '';
  const tags = Array.isArray(params.tag)
    ? params.tag
    : typeof params.tag === 'string'
      ? [params.tag]
      : [];
  const page =
    typeof params.page === 'string' && /^\d+$/.test(params.page)
      ? Number(params.page)
      : 1;

  return {
    search,
    tagIds: [
      ...new Set(
        tags.map((tag) => tag.toLowerCase()).filter((tag) => UUID.test(tag))
      ),
    ],
    page:
      Number.isSafeInteger(page) && page > 0 && page <= 2_147_483_647
        ? page
        : 1,
    status: params.status === 'archived' ? 'archived' : 'active',
  };
}
