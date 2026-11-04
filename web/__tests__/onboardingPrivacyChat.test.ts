import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import { LEDGER_CHAT_NOTICE_VERSION } from '@web/components/chat/notice';

const isLedgerChatEnabled = vi.fn<() => boolean>();
const createClient = vi.fn();

vi.mock('@web/lib/server/ledgerChat/enabled', () => ({ isLedgerChatEnabled: () => isLedgerChatEnabled() }));
vi.mock('@web/lib/supabase/server', () => ({ createClient: () => createClient() }));

const { shouldAskChat } = await import('@web/lib/server/ledgerChat/askChat');

interface RowResult {
  data: { value_json: unknown } | null;
  error: { message: string } | null;
}

/** A Supabase client stub at the query level; `queries` records every table read. */
function stubClient(result: RowResult, user: { id: string } | null = { id: 'u1' }) {
  const eqs: Array<[string, unknown]> = [];
  const queries: string[] = [];
  const builder = {
    select: vi.fn(() => builder),
    eq: vi.fn((col: string, val: unknown) => {
      eqs.push([col, val]);
      return builder;
    }),
    maybeSingle: vi.fn(async () => result),
  };
  createClient.mockResolvedValue({
    auth: { getUser: async () => ({ data: { user }, error: null }) },
    from: (table: string) => {
      queries.push(table);
      return builder;
    },
  });
  return { eqs, queries, builder };
}

describe('shouldAskChat', () => {
  beforeEach(() => {
    isLedgerChatEnabled.mockReset().mockReturnValue(true);
    createClient.mockReset();
  });

  test('asks when the chat is enabled and no row was ever written', async () => {
    const { eqs, queries, builder } = stubClient({ data: null, error: null });
    expect(await shouldAskChat()).toBe(true);
    expect(queries).toEqual(['settings_kv']);
    expect(builder.select).toHaveBeenCalledWith('value_json');
    expect(eqs).toEqual([
      ['user_id', 'u1'],
      ['key', 'consent.ledgerChatOptIn'],
    ]);
  });

  test('does not ask a reader who declined (a stored false is an answer)', async () => {
    stubClient({ data: { value_json: false }, error: null });
    expect(await shouldAskChat()).toBe(false);
  });

  test('does not ask a reader holding a stale-version string', async () => {
    stubClient({ data: { value_json: '2020-01-01' }, error: null });
    expect(await shouldAskChat()).toBe(false);
  });

  test('does not ask a reader on the current notice version', async () => {
    stubClient({ data: { value_json: LEDGER_CHAT_NOTICE_VERSION }, error: null });
    expect(await shouldAskChat()).toBe(false);
  });

  test('a query error means no ask', async () => {
    stubClient({ data: null, error: { message: 'boom' } });
    expect(await shouldAskChat()).toBe(false);
  });

  test('no signed-in user means no ask', async () => {
    stubClient({ data: null, error: null }, null);
    expect(await shouldAskChat()).toBe(false);
  });

  test('a client that throws means no ask, and never throws', async () => {
    createClient.mockRejectedValue(new Error('boom'));
    expect(await shouldAskChat()).toBe(false);
  });

  test('chat disabled for the build means no ask, without querying', async () => {
    isLedgerChatEnabled.mockReturnValue(false);
    const { queries } = stubClient({ data: null, error: null });
    expect(await shouldAskChat()).toBe(false);
    expect(createClient).not.toHaveBeenCalled();
    expect(queries).toEqual([]);
  });
});

const read = (rel: string) => readFileSync(join(__dirname, '..', rel), 'utf8');

describe('onboarding privacy page', () => {
  const page = read('app/onboarding/privacy/page.tsx');

  test('computes chatAsk with the shared helper and passes it down', () => {
    expect(page).toContain("from '@web/lib/server/ledgerChat/askChat'");
    expect(page).toMatch(/chatAsk=\{/);
    expect(page).toContain('shouldAskChat()');
    expect(page).toContain('await Promise.all([');
  });
});

describe('OnboardingPrivacyClient', () => {
  const client = read('app/onboarding/privacy/OnboardingPrivacyClient.tsx');

  test('renders the two ticks, the analytics tick, and the chat pair only when asked', () => {
    expect(client).toContain('<AgreementRow');
    expect(client).toContain('<HealthConsentRow');
    expect(client).toContain('Optional');
    expect(client).toMatch(/chatAsk \? \(\s*<ChatChoiceRow/);
  });

  test('no longer uses the five required rows', () => {
    expect(client).not.toContain('REQUIRED_ROWS');
    expect(client).not.toContain('ConsentCheckRow');
  });

  test('continue is governed by canContinueConsent', () => {
    expect(client).toContain('canContinueConsent(');
  });

  test('saves the consent first, then the chat answer, then a fire-and-forget audit', () => {
    const submit = client.indexOf('await submitConsentStep(');
    const set = client.indexOf("await setSetting('consent.ledgerChatOptIn', chatOptInValue(");
    const audit = client.indexOf("void recordAuditEvent('ledger_chat_consent_toggled', 'privacy'");
    expect(submit).toBeGreaterThan(-1);
    expect(set).toBeGreaterThan(submit);
    expect(audit).toBeGreaterThan(set);
    expect(client).toContain('LEDGER_CHAT_NOTICE_VERSION');
    expect(client).toMatch(/\.catch\(\(\) => undefined\)/);
  });

  test('stamp all ticks the agreement only', () => {
    const stampAll = client.slice(client.indexOf('const stampAll'), client.indexOf('const onContinue'));
    expect(stampAll).toContain("setConsent('agreement', true)");
    expect(stampAll).not.toContain('health');
    expect(stampAll).not.toContain('chat');
  });

  test('the counter counts the shown required rows, not the optional analytics tick', () => {
    expect(client).toMatch(/requiredCount/);
    expect(client).not.toContain('REQUIRED_ROWS.length');
  });
});
