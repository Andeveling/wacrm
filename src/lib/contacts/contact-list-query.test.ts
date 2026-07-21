import { describe, expect, it } from 'vitest';
import { parseContactListQuery } from './contact-list-query';

describe('parseContactListQuery', () => {
  it('canonicalizes search, repeated tags, page, and archived state', () => {
    expect(
      parseContactListQuery({
        q: '  Ada   Lovelace  ',
        tag: [
          'AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA',
          'not-a-uuid',
          'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        ],
        page: '3',
        status: 'archived',
      })
    ).toEqual({
      search: 'Ada Lovelace',
      tagIds: ['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'],
      page: 3,
      status: 'archived',
    });
  });

  it('discards invalid and non-scalar values', () => {
    expect(
      parseContactListQuery({
        q: ['ignored'],
        tag: ['bad'],
        page: '-2',
        status: ['archived'],
      })
    ).toEqual({ search: '', tagIds: [], page: 1, status: 'active' });
  });

  it('rejects non-decimal and out-of-range pages', () => {
    expect(parseContactListQuery({ page: '1e2' }).page).toBe(1);
    expect(parseContactListQuery({ page: '2147483648' }).page).toBe(1);
  });
});
