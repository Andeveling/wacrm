import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({ sendTextMessage: vi.fn() }));

vi.mock('@/lib/whatsapp/meta-api', () => ({
  sendTextMessage: h.sendTextMessage,
  sendTemplateMessage: vi.fn(),
}));
vi.mock('@/lib/whatsapp/encryption', () => ({ decrypt: () => 'token' }));
vi.mock('./admin-client', () => ({
  supabaseAdmin: () => ({
    from: () => {
      const query = {
        select: () => query,
        eq: () => query,
        single: () =>
          Promise.resolve({
            data: {
              id: 'contact-1',
              phone: '+15551234567',
              archived_at: '2026-07-20T00:00:00Z',
            },
            error: null,
          }),
        maybeSingle: () =>
          Promise.resolve({
            data: {
              id: 'contact-1',
              phone: '+15551234567',
              archived_at: '2026-07-20T00:00:00Z',
            },
            error: null,
          }),
      };
      return query;
    },
  }),
}));

import { engineSendText } from './meta-send';

beforeEach(() => h.sendTextMessage.mockReset());

describe('engineSendText', () => {
  it('blocks an automation send to an archived contact before Meta', async () => {
    await expect(
      engineSendText({
        accountId: 'acct-1',
        userId: 'user-1',
        conversationId: 'conv-1',
        contactId: 'contact-1',
        text: 'Hello',
      })
    ).rejects.toMatchObject({ code: 'contact_archived', status: 409 });

    expect(h.sendTextMessage).not.toHaveBeenCalled();
  });
});
