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

describe('AskLedgerPanel', () => {
  test('renders figures through MetricRow and masks at the render site', () => {
    expect(panel).toMatch(/import \{[^}]*MetricRow[^}]*\} from '@web\/components\/visual'/);
    expect(panel).toContain('isHomeTotalsHidden(');
    expect(panel).toContain("'•••'");
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
  test('has the off switch and clears the device transcript on sign-out', () => {
    expect(settings).toContain("setSetting('consent.ledgerChatOptIn'");
    expect(settings.match(/clearTranscript\(\)/g)?.length ?? 0).toBeGreaterThanOrEqual(3);
  });
});
