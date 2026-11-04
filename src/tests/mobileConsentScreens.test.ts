import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import * as healthConsent from '@/lib/healthConsent';
import { getSetting } from '@/db/repositories/settings';
import { isLedgerChatEnabled } from '@/lib/askPill';
import { shouldAskChat } from '@/services/chatConsentAsk';

jest.mock('@/lib/supabase', () => ({ getSupabase: jest.fn() }));
jest.mock('@/db/repositories/settings', () => ({ getSetting: jest.fn(), setSetting: jest.fn() }));
jest.mock('@/services/audit', () => ({ recordAuditEvent: jest.fn() }));
jest.mock('@/db/repositories/_supabase', () => ({
  requireUserId: async () => 'u1',
  mapDbError: (e: unknown) => e,
}));
jest.mock('@/lib/askPill', () => ({ isLedgerChatEnabled: jest.fn() }));

const root = join(__dirname, '../..');
const read = (p: string) => readFileSync(join(root, p), 'utf8').replace(/\r\n/g, '\n');

const SCREENS: Array<[string, string]> = [
  ['onboarding privacy', 'app/onboarding/privacy.tsx'],
  ['re-consent', 'app/consent.tsx'],
];

describe.each(SCREENS)('%s screen', (_name, file) => {
  const src = read(file);

  it('renders the agreement row, the health row and the chat pair only when asked', () => {
    expect(src).toMatch(/<AgreementRow\b/);
    expect(src).toMatch(/<HealthConsentRow\b/);
    expect(src).toMatch(/chatAsk \? \(\s*<ChatChoiceRow/);
  });

  it('no longer builds the five required rows', () => {
    expect(src).not.toContain('REQUIRED_ROWS');
    expect(src).not.toContain('CONSENT_ROWS');
  });

  it('gates the button on canContinueConsent', () => {
    expect(src).toContain('canContinueConsent(');
  });

  it('writes the consent, then the chat answer, then an unawaited audit', () => {
    const consent = src.search(/await (submitConsentStep|acceptChangedTerms)\(/);
    const set = src.indexOf("await setSetting('consent.ledgerChatOptIn', chatOptInValue(");
    const audit = src.indexOf("void recordAuditEvent('ledger_chat_consent_toggled', 'privacy'");
    expect(consent).toBeGreaterThan(-1);
    expect(set).toBeGreaterThan(consent);
    expect(audit).toBeGreaterThan(set);
    expect(src).toMatch(/\.catch\(\(\) => undefined\)/);
    expect(src).toContain('LEDGER_CHAT_NOTICE_VERSION');
  });

  it('guards the consent write with a ref so a retry never repeats it', () => {
    expect(src).toContain('savedRef.current');
  });

  it('asks only when shouldAskChat says so, and holds Continue until it answers', () => {
    expect(src).toContain('shouldAskChat()');
    expect(src).toMatch(/chatAsk !== null/);
  });

  it('has no decline control', () => {
    expect(src).not.toMatch(/HEALTH_DECLINE_|healthDeclined/);
  });
});

describe('consent rows component', () => {
  const rows = read('src/components/consent/ConsentRows.tsx');

  it('builds tick 1 from the shared label parts and sub-line, with both links', () => {
    expect(rows).toContain('AGREEMENT_LABEL_PARTS');
    expect(rows).toContain('AGREEMENT_SUB');
    expect(rows).toContain('LEGAL_URLS.terms');
    expect(rows).toContain('LEGAL_URLS.privacy');
  });

  it('builds tick 2 from the existing health consent copy', () => {
    expect(rows).toContain('HEALTH_CONSENT_LABEL');
    expect(rows).toContain('HEALTH_CONSENT_SUB');
  });

  it('shows the full existing notice and an equal, unselected-by-default pair', () => {
    expect(rows).toContain('<ConsentNotice');
    expect(rows).toMatch(/accessibilityState=\{\{ selected/);
    expect(rows).toContain('ROW_TARGET = 44');
    expect(rows).toContain('minHeight: ROW_TARGET');
    expect(rows).toMatch(/answer === true/);
    expect(rows).toMatch(/answer === false/);
  });
});

describe('the decline is gone', () => {
  const NEEDLE = 'HEALTH_' + 'DECLINE_';

  it('exports no decline copy', () => {
    expect(Object.keys(healthConsent).filter((k) => k.startsWith(NEEDLE))).toEqual([]);
  });

  it('no file under app/, src/ or web/ references it', () => {
    const skip = new Set(['node_modules', '.next', '.expo', 'coverage', 'test-results', 'playwright-report']);
    const hits: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        if (skip.has(name)) continue;
        const full = join(dir, name);
        if (statSync(full).isDirectory()) walk(full);
        else if (/\.(ts|tsx|js|jsx)$/.test(name) && !full.endsWith('mobileConsentScreens.test.ts')) {
          if (readFileSync(full, 'utf8').includes(NEEDLE)) hits.push(full);
        }
      }
    };
    for (const d of ['app', 'src', 'web']) walk(join(root, d));
    expect(hits).toEqual([]);
  });
});

describe('shouldAskChat', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (isLedgerChatEnabled as jest.Mock).mockReturnValue(true);
  });

  it('asks when the chat is on and no row was ever stored', async () => {
    (getSetting as jest.Mock).mockResolvedValueOnce(null);
    await expect(shouldAskChat()).resolves.toBe(true);
  });

  it('does not ask a reader who declined (a stored false is an answer)', async () => {
    (getSetting as jest.Mock).mockResolvedValueOnce(false);
    await expect(shouldAskChat()).resolves.toBe(false);
  });

  it('does not ask a reader holding a version string, current or stale', async () => {
    (getSetting as jest.Mock).mockResolvedValueOnce('2020-01-01');
    await expect(shouldAskChat()).resolves.toBe(false);
  });

  it('does not ask when the chat is off for the build, and does not read', async () => {
    (isLedgerChatEnabled as jest.Mock).mockReturnValue(false);
    await expect(shouldAskChat()).resolves.toBe(false);
    expect(getSetting).not.toHaveBeenCalled();
  });

  it('does not ask when the read fails', async () => {
    (getSetting as jest.Mock).mockRejectedValueOnce(new Error('offline'));
    await expect(shouldAskChat()).resolves.toBe(false);
  });
});

describe('getSetting tells a stored false from no row', () => {
  const actual = jest.requireActual('@/db/repositories/settings') as typeof import('@/db/repositories/settings');

  function stub(data: { value_json: unknown } | null) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    (require('@/lib/supabase').getSupabase as jest.Mock).mockReturnValue({
      from: () => {
        const q = { select: () => q, eq: () => q, maybeSingle: async () => ({ data, error: null }) };
        return q;
      },
    });
  }

  it('returns null for a missing row and false for a stored false', async () => {
    stub(null);
    await expect(actual.getSetting('k')).resolves.toBeNull();
    stub({ value_json: false });
    await expect(actual.getSetting('k')).resolves.toBe(false);
  });
});
