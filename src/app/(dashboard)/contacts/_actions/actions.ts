'use server';

import { revalidatePath } from 'next/cache';
import { requireRole } from '@/lib/auth/account';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function updateContactLifecycle(action: 'archive' | 'restore', ids: string[]): Promise<{ ok: boolean }> {
  try {
    const { supabase } = await requireRole('agent');
    if (ids.length === 0 || !ids.every((id) => UUID.test(id))) return { ok: false };

    const { error } = await Promise.all(ids.map((p_contact_id) => supabase.rpc(`${action}_contact`, { p_contact_id }))).then(
      (results) => results.find((result) => result.error) ?? { error: null }
    );

    if (error) return { ok: false };
    revalidatePath('/contacts');
    return { ok: true };
  } catch {
    return { ok: false };
  }
}
