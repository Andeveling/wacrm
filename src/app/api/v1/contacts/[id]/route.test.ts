import { beforeEach, describe, expect, it, vi } from 'vitest';

const { requireApiKey, getContactById, rpc } = vi.hoisted(() => ({
  requireApiKey: vi.fn(),
  getContactById: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock('@/lib/auth/api-context', () => ({ requireApiKey }));
vi.mock('@/lib/api/v1/contacts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/api/v1/contacts')>()),
  getContactById,
}));

import { POST } from './restore/route';
import { DELETE, PATCH } from './route';

const params = { params: Promise.resolve({ id: 'contact-1' }) };

describe('public contact lifecycle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireApiKey.mockResolvedValue({ accountId: 'account-1', supabase: { rpc } });
    getContactById.mockResolvedValue({ id: 'contact-1', archived_at: null });
    rpc.mockResolvedValue({ error: null });
  });

  it('archives and restores through the transactional lifecycle operations', async () => {
    const archived = await DELETE(new Request('https://crm.test'), params);
    const restored = await POST(new Request('https://crm.test'), params);

    expect(requireApiKey).toHaveBeenCalledWith(expect.any(Request), 'contacts:write');
    expect(rpc).toHaveBeenNthCalledWith(1, 'archive_contact', {
      p_contact_id: 'contact-1',
      p_account_id: 'account-1',
    });
    expect(rpc).toHaveBeenNthCalledWith(2, 'restore_contact', {
      p_contact_id: 'contact-1',
      p_account_id: 'account-1',
    });
    expect(await archived.json()).toEqual({ data: { id: 'contact-1', archived: true } });
    expect(await restored.json()).toEqual({ data: { id: 'contact-1', restored: true } });
  });

  it('rejects ordinary updates to archived contacts', async () => {
    getContactById.mockResolvedValue({ id: 'contact-1', archived_at: '2026-07-20T00:00:00Z' });

    const response = await PATCH(
      new Request('https://crm.test', {
        method: 'PATCH',
        body: JSON.stringify({ name: 'Changed' }),
      }),
      params
    );

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      error: { code: 'contact_archived', message: 'Archived contacts must be restored before updating' },
    });
  });
});
