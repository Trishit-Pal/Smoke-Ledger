import { afterEach, describe, expect, it, vi } from 'vitest';
import { isLedgerChatEnabled } from '@web/lib/server/ledgerChat/enabled';

const OLD_PRIVACY = '2026-11-02';
const NEW_PRIVACY = '2026-11-03';

/** Sets the variable, or removes it when undefined (stubEnv would store the string "undefined"). */
function setEnv(name: string, value: string | undefined) {
  if (value === undefined) {
    vi.stubEnv(name, '');
    delete process.env[name];
  } else {
    vi.stubEnv(name, value);
  }
}

function stub(flag: string | undefined, vercelEnv: string | undefined, nodeEnv = 'production') {
  setEnv('LEDGER_CHAT_ENABLED', flag);
  setEnv('VERCEL_ENV', vercelEnv);
  setEnv('NODE_ENV', nodeEnv);
}

describe('isLedgerChatEnabled release gate', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('is off in Production while the privacy policy is the undisclosed version', () => {
    stub('true', 'production');
    expect(isLedgerChatEnabled(OLD_PRIVACY)).toBe(false);
  });

  it('reads VERCEL_ENV through cleanEnvValue, so stray whitespace cannot open the gate', () => {
    stub('true', ' production\n');
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

  it('fails closed where VERCEL_ENV is missing in a production build', () => {
    stub('true', undefined, 'production');
    expect(process.env.VERCEL_ENV).toBeUndefined();
    expect(isLedgerChatEnabled(OLD_PRIVACY)).toBe(false);
    expect(isLedgerChatEnabled(NEW_PRIVACY)).toBe(true);
  });

  it.each(['test', 'development'])('is on where VERCEL_ENV is unset and NODE_ENV is %s (CI, next dev)', (nodeEnv) => {
    stub('true', undefined, nodeEnv);
    expect(isLedgerChatEnabled(OLD_PRIVACY)).toBe(true);
  });

  it('is off when the flag is not exactly "true", whatever the environment', () => {
    for (const env of ['production', 'preview', undefined]) {
      stub('false', env);
      expect(isLedgerChatEnabled(NEW_PRIVACY)).toBe(false);
    }
    stub(undefined, 'preview');
    expect(isLedgerChatEnabled(NEW_PRIVACY)).toBe(false);
  });

  it('defaults to the shipped privacy version', () => {
    stub('true', 'production');
    // Reads the live LEGAL_VERSIONS.privacy (still '2026-11-02' until the owner names the EU
    // representative). When the owner bumps it, this expectation must flip to true.
    expect(isLedgerChatEnabled()).toBe(false);
  });
});
