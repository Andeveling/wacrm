import { getContactById } from '@/lib/api/v1/contacts';
import { fail, ok, toApiErrorResponse } from '@/lib/api/v1/respond';
import { requireApiKey } from '@/lib/auth/api-context';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireApiKey(request, 'contacts:write');
    const { id } = await params;
    if (!(await getContactById(ctx.supabase, ctx.accountId, id))) {
      return fail('not_found', 'Contact not found', 404);
    }
    const { error } = await ctx.supabase.rpc('restore_contact', {
      p_contact_id: id,
      p_account_id: ctx.accountId,
    });
    if (error) return fail('internal', 'Failed to restore contact', 500);
    return ok({ id, restored: true });
  } catch (err) {
    return toApiErrorResponse(err);
  }
}
