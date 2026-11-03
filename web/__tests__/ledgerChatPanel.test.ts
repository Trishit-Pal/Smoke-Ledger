import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

// Source-scan pins for the panel and launcher, in the repo's style for
// components (no jsdom here). Each pin is a rule the design or privacy
// review would otherwise have to re-check by hand.
const chat = join(__dirname, '..', 'components', 'chat');
const panel = readFileSync(join(chat, 'AskLedgerPanel.tsx'), 'utf8');
const launcher = readFileSync(join(chat, 'AskLedgerLauncher.tsx'), 'utf8');
const dashboard = readFileSync(join(__dirname, '..', 'app', '(app)', 'dashboard', 'DashboardClient.tsx'), 'utf8');
const trends = readFileSync(join(__dirname, '..', 'app', '(app)', 'trends', 'TrendsClient.tsx'), 'utf8');
const settings = readFileSync(join(__dirname, '..', 'app', '(app)', 'settings', 'SettingsClient.tsx'), 'utf8');
const authProvider = readFileSync(join(__dirname, '..', 'components', 'providers', 'AuthProvider.tsx'), 'utf8');

describe('AskLedgerPanel', () => {
  test('reads the signed-in user through sessionUserId, never an unguarded getSession chain', () => {
    expect(panel).toContain('sessionUserId(');
    expect(panel).not.toMatch(/getSession\(\)\s*\.then\(/);
    expect(panel).not.toMatch(/auth\.getSession\(\)\s*\.then\(/);
  });

  test('renders figures through MetricRow and masks at the render site with the shared helpers', () => {
    expect(panel).toMatch(/import \{[^}]*MetricRow[^}]*\} from '@web\/components\/visual'/);
    expect(panel).toContain('isHomeTotalsHidden(');
    // Rows and prose both pass through src/lib/discreet; no local '•••' re-implementation.
    expect(panel).toContain('maskInr(');
    expect(panel).toContain('maskCount(');
    expect(panel).toContain('maskNumbers(');
    expect(panel).not.toContain("return '•••'");
  });

  test('is a Radix dialog with a live answer region and the shared 16px input style', () => {
    expect(panel).toContain("from '@radix-ui/react-dialog'");
    expect(panel).toContain('aria-live="polite"');
    // INPUT_STYLE carries fontSize 16, which keeps iOS from zooming the composer.
    expect(panel).toContain("from '@web/lib/auth/inputStyle'");
    expect(panel).toContain('style={INPUT_STYLE}');
  });

  test('consent is one tap, saved before the question is sent, and the audit call cannot block it', () => {
    const consent = panel.indexOf("setSetting('consent.ledgerChatOptIn', true)");
    const audit = panel.indexOf("recordAuditEvent('ledger_chat_consent_toggled'");
    expect(consent).toBeGreaterThan(-1);
    expect(audit).toBeGreaterThan(consent);
    expect(panel).toContain('Turn on and ask');
    // The audit call sits inside a try block.
    expect(panel.slice(audit - 200, audit)).toMatch(/try\s*\{/);
  });

  test('renders the answer as plain text, never as HTML', () => {
    expect(panel).not.toContain('dangerouslySetInnerHTML');
  });

  test('persists the transcript on this device only, keyed by user', () => {
    expect(panel).toContain("from '@web/components/chat/transcriptStore'");
    expect(panel).toContain('auth.getSession()');
  });

  test('the consent card uses the shared notice, links the policy, and records the notice version', () => {
    expect(panel).toContain("from '@web/components/chat/notice'");
    expect(panel).toContain('href="/privacy"');
    expect(panel).toMatch(/recordAuditEvent\('ledger_chat_consent_toggled', 'privacy', \{\s*enabled: true,\s*privacyVersion: LEGAL_VERSIONS\.privacy/);
  });
});

describe('AI label and Clear conversation', () => {
  test('each answer carries a Written by AI caption', () => {
    expect(panel).toContain('Written by AI');
  });

  test('the header has a plain Clear conversation control that clears storage and in-memory turns', () => {
    expect(panel).toContain('Clear conversation');
    expect(panel).toMatch(/clearTranscript\(userId/);
    expect(panel).toMatch(/setTurns\(\[\]\)/);
    expect(panel).not.toMatch(/ConfirmDialog|window\.confirm/);
  });

  test('Settings Ask-the-ledger row offers the same control', () => {
    expect(settings).toContain('Clear conversation');
  });
});

describe('AskLedgerLauncher and its mount points', () => {
  test('renders nothing while the feature is off', () => {
    expect(launcher).toMatch(/if \(!enabled\) return null/);
  });

  test('derives starters from the ledger state, not from analytics', () => {
    expect(launcher).toContain("from '@/domain/ledgerChat/starters'");
    expect(launcher).not.toContain('usage_events');
  });

  test('is mounted on the dashboard footer and under the Trends end-mark, gated by the server flag', () => {
    for (const src of [dashboard, trends]) {
      expect(src).toContain('<AskLedgerLauncher');
      expect(src).toContain('ledgerChatEnabled');
    }
  });
});

describe('Settings integration', () => {
  test('has the off switch, and clears the device transcript on discreet-on and through the lifecycle registry on sign-out, erase and delete', () => {
    expect(settings).toContain("setSetting('consent.ledgerChatOptIn'");
    // Discreet-on and consent-off keep their direct call; the other events go through the registry.
    expect(settings.match(/clearTranscript\(\)/g)?.length ?? 0).toBeGreaterThanOrEqual(2);
    const discreet = settings.indexOf('await updateProfile({ discreetMode: value })');
    const discreetClear = settings.indexOf('clearTranscript()', discreet);
    expect(discreet).toBeGreaterThan(-1);
    expect(discreetClear - discreet).toBeLessThan(300);
    // Erase and delete both promise that everything goes; the device transcript is part of everything.
    const erase = settings.indexOf('await eraseAllUserData()');
    const eraseClear = settings.indexOf("clearWebDevice('erase')", erase);
    const del = settings.indexOf('await deleteUserAccount(');
    const delClear = settings.indexOf("clearWebDevice('delete')", del);
    expect(erase).toBeGreaterThan(-1);
    expect(eraseClear).toBeGreaterThan(erase);
    expect(eraseClear - erase).toBeLessThan(400);
    expect(del).toBeGreaterThan(-1);
    expect(delClear).toBeGreaterThan(del);
    expect(delClear - del).toBeLessThan(700);
    expect(settings.match(/clearWebDevice\('signOut'\)/g)?.length ?? 0).toBe(2);
  });

  test('turning the switch on shows the same notice as the panel before saving', () => {
    expect(settings).toContain("from '@web/components/chat/notice'");
    expect(settings).toMatch(/<ConfirmDialog[\s\S]*confirmLabel="Turn on"/);
  });

  test('any sign-out event clears the device transcript, including session expiry and deletion', () => {
    expect(authProvider).toContain("from '@web/lib/privacy/clearDevice'");
    expect(authProvider).toContain("clearWebDevice('signOut')");
  });
});
