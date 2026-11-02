import { EXPORT_SCHEMA_VERSION, ImportEnvelopeSchema } from '@/lib/validation';

const base = {
  exportedAt: '2026-01-01T00:00:00.000Z',
  profile: {
    baselinePerDay: 10,
    baselineWindowDays: 30,
    currency: 'INR' as const,
    discreetMode: false,
    appLockEnabled: false,
    hideTotalsOnHome: false,
    onboardedAt: null,
  },
  brands: [],
  logs: [],
  goals: [],
};

describe('ImportEnvelopeSchema versions', () => {
  it('exports version 3', () => {
    expect(EXPORT_SCHEMA_VERSION).toBe(3);
  });

  it('accepts a v2 envelope (older exports still import)', () => {
    expect(ImportEnvelopeSchema.safeParse({ ...base, version: 2 }).success).toBe(true);
  });

  it('accepts a v3 envelope with the account block and error events', () => {
    const r = ImportEnvelopeSchema.safeParse({
      ...base,
      version: 3,
      account: {
        email: 'a@example.com',
        phone: null,
        createdAt: '2026-01-01T00:00:00.000Z',
        lastSignInAt: null,
      },
      errorEvents: [
        { category: 'x', message: 'boom', route: null, createdAt: '2026-01-02T00:00:00.000Z' },
      ],
    });
    expect(r.success).toBe(true);
  });

  it('accepts a v3 envelope without the new fields', () => {
    expect(ImportEnvelopeSchema.safeParse({ ...base, version: 3 }).success).toBe(true);
  });

  it('rejects unknown versions', () => {
    expect(ImportEnvelopeSchema.safeParse({ ...base, version: 1 }).success).toBe(false);
    expect(ImportEnvelopeSchema.safeParse({ ...base, version: 4 }).success).toBe(false);
  });
});
