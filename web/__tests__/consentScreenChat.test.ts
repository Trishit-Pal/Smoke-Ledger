import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

const read = (rel: string) => readFileSync(join(__dirname, '..', rel), 'utf8').replace(/\r\n/g, '\n');

describe('consent page', () => {
  const page = read('app/consent/page.tsx');

  test('computes chatAsk with the shared helper and passes it down', () => {
    expect(page).toContain("from '@web/lib/server/ledgerChat/askChat'");
    expect(page).toContain('await shouldAskChat()');
    expect(page).toMatch(/chatAsk=\{chatAsk\}/);
  });
});

describe('ConsentClient', () => {
  const client = read('app/consent/ConsentClient.tsx');

  test('always shows the agreement tick, and the health tick only when needed', () => {
    expect(client).toMatch(/<AgreementRow\b/);
    expect(client).toMatch(/needsHealthConsent \? \(\s*<HealthConsentRow/);
  });

  test('shows the chat pair only when chatAsk', () => {
    expect(client).toMatch(/chatAsk \? \(\s*<ChatChoiceRow/);
  });

  test('no longer uses the five required rows', () => {
    expect(client).not.toContain('REQUIRED_ROWS');
    expect(client).not.toContain('ConsentCheckRow');
  });

  test('accept is governed by canContinueConsent', () => {
    expect(client).toContain('canContinueConsent(');
  });

  test('tick 1 supplies the age and data-processing consents', () => {
    expect(client).toContain('ageConfirmed: true');
    expect(client).toContain('dataProcessingConsent: true');
  });

  test('saves the terms first, then the chat answer, then a fire-and-forget audit', () => {
    const accept = client.indexOf('await acceptChangedTerms(');
    const set = client.indexOf("await setSetting('consent.ledgerChatOptIn', chatOptInValue(");
    const audit = client.indexOf("void recordAuditEvent('ledger_chat_consent_toggled', 'privacy'");
    expect(accept).toBeGreaterThan(-1);
    expect(set).toBeGreaterThan(accept);
    expect(audit).toBeGreaterThan(set);
    expect(client).toContain('LEDGER_CHAT_NOTICE_VERSION');
    expect(client).toMatch(/\.catch\(\(\) => undefined\)/);
  });

  test('a retry after a failed chat write does not accept the terms twice', () => {
    expect(client).toContain('savedRef');
    expect(client).toMatch(/if \(!savedRef\.current\) \{[^}]*await acceptChangedTerms\(/);
  });

  test('keeps the Not now link to settings unchanged', () => {
    expect(client).toContain('href="/settings"');
    expect(client).toContain('{RECONSENT_NOT_NOW_LABEL}');
    expect(read('../src/lib/reconsentCopy.ts')).toContain(
      "'Not now — export or delete my data'",
    );
  });
});

describe('ConsentRows', () => {
  const rows = read('components/onboarding/ConsentRows.tsx');

  test('the retired five-row exports are gone', () => {
    expect(rows).not.toContain('REQUIRED_ROWS');
    expect(rows).not.toContain('ConsentCheckRow');
    expect(rows).not.toContain('RequiredKey');
  });
});
