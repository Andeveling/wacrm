'use server';

import { revalidatePath } from 'next/cache';
import { requireRole } from '@/lib/auth/account';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function updateContactLifecycle(action: 'archive' | 'restore', ids: string[]): Promise<{ ok: boolean; failedIds?: string[] }> {
  try {
    const { supabase } = await requireRole('agent');
    const contactIds = [...new Set(ids)];
    if (contactIds.length === 0 || !contactIds.every((id) => UUID.test(id))) return { ok: false };

    const failedIds = (
      await Promise.all(
        contactIds.map(async (p_contact_id) => {
          try {
            const { error } = await supabase.rpc(`${action}_contact`, { p_contact_id });
            return error ? p_contact_id : null;
          } catch {
            return p_contact_id;
          }
        })
      )
    ).filter((id): id is string => id !== null);

    if (failedIds.length > 0) {
      if (failedIds.length < contactIds.length) revalidatePath('/contacts');
      return { ok: false, failedIds };
    }
    revalidatePath('/contacts');
    return { ok: true };
  } catch {
    return { ok: false };
  }
}
