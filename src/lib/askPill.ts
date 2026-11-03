// Where the floating "Ask" pill shows, and where it sits. Pure, so jest covers it.

import { spacing } from '@/constants/theme';
import { isChatPolicyLive, LEGAL_VERSIONS } from '@/lib/legal';

/**
 * Build-time switch (EXPO_PUBLIC_LEDGER_CHAT_ENABLED); off unless exactly "true" and either the
 * privacy policy that describes the chat is live or this is a development build. The dev exemption
 * is what lets the owner check mobile against the Preview deployment before the bump; release
 * builds (store and EAS preview) stay gated, and the web route refuses Production regardless.
 * `__DEV__` is guarded so jest and node, where it is not defined, do not throw.
 */
export function isLedgerChatEnabled(
  flag: string | undefined = process.env.EXPO_PUBLIC_LEDGER_CHAT_ENABLED,
  privacy: string = LEGAL_VERSIONS.privacy,
  isDev: boolean = typeof __DEV__ !== 'undefined' && __DEV__,
): boolean {
  return flag === 'true' && (isDev || isChatPolicyLive(privacy));
}

// Reading tabs only. Log is deliberately absent, and so is every non-tab route
// (modals, consent, onboarding): an allowlist cannot leak onto a new screen.
const PILL_PATHS: ReadonlySet<string> = new Set(['/', '/index', '/trends', '/history', '/goals', '/settings']);

export function isAskPillVisible(
  pathname: string,
  flag: string | undefined = process.env.EXPO_PUBLIC_LEDGER_CHAT_ENABLED,
  privacy: string = LEGAL_VERSIONS.privacy,
): boolean {
  return isLedgerChatEnabled(flag, privacy) && PILL_PATHS.has(pathname);
}

/** The pill's touch target, and the gap between it and the tab bar. */
export const ASK_PILL_TARGET = 44;
export const ASK_PILL_GAP = spacing.sm;
/** Height the pill takes above the tab bar, plus a breath, so scrolled content ends clear of it. */
export const ASK_PILL_CLEARANCE = ASK_PILL_TARGET + ASK_PILL_GAP + spacing.sm;

/** Bottom padding of a scrolling screen: the pill's clearance when the feature is on. */
export function scrollBottomPadding(
  flag: string | undefined = process.env.EXPO_PUBLIC_LEDGER_CHAT_ENABLED,
  privacy: string = LEGAL_VERSIONS.privacy,
): number {
  return Math.max(spacing.xxxl, isLedgerChatEnabled(flag, privacy) ? ASK_PILL_CLEARANCE : 0);
}

const BAR_HEIGHT = 56;
const BAR_HEIGHT_SHORT = 50;

/** Total height of the custom tab bar in app/(tabs)/_layout.tsx; the pill rests above it. */
export function tabBarHeight(insetBottom: number, isShort: boolean): number {
  return (isShort ? BAR_HEIGHT_SHORT : BAR_HEIGHT) + Math.max(insetBottom, isShort ? spacing.xs : spacing.sm);
}
