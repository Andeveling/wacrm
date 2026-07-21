import { beforeEach, describe, expect, it, vi } from 'vitest';

const { requireRole, rpc } = vi.hoisted(() => ({
  requireRole: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock('@/lib/auth/account', () => ({ requireRole }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

import { updateContactLifecycle } from './actions';

const contactId = '11111111-1111-4111-8111-111111111111';

describe('updateContactLifecycle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireRole.mockResolvedValue({ supabase: { rpc } });
    rpc.mockResolvedValue({ error: null });
  });

  it('validates IDs and authorizes before invoking the transactional operation', async () => {
    await expect(updateContactLifecycle('archive', ['not-a-uuid'])).resolves.toEqual({
      ok: false,
    });
    expect(requireRole).toHaveBeenCalledWith('agent');
    expect(rpc).not.toHaveBeenCalled();
  });

  it('archives every requested visible contact through the lifecycle RPC', async () => {
    await expect(updateContactLifecycle('archive', [contactId])).resolves.toEqual({ ok: true });
    expect(rpc).toHaveBeenCalledWith('archive_contact', {
      p_contact_id: contactId,
    });
  });

  it('does not expose authorization failures to the client', async () => {
    requireRole.mockRejectedValue(new Error('Insufficient role'));

    await expect(updateContactLifecycle('restore', [contactId])).resolves.toEqual({ ok: false });
    expect(rpc).not.toHaveBeenCalled();
  });
});
