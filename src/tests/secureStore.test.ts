jest.mock('expo-crypto', () => {
  const crypto = require('crypto');
  return {
    digestStringAsync: jest.fn(async (_algo: string, input: string) =>
      crypto.createHash('sha256').update(input).digest('hex'),
    ),
    CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
  };
});

import { hashPin } from '@/lib/secureStore';

describe('hashPin', () => {
  it('is deterministic for same salt and pin', async () => {
    const a = await hashPin('1234', 'salt-a');
    const b = await hashPin('1234', 'salt-a');
    expect(a).toBe(b);
  });

  it('differs when salt changes', async () => {
    const a = await hashPin('1234', 'salt-a');
    const b = await hashPin('1234', 'salt-b');
    expect(a).not.toBe(b);
  });
});
