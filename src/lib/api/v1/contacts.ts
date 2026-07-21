// ============================================================
// Shared contact logic for the public API (v1) contact endpoints.
//
// Kept out of the route files so `GET/POST /api/v1/contacts` and
// `GET/PATCH /api/v1/contacts/{id}` share one serializer, one
// find-or-create (built on the same `findExistingContact` dedupe the
// webhook and send path use), and one tag-sync routine.
// ============================================================

import type { SupabaseClient } from '@supabase/supabase-js';

import { ContactIdentityError, type ContactIdentityStatus, resolveContactIdentity } from '@/lib/contacts/resolve-identity';
import { resolveImportTagIds } from '@/lib/contacts/resolve-import-tags';
import { addContactTagAndDispatch } from '@/lib/contacts/tag-events';
import { isValidE164, sanitizePhoneForMeta } from '@/lib/whatsapp/phone-utils';

/** Row select that embeds the contact's tags for serialization. */
export const CONTACT_SELECT = '*, contact_tags(tags(*))';

export interface ApiContact {
  id: string;
  phone: string;
  name: string | null;
  email: string | null;
  company: string | null;
  avatar_url: string | null;
  tags: { id: string; name: string; color: string }[];
  created_at: string;
  updated_at: string;
  archived_at: string | null;
}

/** Thrown by the helpers below; routes map `.status`/`.message`. */
export class ContactError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'ContactError';
    this.status = status;
  }
}

type RawTagJoin = { tags: { id: string; name: string; color: string } | null };

/** Flatten a `CONTACT_SELECT` row into the public contact shape. */
export function serializeContact(row: Record<string, unknown>): ApiContact {
  const joins = (row.contact_tags as RawTagJoin[] | undefined) ?? [];
  return {
    id: row.id as string,
    phone: row.phone as string,
    name: (row.name as string | null) ?? null,
    email: (row.email as string | null) ?? null,
    company: (row.company as string | null) ?? null,
    avatar_url: (row.avatar_url as string | null) ?? null,
    tags: joins
      .map((j) => j.tags)
      .filter((t): t is NonNullable<RawTagJoin['tags']> => t != null)
      .map((t) => ({ id: t.id, name: t.name, color: t.color })),
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
    archived_at: (row.archived_at as string | null) ?? null,
  };
}

/**
 * Resolve the audit `user_id` for API-created rows — the SINGLE source
 * of truth used by every public-API write (contacts, messages,
 * broadcasts, resolve-conversation), so the same key's writes are
 * always attributed to the same human. API callers have no logged-in
 * user, so — like the inbound webhook — we attribute writes to the
 * **WhatsApp config owner** (the webhook's own convention). Contacts
 * can be created before WhatsApp is connected, so we fall back to the
 * account owner when there's no config yet.
 */
export async function resolveAuditUserId(db: SupabaseClient, accountId: string): Promise<string> {
  const { data: config } = await db.from('whatsapp_config').select('user_id').eq('account_id', accountId).maybeSingle();
  const configOwner = config?.user_id as string | undefined;
  if (configOwner) return configOwner;

  const { data: account } = await db.from('accounts').select('owner_user_id').eq('id', accountId).maybeSingle();
  const owner = account?.owner_user_id as string | undefined;
  if (!owner) {
    throw new ContactError('Account owner could not be resolved', 500);
  }
  return owner;
}

export interface ContactInput {
  phone: string;
  name?: string | null;
  email?: string | null;
  company?: string | null;
}

/**
 * Find (by fuzzy phone match) or create a contact in `accountId`.
 * Returns the contact id and whether it was created. Reuses the shared
 * `findExistingContact` dedupe + unique-violation race backstop so an
 * API-created contact is indistinguishable from a webhook-created one.
 */
export async function findOrCreateContact(
  db: SupabaseClient,
  accountId: string,
  auditUserId: string,
  input: ContactInput
): Promise<{ id: string; created: boolean; status: ContactIdentityStatus }> {
  const sanitized = sanitizePhoneForMeta(input.phone);
  if (!isValidE164(sanitized)) {
    throw new ContactError("'phone' must be a valid phone number in E.164 format (e.g. +14155550123)", 400);
  }

  try {
    const result = await resolveContactIdentity(db, {
      accountId,
      auditUserId,
      phone: sanitized,
      intent: 'restore',
      name: input.name,
      email: input.email,
      company: input.company,
    });
    if (!result) throw new ContactIdentityError('Failed to resolve contact');
    return {
      id: result.contact.id,
      created: result.status === 'created',
      status: result.status,
    };
  } catch (error) {
    console.error('[api/v1/contacts] create error:', error);
    throw new ContactError('Failed to create contact', 500);
  }
}

/**
 * Replace a contact's tags to exactly match `tagNames` (case-
 * insensitive; missing tags are created). A no-op when `tagNames` is
 * undefined — pass `[]` to clear all tags. Reuses `resolveImportTagIds`
 * so API and CSV-import tag handling stay consistent.
 */
export async function setContactTags(
  db: SupabaseClient,
  accountId: string,
  auditUserId: string,
  contactId: string,
  tagNames: string[],
  mode: 'replace' | 'add' = 'replace'
): Promise<void> {
  const { tagIdByKey } = await resolveImportTagIds(db, {
    accountId,
    userId: auditUserId,
    tagNames,
    canCreateTags: true,
  });
  const desired = new Set(tagIdByKey.values());

  // Diff against the current joins rather than delete-all-then-insert:
  // a diff only touches tags that actually change, so a mid-operation
  // failure can never wipe tags that were meant to stay. Every write
  // is error-checked and surfaced as a ContactError (→ 500) instead of
  // being swallowed behind a misleading 200.
  const { data: current, error: readErr } = await db.from('contact_tags').select('tag_id').eq('contact_id', contactId);
  if (readErr) {
    throw new ContactError('Failed to read contact tags', 500);
  }
  const existing = new Set((current ?? []).map((r) => r.tag_id as string));

  const toAdd = [...desired].filter((id) => !existing.has(id));
  const toRemove = mode === 'replace' ? [...existing].filter((id) => !desired.has(id)) : [];

  if (toRemove.length > 0) {
    const { error } = await db.from('contact_tags').delete().eq('contact_id', contactId).in('tag_id', toRemove);
    if (error) throw new ContactError('Failed to update contact tags', 500);
  }
  if (toAdd.length > 0) {
    for (const tagId of toAdd) {
      try {
        await addContactTagAndDispatch({
          db,
          accountId,
          contactId,
          tagId,
        });
      } catch (error) {
        console.error('[api/v1/contacts] tag add failed:', error);
        throw new ContactError('Failed to update contact tags', 500);
      }
    }
  }
}

/** Fetch + serialize a single contact scoped to the account, or null. */
export async function getContactById(db: SupabaseClient, accountId: string, contactId: string): Promise<ApiContact | null> {
  const { data, error } = await db.from('contacts').select(CONTACT_SELECT).eq('id', contactId).eq('account_id', accountId).maybeSingle();
  if (error || !data) return null;
  return serializeContact(data as Record<string, unknown>);
}
