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

const BAR_HEIGHT = 56;
const BAR_HEIGHT_SHORT = 50;

/** Total height of the custom tab bar in app/(tabs)/_layout.tsx; the pill rests above it. */
export function tabBarHeight(insetBottom: number, isShort: boolean): number {
  return (isShort ? BAR_HEIGHT_SHORT : BAR_HEIGHT) + Math.max(insetBottom, isShort ? spacing.xs : spacing.sm);
}
