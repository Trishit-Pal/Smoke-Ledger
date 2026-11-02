const insert = jest.fn().mockResolvedValue({ error: null });
const supabase = {
  auth: {
    getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'u-1' } } }),
  },
  from: jest.fn(() => ({ insert })),
};
jest.mock('@/lib/supabase', () => ({ getSupabase: () => supabase }));

import { logClientError } from '@/lib/logger';

describe('logClientError redaction', () => {
  beforeEach(() => insert.mockClear());

  it('redacts personal data from message, route and details before insert', async () => {
    await logClientError(new Error('save failed for jane@example.com phone 9876543210'), {
      route: '/goals/1234567/edit?email=jane@example.com',
      requestId: 'req-1',
      category: 'web.save',
    });
    const row = insert.mock.calls[0][0];
    expect(row.message).toBe('save failed for [email] phone [phone]');
    expect(row.route).toBe('/goals/:id/edit');
    expect(row.details_json.route).toBe('/goals/:id/edit');
    expect(JSON.stringify(row)).not.toMatch(/jane@|9876543210|1234567|\?/);
  });

  it('redacts non-Error values and keeps the message bounded', async () => {
    await logClientError(`${'y'.repeat(600)} a@b.com`);
    const row = insert.mock.calls[0][0];
    expect(row.message.length).toBeLessThanOrEqual(500);
    expect(row.route).toBeNull();
  });

  it('never throws even when the error stringifies badly', async () => {
    const bad = {
      toString: () => {
        throw new Error('boom');
      },
    };
    await expect(logClientError(bad)).resolves.toBeUndefined();
  });
});
