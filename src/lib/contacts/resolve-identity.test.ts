import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';

import { resolveBroadcastCsvContacts, resolveContactIdentity } from './resolve-identity';

type Contact = {
  id: string;
  phone: string;
  archived_at: string | null;
  name?: string | null;
  email?: string | null;
  company?: string | null;
};

function makeDb(options: { contacts?: (Contact | null)[]; created?: Contact | null; createError?: { code: string } | null }) {
  const contacts = [...(options.contacts ?? [null])];
  const inserts: Record<string, unknown>[] = [];
  const updates: Record<string, unknown>[] = [];
  const tags: Record<string, unknown>[] = [];
  let table = '';
  let operation: 'select' | 'insert' | 'update' = 'select';
  let payload: Record<string, unknown> = {};

  const builder: Record<string, unknown> = {
    select: () => builder,
    eq: () => builder,
    maybeSingle: () => Promise.resolve({ data: contacts.shift() ?? null, error: null }),
    insert: (value: Record<string, unknown>) => {
      operation = 'insert';
      payload = value;
      if (table === 'contacts') inserts.push(value);
      if (table === 'contact_tags') tags.push(value);
      return builder;
    },
    update: (value: Record<string, unknown>) => {
      operation = 'update';
      payload = value;
      updates.push(value);
      return builder;
    },
    single: () =>
      Promise.resolve({
        data: operation === 'insert' ? (options.created ?? null) : null,
        error: operation === 'insert' ? (options.createError ?? null) : null,
      }),
    // biome-ignore lint/suspicious/noThenProperty: Supabase builders are thenable.
    then: (resolve: (value: { data: unknown; error: null }) => void) =>
      resolve({
        data: operation === 'update' ? { ...payload } : null,
        error: null,
      }),
  };

  return {
    db: {
      from(name: string) {
        table = name;
        operation = 'select';
        return builder;
      },
    } as unknown as SupabaseClient,
    inserts,
    updates,
    tags,
  };
}

const base = {
  accountId: 'account-1',
  auditUserId: 'user-1',
  phone: '+1 (415) 555-0123',
  intent: 'restore' as const,
};

describe('resolveContactIdentity', () => {
  it('distinguishes created and existing identities', async () => {
    const created = {
      id: 'new',
      phone: '+14155550123',
      archived_at: null,
    };
    const createDb = makeDb({ created });
    await expect(resolveContactIdentity(createDb.db, base)).resolves.toEqual({
      status: 'created',
      contact: created,
    });

    const existing = { ...created, id: 'existing' };
    const existingDb = makeDb({ contacts: [existing] });
    await expect(resolveContactIdentity(existingDb.db, base)).resolves.toEqual({
      status: 'existing',
      contact: existing,
    });
  });

  it('restores and merges only non-empty values', async () => {
    const archived = {
      id: 'archived',
      phone: '+14155550123',
      archived_at: '2026-01-01',
      name: 'Old name',
      email: 'old@example.com',
      company: null,
    };
    const { db, inserts, updates } = makeDb({ contacts: [archived] });

    const result = await resolveContactIdentity(db, {
      ...base,
      name: ' ',
      email: 'new@example.com',
      company: 'Acme',
    });

    expect(result?.status).toBe('restored');
    expect(inserts).toEqual([]);
    expect(updates).toEqual([
      {
        archived_at: null,
        email: 'new@example.com',
        company: 'Acme',
      },
    ]);
    expect(result?.contact).toMatchObject({
      name: 'Old name',
      email: 'new@example.com',
      company: 'Acme',
      archived_at: null,
    });
  });

  it('adds incoming tags without deleting existing tags', async () => {
    const archived = {
      id: 'archived',
      phone: '+14155550123',
      archived_at: '2026-01-01',
    };
    const { db, tags } = makeDb({ contacts: [archived] });

    await resolveContactIdentity(db, { ...base, tagIds: ['tag-1', 'tag-2'] });

    expect(tags).toEqual([
      { contact_id: 'archived', tag_id: 'tag-1' },
      { contact_id: 'archived', tag_id: 'tag-2' },
    ]);
  });

  it('adds incoming tags to an existing identity without changing its fields', async () => {
    const existing = {
      id: 'existing',
      phone: '+14155550123',
      archived_at: null,
      name: 'Keep me',
    };
    const { db, tags, updates } = makeDb({ contacts: [existing] });

    await expect(resolveContactIdentity(db, { ...base, name: '', tagIds: ['tag-1'] })).resolves.toEqual({
      status: 'existing',
      contact: existing,
    });

    expect(updates).toEqual([]);
    expect(tags).toEqual([{ contact_id: 'existing', tag_id: 'tag-1' }]);
  });

  it('re-resolves a uniqueness race and applies restoration policy', async () => {
    const archived = {
      id: 'winner',
      phone: '+14155550123',
      archived_at: '2026-01-01',
      name: null,
    };
    const { db, updates } = makeDb({
      contacts: [null, archived],
      createError: { code: '23505' },
    });

    const result = await resolveContactIdentity(db, { ...base, name: 'Jane' });

    expect(result?.status).toBe('restored');
    expect(updates).toEqual([{ archived_at: null, name: 'Jane' }]);
  });

  it('does not restore archived identities for outbound callers', async () => {
    const archived = {
      id: 'archived',
      phone: '+14155550123',
      archived_at: '2026-01-01',
    };
    const { db, updates } = makeDb({ contacts: [archived] });

    await expect(resolveContactIdentity(db, { ...base, intent: 'outbound' })).resolves.toBeNull();
    expect(updates).toEqual([]);
  });

  it('excludes archived CSV identities without restoring them', async () => {
    const archived = {
      id: 'archived',
      phone: '+14155550123',
      archived_at: '2026-01-01',
    };
    const created = {
      id: 'new',
      phone: '+14155550124',
      archived_at: null,
    };
    const { db, updates } = makeDb({ contacts: [archived, null], created });

    await expect(
      resolveBroadcastCsvContacts(db, {
        accountId: base.accountId,
        auditUserId: base.auditUserId,
        rows: [{ phone: archived.phone }, { phone: archived.phone }, { phone: created.phone, name: 'New contact' }],
      })
    ).resolves.toMatchObject({
      archivedRowsExcluded: 2,
      contacts: [created],
    });
    expect(updates).toEqual([]);
  });

  it('deduplicates repeated broadcast CSV phone numbers', async () => {
    const active = {
      id: 'active',
      phone: '+14155550123',
      archived_at: null,
    };
    const { db, inserts, updates } = makeDb({ contacts: [active] });

    await expect(
      resolveBroadcastCsvContacts(db, {
        accountId: base.accountId,
        auditUserId: base.auditUserId,
        rows: [{ phone: '+1 (415) 555-0123' }, { phone: active.phone }],
      })
    ).resolves.toEqual({ archivedRowsExcluded: 0, contacts: [active] });

    expect(inserts).toEqual([]);
    expect(updates).toEqual([]);
  });

  it('creates one contact for two formats of the same new CSV phone', async () => {
    const created = {
      id: 'new',
      phone: '+14155550123',
      archived_at: null,
    };
    const { db, inserts } = makeDb({ contacts: [null], created });

    await expect(
      resolveBroadcastCsvContacts(db, {
        accountId: base.accountId,
        auditUserId: base.auditUserId,
        rows: [{ phone: '+1 (415) 555-0123' }, { phone: '14155550123' }],
      })
    ).resolves.toEqual({ archivedRowsExcluded: 0, contacts: [created] });

    expect(inserts).toHaveLength(1);
  });
});
