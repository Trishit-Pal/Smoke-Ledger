// Where the floating "Ask" pill shows, and where it sits. Pure, so jest covers it.

import { spacing } from '@/constants/theme';

/** Build-time switch (EXPO_PUBLIC_LEDGER_CHAT_ENABLED); off unless exactly "true". */
export function isLedgerChatEnabled(flag: string | undefined = process.env.EXPO_PUBLIC_LEDGER_CHAT_ENABLED): boolean {
  return flag === 'true';
}

// Reading tabs only. Log is deliberately absent, and so is every non-tab route
// (modals, consent, onboarding): an allowlist cannot leak onto a new screen.
const PILL_PATHS: ReadonlySet<string> = new Set(['/', '/index', '/trends', '/history', '/goals', '/settings']);

export function isAskPillVisible(
  pathname: string,
  flag: string | undefined = process.env.EXPO_PUBLIC_LEDGER_CHAT_ENABLED,
): boolean {
  return isLedgerChatEnabled(flag) && PILL_PATHS.has(pathname);
}

/** The pill's touch target, and the gap between it and the tab bar. */
export const ASK_PILL_TARGET = 44;
export const ASK_PILL_GAP = spacing.sm;
/** Height the pill takes above the tab bar, plus a breath, so scrolled content ends clear of it. */
export const ASK_PILL_CLEARANCE = ASK_PILL_TARGET + ASK_PILL_GAP + spacing.sm;

/** Bottom padding of a scrolling screen: the pill's clearance when the feature is on. */
export function scrollBottomPadding(flag: string | undefined = process.env.EXPO_PUBLIC_LEDGER_CHAT_ENABLED): number {
  return Math.max(spacing.xxxl, isLedgerChatEnabled(flag) ? ASK_PILL_CLEARANCE : 0);
}

const BAR_HEIGHT = 56;
const BAR_HEIGHT_SHORT = 50;

/** Total height of the custom tab bar in app/(tabs)/_layout.tsx; the pill rests above it. */
export function tabBarHeight(insetBottom: number, isShort: boolean): number {
  return (isShort ? BAR_HEIGHT_SHORT : BAR_HEIGHT) + Math.max(insetBottom, isShort ? spacing.xs : spacing.sm);
}
