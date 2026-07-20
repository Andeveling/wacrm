import { beforeEach, describe, expect, it, vi } from 'vitest';

const { requireRole, rpc } = vi.hoisted(() => ({
  requireRole: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock('@/lib/auth/account', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/auth/account')>();
  return { ...actual, requireRole };
});

import { ForbiddenError } from '@/lib/auth/account';
import { POST } from './route';

describe('POST /api/contacts/:id/restore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireRole.mockResolvedValue({ supabase: { rpc } });
    rpc.mockResolvedValue({ error: null });
  });

  it('restores a contact for an agent', async () => {
    const response = await POST(new Request('http://localhost'), {
      params: Promise.resolve({ id: 'contact-1' }),
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(requireRole).toHaveBeenCalledWith('agent');
    expect(rpc).toHaveBeenCalledWith('restore_contact', {
      p_contact_id: 'contact-1',
    });
  });

  it('keeps viewers read-only', async () => {
    requireRole.mockRejectedValue(new ForbiddenError('Insufficient role'));

    const response = await POST(new Request('http://localhost'), {
      params: Promise.resolve({ id: 'contact-1' }),
    });

    expect(response.status).toBe(403);
    expect(rpc).not.toHaveBeenCalled();
  });
});
