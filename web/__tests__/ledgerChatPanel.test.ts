import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

// Source-scan pins for the panel, in the repo's style for
// components (no jsdom here). Each pin is a rule the design or privacy
// review would otherwise have to re-check by hand.
const chat = join(__dirname, '..', 'components', 'chat');
const panel = readFileSync(join(chat, 'AskLedgerPanel.tsx'), 'utf8');
const settings = readFileSync(join(__dirname, '..', 'app', '(app)', 'settings', 'SettingsClient.tsx'), 'utf8');
const settingsPage = readFileSync(join(__dirname, '..', 'app', '(app)', 'settings', 'page.tsx'), 'utf8');
const route = readFileSync(join(__dirname, '..', 'app', 'api', 'ledger-chat', 'route.ts'), 'utf8');
const data = readFileSync(join(__dirname, '..', 'lib', 'server', 'data.ts'), 'utf8');
const authProvider = readFileSync(join(__dirname, '..', 'components', 'providers', 'AuthProvider.tsx'), 'utf8');

describe('AskLedgerPanel', () => {
  test('reads the signed-in user through sessionUserId, never an unguarded getSession chain', () => {
    expect(panel).toContain('sessionUserId(');
    expect(panel).not.toMatch(/getSession\(\)\s*\.then\(/);
    expect(panel).not.toMatch(/auth\.getSession\(\)\s*\.then\(/);
  });

  test('renders figures through MetricRow and masks at the render site with the shared helpers', () => {
    expect(panel).toMatch(/import \{[^}]*MetricRow[^}]*\} from '@web\/components\/visual'/);
    // Hidden comes from the GET state (discreet or hide-totals-on-home); unknown state masks.
    expect(panel).toMatch(/const hidden = state \? state\.hideTotals : true;/);
    // Rows and prose both pass through src/lib/discreet; no local '•••' re-implementation.
    expect(panel).toContain('maskInr(');
    expect(panel).toContain('maskCount(');
    expect(panel).toContain('maskNumbers(');
    expect(panel).not.toContain("return '•••'");
  });

  test('the newest answer is announced inside the live region, masked exactly like the prose on screen', () => {
    // The transcript sits outside the region, so the answer is mirrored into it as hidden text.
    const start = panel.indexOf('aria-live="polite"');
    expect(start).toBeGreaterThan(-1);
    const region = panel.slice(start, panel.indexOf("status === 'consent'", start));
    expect(region).toContain('sr-only');
    // Spoken form: "hidden" for each figure, never the bullet glyph.
    expect(region).toMatch(/spokenMask\(announced\.answer, announcedMasked\)/);
    // Never the raw answer: in discreet mode that would read unmasked figures aloud.
    expect(panel).not.toMatch(/\{announced\.answer\}/);
    expect(panel).toMatch(/announcedMasked = announced \? hidden && !revealed\.has\(`\$\{announced\.id\}:answer`\) : true/);
  });

  test('keyboard focus: the question box on open (never Clear), the dock control on close', () => {
    expect(panel).toContain('onOpenAutoFocus={onOpenFocus}');
    expect(panel).toContain('onCloseAutoFocus={onCloseFocus}');
    const open = panel.slice(panel.indexOf('const onOpenFocus'), panel.indexOf('const onCloseFocus'));
    expect(open).toContain('e.preventDefault()');
    expect(open).toContain('inputRef.current');
    const close = panel.slice(panel.indexOf('const onCloseFocus'), panel.indexOf('const wasBusyRef'));
    expect(close).toContain('e.preventDefault()');
    expect(close).toContain('returnFocus?.()');
    // The refocus after an answer is skipped on touch, where it would raise the keyboard over each answer.
    expect(panel).toMatch(/wasBusyRef\.current && !busy && open && !window\.matchMedia\('\(pointer: coarse\)'\)\.matches/);
  });

  test('is a Radix dialog with a live answer region and the shared 16px input style', () => {
    expect(panel).toContain("from '@radix-ui/react-dialog'");
    expect(panel).toContain('aria-live="polite"');
    // INPUT_STYLE carries fontSize 16, which keeps iOS from zooming the composer.
    expect(panel).toContain("from '@web/lib/auth/inputStyle'");
    expect(panel).toContain('style={INPUT_STYLE}');
  });

  test('consent is one tap, saved before the question is sent, and the audit call cannot block it', () => {
    const consent = panel.indexOf("setSetting('consent.ledgerChatOptIn', chatOptInValue(true))");
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
    expect(panel).toMatch(/recordAuditEvent\('ledger_chat_consent_toggled', 'privacy', \{\s*enabled: true,\s*privacyVersion: LEGAL_VERSIONS\.privacy,\s*noticeVersion: LEDGER_CHAT_NOTICE_VERSION,/);
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

  test('an answer in flight cannot undo a clear: send appends to the live turns, and Clear is hidden while busy', () => {
    // The stale closure over `turns` is what resurrected cleared turns.
    expect(panel).not.toMatch(/\[\.\.\.turns, turn\]/);
    expect(panel).toContain('turnsRef.current');
    expect(panel).toMatch(/const next = \[\.\.\.current, turn\]/);
    const send = panel.slice(panel.indexOf('const send = React.useCallback'), panel.indexOf('const onTurnOnAndAsk'));
    expect(send).not.toMatch(/\bturns\b/);
    expect(panel).toMatch(/turns\.length > 0 && !busy/);
  });

  test('a late answer is dropped, not saved, when the transcript was cleared meanwhile', () => {
    const send = panel.slice(panel.indexOf('const send = React.useCallback'), panel.indexOf('const onTurnOnAndAsk'));
    // Compared against the store's clear count taken before the POST; the check sits before the save.
    expect(send.indexOf('const clearsAtStart = transcriptClearCount()')).toBeLessThan(send.indexOf('await fetch('));
    expect(send.indexOf('transcriptClearCount() !== clearsAtStart')).toBeLessThan(send.indexOf('saveTranscript('));
    // A close during the consent writes stops before the send.
    const turnOn = panel.slice(panel.indexOf('const onTurnOnAndAsk'), panel.indexOf('const onNotNow'));
    expect(panel).toMatch(/openEpochRef\.current \+= 1/);
    expect(turnOn.indexOf('openEpochRef.current !== openEpoch')).toBeLessThan(turnOn.indexOf('await send('));
  });

  test('Settings Ask-the-ledger row offers the same control and says it was done', () => {
    expect(settings).toMatch(/clearTranscript\(\);\s*flashToast\('Conversation cleared from this device\.'\)/);
  });
});

describe('state from GET and the initial question', () => {
  test('reads panel state from GET /api/ledger-chat on every open, not from page props', () => {
    expect(panel).toMatch(/fetch\('\/api\/ledger-chat', \{ method: 'GET' \}\)/);
    expect(panel).not.toMatch(/profile: UserProfile/);
    expect(panel).not.toContain('fetchedRef');
  });

  test('an initial question is sent once when consented, and waits behind the consent notice when not', () => {
    expect(panel).toContain('initialQuestion');
    expect(panel).toContain('consumedRef.current = true');
    const effect = panel.slice(panel.indexOf('consumedRef.current = true'), panel.indexOf('consumedRef.current = true') + 500);
    expect(effect).toMatch(/!state\.consented[\s\S]*setStatus\('consent'\)/);
    expect(effect).toContain('void send(q, false)');
  });

  test('reads the state before claiming anything: loading first, a neutral invite before opt-in', () => {
    expect(panel).toMatch(/!ready && !state \? \(\s*<p[^>]*>\{COPY\.loading\}<\/p>/);
    expect(panel).toContain("invite: 'Ask about your week, your spend or your goals.'");
    expect(panel).toContain('{state?.consented ? COPY.empty : COPY.invite}');
  });

  test('after Turn on and ask, the state is read again so starters appear without a reload', () => {
    const turnOn = panel.slice(panel.indexOf('const onTurnOnAndAsk'), panel.indexOf('const onNotNow'));
    expect(turnOn).toMatch(/await send\(pending\.question, pending\.starter\);\s*\/\/[^\n]*\n\s*const loaded = await loadChatState\(\);\s*\/\/[^\n]*\n\s*if \(loaded\.state && stateLoadRef\.current === openLoad\) setState\(loaded\.state\);/);
  });

  test('one GET per open, even when an effect re-runs, and no second send while one is in flight', () => {
    expect(panel).toContain('stateLoadRef.current ??= loadChatState()');
    // The shared load is dropped on close, not in the effect cleanup (that would double the StrictMode GET).
    const effect = panel.slice(panel.indexOf('if (!open) {'), panel.indexOf('}, [open, setTurns])'));
    expect(effect.indexOf('stateLoadRef.current = null')).toBeLessThan(effect.indexOf('return;'));
    expect(effect.slice(effect.indexOf('return () =>'))).not.toContain('stateLoadRef');
    expect(panel).toContain("if (status === 'loading') return;");
  });

  test('a fresh open drops a stale GET refusal, and the post-consent re-read cannot land after a close or reopen', () => {
    expect(panel).toMatch(/if \(loaded\.blocked\) return loaded\.blocked;/);
    expect(panel).toMatch(/STALE_ON_CLEAN_GET\.has\(prev\)/);
    expect(panel).toMatch(/STALE_ON_CLEAN_GET: ReadonlySet<Status> = new Set\(\['disabled', 'outdated', 'error'\]\)/);
    // A kept consent card is stale once the GET (not the optimistic flag) says consented; loading is never reset.
    expect(panel).toMatch(/prev === 'consent' && loaded\.state\.consented\)\) return 'idle'/);
    expect(panel).not.toMatch(/status === 'consent' && state\?\.consented/);
    expect(panel).not.toMatch(/STALE_ON_CLEAN_GET[^;]*'loading'/);
    const turnOn = panel.slice(panel.indexOf('const onTurnOnAndAsk'), panel.indexOf('const onNotNow'));
    expect(turnOn.indexOf('const openLoad = stateLoadRef.current')).toBeLessThan(turnOn.indexOf('await send('));
    expect(turnOn).toContain('stateLoadRef.current === openLoad');
  });

  test('outdated agreements and a resting feature get calm copy; outdated links to /consent', () => {
    expect(panel).toContain('Your agreements changed. Review them to keep asking.');
    expect(panel).toContain('href="/consent"');
    expect(panel).toContain("'consent_outdated'");
    expect(panel).toContain('Ask the ledger is resting for now.');
    expect(panel).not.toMatch(/text-danger|bg-danger|red-/);
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

  test('the switch stores the notice version (or false) and audits both versions', () => {
    expect(settings).toContain("setSetting('consent.ledgerChatOptIn', chatOptInValue(value))");
    expect(settings).toMatch(/recordAuditEvent\('ledger_chat_consent_toggled', 'privacy', \{\s*enabled: value,\s*privacyVersion: LEGAL_VERSIONS\.privacy,\s*noticeVersion: LEDGER_CHAT_NOTICE_VERSION,/);
  });

  test('with the chat flag off, neither the row nor its notice dialog renders', () => {
    // The server flag (same gate as the dock and the route) reaches the client as a prop.
    expect(settingsPage).toContain("import { isLedgerChatEnabled } from '@web/lib/server/ledgerChat/enabled'");
    expect(settingsPage).toContain('chatEnabled={isLedgerChatEnabled()}');
    expect(settings.match(/label="Ask the ledger"/g)?.length).toBe(1);
    expect(settings.match(/title="Turn on Ask the ledger"/g)?.length).toBe(1);
    expect(settings).toMatch(/\{chatEnabled \? \(\s*<PrefRow\s+label="Ask the ledger"/);
    expect(settings).toMatch(/\{chatEnabled \? \(\s*<ConfirmDialog\s+open=\{confirmLedgerChat\}\s+title="Turn on Ask the ledger"/);
  });

  test('every server reader counts only the current notice version, never a bare true', () => {
    for (const src of [route, data]) {
      expect(src).toContain('isCurrentChatOptIn(');
      expect(src).not.toMatch(/value_json === true|ledgerChatOptIn === true/);
    }
  });

  test('any sign-out event clears the device transcript, including session expiry and deletion', () => {
    expect(authProvider).toContain("from '@web/lib/privacy/clearDevice'");
    expect(authProvider).toContain("clearWebDevice('signOut')");
  });
});

describe('chat consent notice', () => {
  test('discloses what the route sends, as the privacy policy does (O4)', async () => {
    const { LEDGER_CHAT_NOTICE } = await import('@web/components/chat/notice');
    const { LEGAL_ENTITY } = await import('@/lib/legalEntity');
    expect(LEDGER_CHAT_NOTICE.sent).toContain('up to 10 earlier turns of this conversation (your questions and its replies)');
    expect(LEDGER_CHAT_NOTICE.sent).toMatch(/context line: today’s date, your time zone, currency and locale/);
    expect(LEDGER_CHAT_NOTICE.sent).toContain('the kind and state of your active goals, and whether discreet mode is on.');
    expect(LEDGER_CHAT_NOTICE.sent).toContain('up to 200 of your entries from the last 30 days');
    expect(LEDGER_CHAT_NOTICE.sent).toContain('first 120 characters of your note');
    expect(LEDGER_CHAT_NOTICE.retention).toBe(LEGAL_ENTITY.anthropicRetention);
    for (const exit of ['Clear conversation', 'turn this off', 'turn discreet mode on', 'sign out']) {
      expect(LEDGER_CHAT_NOTICE.device).toContain(exit);
    }
  });
});
