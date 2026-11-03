import {
  ASK_PILL_CLEARANCE,
  ASK_PILL_TARGET,
  isAskPillVisible,
  isLedgerChatEnabled,
  scrollBottomPadding,
  tabBarHeight,
} from '@/lib/askPill';
import { CHAT_UNDISCLOSED_PRIVACY } from '@/lib/legal';

// Any version later than the undisclosed one counts as "the policy now describes the chat".
const NEWER_PRIVACY = '2026-11-03';

describe('isLedgerChatEnabled', () => {
  it('is on only for the exact string "true"', () => {
    expect(isLedgerChatEnabled('true', NEWER_PRIVACY)).toBe(true);
    for (const v of [undefined, '', 'false', 'TRUE', '1', 'yes']) {
      expect(isLedgerChatEnabled(v, NEWER_PRIVACY)).toBe(false);
    }
  });

  it('stays off while the privacy policy is the undisclosed version, flag or not', () => {
    expect(isLedgerChatEnabled('true', CHAT_UNDISCLOSED_PRIVACY)).toBe(false);
    expect(isLedgerChatEnabled('true')).toBe(false);
  });
});

describe('isAskPillVisible', () => {
  it.each(['/', '/index', '/trends', '/history', '/goals', '/settings'])('shows on %s when the flag is on', (path) => {
    expect(isAskPillVisible(path, 'true', NEWER_PRIVACY)).toBe(true);
  });

  it.each(['/log', '/log/new', '/ask', '/consent', '/onboarding/privacy', '/login', '/goals/new'])(
    'hides on %s even with the flag on',
    (path) => {
      expect(isAskPillVisible(path, 'true', NEWER_PRIVACY)).toBe(false);
    },
  );

  it('hides everywhere when the flag is not "true"', () => {
    expect(isAskPillVisible('/trends', undefined, NEWER_PRIVACY)).toBe(false);
    expect(isAskPillVisible('/trends', 'false', NEWER_PRIVACY)).toBe(false);
  });
});

describe('scrollBottomPadding', () => {
  it('keeps the base padding when the flag is off', () => {
    expect(scrollBottomPadding('false')).toBe(48);
    expect(scrollBottomPadding(undefined)).toBe(48);
  });
  it('clears the whole pill (gap above the bar plus its height) when the flag is on', () => {
    expect(ASK_PILL_CLEARANCE).toBeGreaterThanOrEqual(ASK_PILL_TARGET + 8);
    expect(scrollBottomPadding('true', NEWER_PRIVACY)).toBeGreaterThanOrEqual(ASK_PILL_CLEARANCE);
  });
});

describe('tabBarHeight', () => {
  it('matches the bar: height plus the larger of the inset and the minimum padding', () => {
    expect(tabBarHeight(34, false)).toBe(56 + 34);
    expect(tabBarHeight(0, false)).toBe(56 + 8);
    expect(tabBarHeight(0, true)).toBe(50 + 4);
  });
});
