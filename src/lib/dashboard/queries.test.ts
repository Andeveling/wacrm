import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';
import { loadMetrics } from './queries';

interface QueryCall {
  table: string;
  select?: string;
  filters: Array<[string, string, unknown]>;
}

function metricsDb() {
  const calls: QueryCall[] = [];
  const responses = [3, 2, 1, 4, 5];

  const db = {
    from(table: string) {
      const call: QueryCall = { table, filters: [] };
      calls.push(call);
      const result = {
        data: table === 'deals' ? [{ value: 10, status: 'open' }] : null,
        count: responses.shift() ?? 0,
      };
      const query = {
        select(columns: string) {
          call.select = columns;
          return query;
        },
        eq(column: string, value: unknown) {
          call.filters.push(['eq', column, value]);
          return query;
        },
        is(column: string, value: unknown) {
          call.filters.push(['is', column, value]);
          return query;
        },
        gte(column: string, value: unknown) {
          call.filters.push(['gte', column, value]);
          return query;
        },
        lt(column: string, value: unknown) {
          call.filters.push(['lt', column, value]);
          return query;
        },
        // biome-ignore lint/suspicious/noThenProperty: Supabase builders are awaitable.
        then(resolve: (value: typeof result) => void) {
          return Promise.resolve(result).then(resolve);
        },
      };
      return query;
    },
  } as unknown as SupabaseClient;

  return { db, calls };
}

describe('loadMetrics', () => {
  it('excludes archived contacts from operational counts but retains creation metrics', async () => {
    const { db, calls } = metricsDb();

    await loadMetrics(db);

    const conversations = calls.filter(
      (call) => call.table === 'conversations'
    );
    expect(conversations).toHaveLength(3);
    for (const query of conversations) {
      expect(query.select).toContain('contacts!inner');
      expect(query.filters).toContainEqual([
        'is',
        'contacts.archived_at',
        null,
      ]);
    }

    const contacts = calls.filter((call) => call.table === 'contacts');
    expect(contacts).toHaveLength(2);
    expect(contacts.flatMap((query) => query.filters)).not.toContainEqual([
      'is',
      'archived_at',
      null,
    ]);
  });
});
