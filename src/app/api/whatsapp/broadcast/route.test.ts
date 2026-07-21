import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  completeBroadcastRecipient: vi.fn(),
  createClient: vi.fn(),
  getDeliverableRecipientPhone: vi.fn(),
  sendTemplateMessage: vi.fn(),
}));

vi.mock('@/lib/rate-limit', () => ({
  RATE_LIMITS: { broadcast: {} },
  checkRateLimit: () => ({ success: true }),
  rateLimitResponse: vi.fn(),
}));
vi.mock('@/lib/supabase/server', () => ({ createClient: mocks.createClient }));
vi.mock('@/lib/whatsapp/broadcast-core', () => ({
  completeBroadcastRecipient: mocks.completeBroadcastRecipient,
  getDeliverableRecipientPhone: mocks.getDeliverableRecipientPhone,
}));
vi.mock('@/lib/whatsapp/encryption', () => ({ decrypt: (value: string) => value }));
vi.mock('@/lib/whatsapp/meta-api', () => ({ sendTemplateMessage: mocks.sendTemplateMessage }));

import { POST } from './route';

describe('legacy broadcast route lifecycle safety', () => {
  beforeEach(() => {
    const profileQuery = { select: vi.fn(), eq: vi.fn(), maybeSingle: vi.fn().mockResolvedValue({ data: { account_id: 'account' } }) };
    profileQuery.select.mockReturnValue(profileQuery);
    profileQuery.eq.mockReturnValue(profileQuery);
    const configQuery = {
      select: vi.fn(),
      eq: vi.fn(),
      single: vi.fn().mockResolvedValue({ data: { access_token: 'token', phone_number_id: 'phone-number' }, error: null }),
    };
    configQuery.select.mockReturnValue(configQuery);
    configQuery.eq.mockReturnValue(configQuery);
    const templateQuery = { select: vi.fn(), eq: vi.fn(), maybeSingle: vi.fn().mockResolvedValue({ data: null }) };
    templateQuery.select.mockReturnValue(templateQuery);
    templateQuery.eq.mockReturnValue(templateQuery);
    mocks.createClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user' } }, error: null }) },
      from: (table: string) => {
        if (table === 'profiles') return profileQuery;
        if (table === 'whatsapp_config') return configQuery;
        return templateQuery;
      },
    });
  });

  it('does not call Meta for a second variant after the recipient is archived', async () => {
    mocks.getDeliverableRecipientPhone
      .mockResolvedValueOnce('14155550123')
      .mockResolvedValueOnce('14155550123')
      .mockResolvedValueOnce(null);
    mocks.sendTemplateMessage.mockRejectedValueOnce(new Error('131030: recipient not in allowed list'));

    const response = await POST(
      new Request('https://crm.test/api/whatsapp/broadcast', {
        method: 'POST',
        body: JSON.stringify({ recipients: [{ recipient_id: 'recipient', phone: '14155550123' }], template_name: 'promo' }),
      })
    );

    expect(mocks.sendTemplateMessage).toHaveBeenCalledOnce();
    expect(await response.json()).toMatchObject({
      sent: 0,
      failed: 0,
      results: [{ recipient_id: 'recipient', status: 'cancelled' }],
    });
  });
});
