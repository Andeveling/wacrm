import { beforeEach, describe, expect, it, vi } from 'vitest';

const { createClient, sendReactionMessage } = vi.hoisted(() => ({
  createClient: vi.fn(),
  sendReactionMessage: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({ createClient }));
vi.mock('@/lib/whatsapp/meta-api', () => ({ sendReactionMessage }));

import { POST } from './route';

function archivedContactDb() {
  const rows: Record<string, unknown> = {
    profiles: { account_id: 'account-1' },
    messages: {
      id: 'message-1',
      message_id: 'wamid-1',
      conversation_id: 'conversation-1',
    },
    conversations: {
      id: 'conversation-1',
      account_id: 'account-1',
      contact: { phone: '+15551234567', archived_at: '2026-07-20T00:00:00Z' },
    },
  };

  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: 'user-1' } },
        error: null,
      }),
    },
    from: vi.fn((table: string) => {
      const result = { data: rows[table] ?? null, error: null };
      const builder: Record<string, unknown> = {};
      for (const method of ['select', 'eq'])
        builder[method] = vi.fn(() => builder);
      builder.maybeSingle = vi.fn().mockResolvedValue(result);
      return builder;
    }),
  };
}

describe('POST /api/whatsapp/react', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createClient.mockResolvedValue(archivedContactDb());
  });

  it('does not call Meta for an archived contact', async () => {
    const response = await POST(
      new Request('http://localhost/api/whatsapp/react', {
        method: 'POST',
        body: JSON.stringify({ message_id: 'message-1', emoji: '👍' }),
      })
    );

    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ code: 'contact_archived' });
    expect(sendReactionMessage).not.toHaveBeenCalled();
  });
});
