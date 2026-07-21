import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';
import { BroadcastError, type BroadcastPlan, completeBroadcastRecipient, createBroadcast, deliverBroadcast } from './broadcast-core';

const { sendTemplateMessage } = vi.hoisted(() => ({
  sendTemplateMessage: vi.fn(),
}));

vi.mock('@/lib/whatsapp/meta-api', () => ({ sendTemplateMessage }));

// These assertions all fire in the pure validation prologue, before
// any Supabase call — a bare stub is enough.
const db = {} as SupabaseClient;

describe('createBroadcast validation', () => {
  it('rejects a missing template_name', async () => {
    await expect(
      createBroadcast(db, 'acc', 'user', {
        templateName: '',
        recipients: [{ to: '+14155550123' }],
      })
    ).rejects.toMatchObject({ code: 'bad_request', status: 400 });
  });

  it('rejects an empty recipient list', async () => {
    await expect(
      createBroadcast(db, 'acc', 'user', {
        templateName: 'promo',
        recipients: [],
      })
    ).rejects.toBeInstanceOf(BroadcastError);
  });

  it('rejects more than 1000 recipients', async () => {
    const recipients = Array.from({ length: 1001 }, () => ({
      to: '+14155550123',
    }));
    await expect(createBroadcast(db, 'acc', 'user', { templateName: 'promo', recipients })).rejects.toMatchObject({ status: 400 });
  });
});

describe('deliverBroadcast lifecycle safety', () => {
  it('does not call Meta when archival cancelled the pending recipient', async () => {
    const recipientQuery = {
      select: vi.fn(),
      eq: vi.fn(),
      is: vi.fn(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null }),
    };
    recipientQuery.select.mockReturnValue(recipientQuery);
    recipientQuery.eq.mockReturnValue(recipientQuery);
    recipientQuery.is.mockReturnValue(recipientQuery);
    const broadcastQuery = { update: vi.fn(), eq: vi.fn() };
    broadcastQuery.update.mockReturnValue(broadcastQuery);
    broadcastQuery.eq.mockReturnValue(broadcastQuery);
    const db = {
      from: vi.fn((table: string) => (table === 'broadcast_recipients' ? recipientQuery : broadcastQuery)),
    } as unknown as SupabaseClient;
    const plan: BroadcastPlan = {
      broadcastId: 'broadcast',
      templateName: 'promo',
      templateLanguage: 'en_US',
      phoneNumberId: 'phone-number',
      accessToken: 'token',
      templateRow: null,
      planned: [{ recipientRowId: 'recipient', params: [] }],
      rejected: 0,
    };

    await deliverBroadcast(db, plan);

    expect(sendTemplateMessage).not.toHaveBeenCalled();
  });

  it('does not treat a cancelled recipient as a completed send', async () => {
    const query = {
      update: vi.fn(),
      eq: vi.fn(),
      select: vi.fn(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null }),
    };
    query.update.mockReturnValue(query);
    query.eq.mockReturnValue(query);
    query.select.mockReturnValue(query);
    const db = { from: vi.fn(() => query) } as unknown as SupabaseClient;

    await expect(
      completeBroadcastRecipient(db, 'recipient', {
        status: 'sent',
        whatsappMessageId: 'wamid',
      })
    ).resolves.toBe(false);
    expect(query.eq).toHaveBeenCalledWith('status', 'pending');
  });
});
