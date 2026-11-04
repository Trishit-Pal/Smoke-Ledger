import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeEach, describe, expect, test, vi } from 'vitest';

const isLedgerChatEnabled = vi.fn<() => boolean>();
const getServerSetting = vi.fn<(key: string) => Promise<unknown>>();

vi.mock('@web/lib/server/ledgerChat/enabled', () => ({ isLedgerChatEnabled: () => isLedgerChatEnabled() }));
vi.mock('@web/lib/server/data', () => ({ getServerSetting: (key: string) => getServerSetting(key) }));

const { shouldAskChat } = await import('@web/lib/server/ledgerChat/askChat');

describe('shouldAskChat', () => {
  beforeEach(() => {
    isLedgerChatEnabled.mockReset();
    getServerSetting.mockReset();
  });

  test('asks when the chat is enabled and the setting was never written', async () => {
    isLedgerChatEnabled.mockReturnValue(true);
    getServerSetting.mockResolvedValue(null);
    expect(await shouldAskChat()).toBe(true);
    expect(getServerSetting).toHaveBeenCalledWith('consent.ledgerChatOptIn');
  });

  test('does not ask a reader who declined', async () => {
    isLedgerChatEnabled.mockReturnValue(true);
    getServerSetting.mockResolvedValue(false);
    expect(await shouldAskChat()).toBe(false);
  });

  test('does not ask a reader holding a stale-version string', async () => {
    isLedgerChatEnabled.mockReturnValue(true);
    getServerSetting.mockResolvedValue('2025-01-01');
    expect(await shouldAskChat()).toBe(false);
  });

  test('does not ask when the chat is disabled for the build', async () => {
    isLedgerChatEnabled.mockReturnValue(false);
    getServerSetting.mockResolvedValue(null);
    expect(await shouldAskChat()).toBe(false);
  });

  test('a failed read means no ask, and never throws', async () => {
    isLedgerChatEnabled.mockReturnValue(true);
    getServerSetting.mockRejectedValue(new Error('boom'));
    expect(await shouldAskChat()).toBe(false);
  });

  test('a read that throws synchronously also means no ask', async () => {
    isLedgerChatEnabled.mockReturnValue(true);
    getServerSetting.mockImplementation(() => {
      throw new Error('sync boom');
    });
    expect(await shouldAskChat()).toBe(false);
  });
});

const read = (rel: string) => readFileSync(join(__dirname, '..', rel), 'utf8');

describe('onboarding privacy page', () => {
  const page = read('app/onboarding/privacy/page.tsx');

  test('computes chatAsk with the shared helper and passes it down', () => {
    expect(page).toContain("from '@web/lib/server/ledgerChat/askChat'");
    expect(page).toMatch(/chatAsk=\{/);
    expect(page).toContain('shouldAskChat()');
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
