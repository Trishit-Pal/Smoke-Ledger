// Native twin of web/lib/goals/firstSuggestionStore.ts: "Not now" lives on this device only, in
// AsyncStorage, one key per user, the date it was dismissed. Never throws.

import { firstSuggestionKey, isDismissalStampActive } from '@/lib/goals/firstSuggestionDismissal';

type AsyncStorageLike = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
};

function loadAsyncStorage(): AsyncStorageLike | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- optional native module, as catalogStorageNative
    const mod = require('@react-native-async-storage/async-storage');
    return (mod.default ?? mod) as AsyncStorageLike;
  } catch {
    return null;
  }
}

export async function isFirstSuggestionDismissed(
  userId: string,
  today: string,
  store: AsyncStorageLike | null = loadAsyncStorage(),
): Promise<boolean> {
  try {
    return isDismissalStampActive(await store?.getItem(firstSuggestionKey(userId)), today);
  } catch {
    return false;
  }
}

export async function dismissFirstSuggestion(
  userId: string,
  today: string,
  store: AsyncStorageLike | null = loadAsyncStorage(),
): Promise<void> {
  try {
    await store?.setItem(firstSuggestionKey(userId), today);
  } catch {
    // Storage failure: the suggestion simply returns on the next visit.
  }
}
