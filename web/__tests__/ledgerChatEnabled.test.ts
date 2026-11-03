import { afterEach, describe, expect, it, vi } from 'vitest';
import { isLedgerChatEnabled } from '@web/lib/server/ledgerChat/enabled';

const OLD_PRIVACY = '2026-11-02';
const NEW_PRIVACY = '2026-11-03';

function stub(flag: string | undefined, vercelEnv: string | undefined) {
  vi.stubEnv('LEDGER_CHAT_ENABLED', flag as string);
  vi.stubEnv('VERCEL_ENV', vercelEnv as string);
}

describe('isLedgerChatEnabled release gate', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('is off in Production while the privacy policy is the undisclosed version', () => {
    stub('true', 'production');
    expect(isLedgerChatEnabled(OLD_PRIVACY)).toBe(false);
  });

  it('is on in Production once the privacy policy is newer', () => {
    stub('true', 'production');
    expect(isLedgerChatEnabled(NEW_PRIVACY)).toBe(true);
  });

  it('is on in Preview with the old policy so the owner can test first', () => {
    stub('true', 'preview');
    expect(isLedgerChatEnabled(OLD_PRIVACY)).toBe(true);
  });

  it('is on where VERCEL_ENV is unset (CI, next dev)', () => {
    stub('true', undefined);
    delete process.env.VERCEL_ENV;
    expect(isLedgerChatEnabled(OLD_PRIVACY)).toBe(true);
  });

  it('is off when the flag is not exactly "true", whatever the environment', () => {
    for (const env of ['production', 'preview', undefined]) {
      stub('false', env);
      expect(isLedgerChatEnabled(NEW_PRIVACY)).toBe(false);
    }
  });

  it('defaults to the shipped privacy version', () => {
    stub('true', 'production');
    // LEGAL_VERSIONS.privacy is still 2026-11-02 until the owner names the EU representative.
    expect(isLedgerChatEnabled()).toBe(false);
  });
});
