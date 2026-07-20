import type { SupabaseClient } from '@supabase/supabase-js';

import { isUniqueViolation, normalizeKey } from './dedupe';

export type ContactIdentityIntent = 'restore' | 'outbound';
export type ContactIdentityStatus = 'created' | 'existing' | 'restored';

export interface ContactIdentity {
  id: string;
  phone: string;
  archived_at: string | null;
  name?: string | null;
  email?: string | null;
  company?: string | null;
  [key: string]: unknown;
}

export interface ResolveContactIdentityInput {
  accountId: string;
  auditUserId: string;
  phone: string;
  intent: ContactIdentityIntent;
  name?: string | null;
  email?: string | null;
  company?: string | null;
  tagIds?: string[];
}

export interface ContactIdentityResult {
  status: ContactIdentityStatus;
  contact: ContactIdentity;
}

export class ContactIdentityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ContactIdentityError';
  }
}

export async function resolveContactIdentity(
  db: SupabaseClient,
  input: ResolveContactIdentityInput
): Promise<ContactIdentityResult | null> {
  const phoneNormalized = normalizeKey(input.phone);
  if (!phoneNormalized) throw new ContactIdentityError('Phone is required');

  const resolveExisting = async (): Promise<
    ContactIdentityResult | null | undefined
  > => {
    const { data, error } = await db
      .from('contacts')
      .select('*')
      .eq('account_id', input.accountId)
      .eq('phone_normalized', phoneNormalized)
      .maybeSingle();

    if (error) throw new ContactIdentityError('Failed to resolve contact');
    if (!data) return undefined;

    const contact = data as ContactIdentity;
    if (!contact.archived_at) {
      await addTags(db, contact.id, input.tagIds);
      return { status: 'existing', contact };
    }
    if (input.intent === 'outbound') return null;

    const fields = Object.fromEntries(
      (['name', 'email', 'company'] as const)
        .map((key) => [key, input[key]])
        .filter(([, value]) => typeof value === 'string' && value.trim() !== '')
    );
    const changes = { archived_at: null, ...fields };
    const { error: restoreError } = await db
      .from('contacts')
      .update(changes)
      .eq('id', contact.id)
      .eq('account_id', input.accountId);
    if (restoreError)
      throw new ContactIdentityError('Failed to restore contact');

    await addTags(db, contact.id, input.tagIds);
    return {
      status: 'restored',
      contact: { ...contact, ...changes },
    };
  };

  const existing = await resolveExisting();
  if (existing !== undefined) return existing;

  const { data: created, error } = await db
    .from('contacts')
    .insert({
      account_id: input.accountId,
      user_id: input.auditUserId,
      phone: input.phone,
      name: nonEmpty(input.name) ?? input.phone,
      email: nonEmpty(input.email) ?? null,
      company: nonEmpty(input.company) ?? null,
    })
    .select('*')
    .single();

  if (error || !created) {
    if (isUniqueViolation(error)) {
      const raced = await resolveExisting();
      if (raced !== undefined) return raced;
    }
    throw new ContactIdentityError('Failed to create contact');
  }

  const contact = created as ContactIdentity;
  await addTags(db, contact.id, input.tagIds);
  return { status: 'created', contact };
}

function nonEmpty(value: string | null | undefined): string | undefined {
  return typeof value === 'string' && value.trim() !== '' ? value : undefined;
}

async function addTags(
  db: SupabaseClient,
  contactId: string,
  tagIds: string[] | undefined
): Promise<void> {
  for (const tagId of new Set(tagIds ?? [])) {
    const { error } = await db
      .from('contact_tags')
      .insert({ contact_id: contactId, tag_id: tagId });
    if (error && !isUniqueViolation(error)) {
      throw new ContactIdentityError('Failed to add contact tag');
    }
  }
}
