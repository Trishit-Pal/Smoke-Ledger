// Web shim for src/lib/secureStore.ts — backed by localStorage.
// PIN lock features are not available on web.
const PREFIX = 'sl.';

function key(k: string) { return PREFIX + k; }

export async function isSecureStoreAvailable() { return false; }
export async function setPin(_pin: string) { /* no-op on web */ }
export async function verifyPin(_pin: string) { return false; }
export async function clearPin() { /* no-op */ }
export async function hasPin() { return false; }

export async function readFailedAttempts(): Promise<number> {
  return parseInt(localStorage.getItem(key('failedAttempts')) ?? '0', 10);
}
export async function writeFailedAttempts(n: number) {
  localStorage.setItem(key('failedAttempts'), String(n));
}
export async function readLockoutUntil(): Promise<number | null> {
  const v = localStorage.getItem(key('lockoutUntil'));
  return v ? parseInt(v, 10) : null;
}
export async function writeLockoutUntil(ts: number) {
  localStorage.setItem(key('lockoutUntil'), String(ts));
}
export async function readLastLockTime(): Promise<number | null> {
  const v = localStorage.getItem(key('lastLockTime'));
  return v ? parseInt(v, 10) : null;
}
export async function writeLastLockTime(ts: number) {
  localStorage.setItem(key('lastLockTime'), String(ts));
}
export async function wipeSecureStore() {
  Object.keys(localStorage)
    .filter((k) => k.startsWith(PREFIX))
    .forEach((k) => localStorage.removeItem(k));
}
