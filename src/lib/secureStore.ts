// Secure KV wrapper + PIN hashing.
//
// Design:
// - Sensitive data (PIN hash, PIN salt, lockout state) lives in
//   `expo-secure-store`, which is backed by Keychain (iOS) / Keystore
//   (Android). Never in SQLite, never in AsyncStorage.
// - Non-sensitive preferences (biometric_enabled flag) also live in
//   SecureStore so they share a lifecycle with the PIN.
// - PINs are NEVER stored in plain form. We store `SHA-256(salt || pin)` plus
//   the salt. SHA-256 is not ideal for password hashing on a server, but we
//   only have 4-6 numeric digits with a brute-force space of 10^6, and the
//   device already enforces:
//     (a) storage is in Keystore/Keychain (hardware-isolated)
//     (b) attempt-count lockout (5 tries -> 30 min)
//   Given those controls, a per-PIN salt + SHA-256 meaningfully raises cost
//   for attackers who only have the ciphertext. If `expo-crypto` exposes
//   Argon2/PBKDF2 in a future SDK, swap the KDF here; the salt field is
//   already in place.
// - When SecureStore is unavailable (SSR, web, failing keystore), we fall
//   back to AsyncStorage for NON-SENSITIVE flags only. PIN hashing refuses
//   to operate if SecureStore is unavailable (fail-closed).

import { parseOrThrow, PinSchema } from '@/lib/validation';

type SecureStoreLike = {
  setItemAsync: (key: string, value: string) => Promise<void>;
  getItemAsync: (key: string) => Promise<string | null>;
  deleteItemAsync: (key: string) => Promise<void>;
  isAvailableAsync?: () => Promise<boolean>;
};

type CryptoLike = {
  digestStringAsync: (algorithm: string, data: string) => Promise<string>;
  getRandomBytesAsync: (byteCount: number) => Promise<Uint8Array>;
  CryptoDigestAlgorithm?: { SHA256: string };
};

type AsyncStorageLike = {
  setItem: (k: string, v: string) => Promise<void>;
  getItem: (k: string) => Promise<string | null>;
  removeItem: (k: string) => Promise<void>;
};

let cachedStore: SecureStoreLike | null | undefined;
let cachedCrypto: CryptoLike | null | undefined;
let cachedAsync: AsyncStorageLike | null | undefined;

/** Lazy require so non-native test environments don't crash. */
function loadSecureStore(): SecureStoreLike | null {
  if (cachedStore !== undefined) return cachedStore;
  try {
    cachedStore = require('expo-secure-store') as SecureStoreLike;
  } catch {
    cachedStore = null;
  }
  return cachedStore;
}

function loadCrypto(): CryptoLike | null {
  if (cachedCrypto !== undefined) return cachedCrypto;
  try {
    cachedCrypto = require('expo-crypto') as CryptoLike;
  } catch {
    cachedCrypto = null;
  }
  return cachedCrypto;
}

function loadAsyncStorage(): AsyncStorageLike | null {
  if (cachedAsync !== undefined) return cachedAsync;
  try {
    const mod = require('@react-native-async-storage/async-storage');
    cachedAsync = (mod.default ?? mod) as AsyncStorageLike;
  } catch {
    cachedAsync = null;
  }
  return cachedAsync;
}

/** Where the Supabase client persists the signed-in session (src/lib/supabase.ts). */
export const SESSION_STORAGE_KEY = 'sl.supabase.auth';

/** Keys — keep them stable across releases, namespaced. */
export const SecureKeys = {
  PIN_HASH: 'sl.pin.hash.v2',
  PIN_SALT: 'sl.pin.salt.v2',
  BIOMETRIC_ENABLED: 'sl.biometric.enabled',
  LAST_LOCK_TIME: 'sl.lock.last',
  PIN_FAILED_ATTEMPTS: 'sl.pin.failed.v1',
  PIN_LOCKOUT_UNTIL: 'sl.pin.lockout.v1',
} as const;

/* ---------- Availability ---------- */

export async function isSecureStoreAvailable(): Promise<boolean> {
  const s = loadSecureStore();
  if (!s) return false;
  if (s.isAvailableAsync) {
    try {
      return await s.isAvailableAsync();
    } catch {
      return false;
    }
  }
  return true;
}

/* ---------- Low-level KV (non-sensitive fallback-capable) ---------- */

async function kvSet(key: string, value: string, sensitive: boolean): Promise<void> {
  const s = loadSecureStore();
  if (s) {
    try {
      await s.setItemAsync(key, value);
      return;
    } catch (e) {
      if (sensitive) throw e;
    }
  }
  if (sensitive) {
    throw new Error('SecureStore unavailable; refusing to store sensitive data.');
  }
  const a = loadAsyncStorage();
  if (!a) throw new Error('No storage backend available.');
  await a.setItem(key, value);
}

async function kvGet(key: string, sensitive: boolean): Promise<string | null> {
  const s = loadSecureStore();
  if (s) {
    try {
      return await s.getItemAsync(key);
    } catch (e) {
      if (sensitive) throw e;
    }
  }
  if (sensitive) return null;
  const a = loadAsyncStorage();
  if (!a) return null;
  return a.getItem(key);
}

async function kvDelete(key: string, sensitive: boolean): Promise<void> {
  const s = loadSecureStore();
  if (s) {
    try {
      await s.deleteItemAsync(key);
      return;
    } catch (e) {
      if (sensitive) throw e;
    }
  }
  if (sensitive) return;
  const a = loadAsyncStorage();
  if (!a) return;
  await a.removeItem(key);
}

/* ---------- Hashing ---------- */

function bytesToHex(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i++) {
    out += bytes[i].toString(16).padStart(2, '0');
  }
  return out;
}

async function generateSalt(lenBytes = 16): Promise<string> {
  const c = loadCrypto();
  if (!c) throw new Error('expo-crypto is required for secure PIN handling');
  const bytes = await c.getRandomBytesAsync(lenBytes);
  return bytesToHex(bytes);
}

async function sha256Hex(input: string): Promise<string> {
  const c = loadCrypto();
  if (!c) throw new Error('expo-crypto is required for secure PIN handling');
  const algo = c.CryptoDigestAlgorithm?.SHA256 ?? 'SHA-256';
  return c.digestStringAsync(algo, input);
}

export async function hashPin(pin: string, salt: string): Promise<string> {
  // Iterate SHA-256 a fixed number of rounds. Not PBKDF2-strength, but at
  // 10,000 rounds on a mobile CPU this still costs tens of milliseconds per
  // guess — meaningful alongside the attempt-count lockout.
  const rounds = 10_000;
  let current = `${salt}|${pin}`;
  for (let i = 0; i < rounds; i++) {
    current = await sha256Hex(current);
  }
  return current;
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

/* ---------- PIN API ---------- */

export async function setPin(pin: string): Promise<void> {
  const clean = parseOrThrow(PinSchema, pin, 'PIN');
  if (!(await isSecureStoreAvailable())) {
    throw new Error('Secure storage unavailable on this device.');
  }
  const salt = await generateSalt();
  const hash = await hashPin(clean, salt);
  await kvSet(SecureKeys.PIN_SALT, salt, true);
  await kvSet(SecureKeys.PIN_HASH, hash, true);
  await kvDelete(SecureKeys.PIN_FAILED_ATTEMPTS, true);
  await kvDelete(SecureKeys.PIN_LOCKOUT_UNTIL, true);
}

export async function verifyPin(pin: string): Promise<boolean> {
  const parsed = PinSchema.safeParse(pin);
  if (!parsed.success) return false;
  const salt = await kvGet(SecureKeys.PIN_SALT, true);
  const stored = await kvGet(SecureKeys.PIN_HASH, true);
  if (!salt || !stored) return false;
  const candidate = await hashPin(parsed.data, salt);
  return constantTimeEqual(candidate, stored);
}

export async function clearPin(): Promise<void> {
  await kvDelete(SecureKeys.PIN_HASH, true);
  await kvDelete(SecureKeys.PIN_SALT, true);
  await kvDelete(SecureKeys.PIN_FAILED_ATTEMPTS, true);
  await kvDelete(SecureKeys.PIN_LOCKOUT_UNTIL, true);
}

export async function hasPin(): Promise<boolean> {
  const h = await kvGet(SecureKeys.PIN_HASH, true);
  return !!h;
}

/* ---------- Biometric flag ---------- */

export async function isBiometricEnabled(): Promise<boolean> {
  const v = await kvGet(SecureKeys.BIOMETRIC_ENABLED, false);
  return v === '1';
}

export async function setBiometricEnabled(val: boolean): Promise<void> {
  await kvSet(SecureKeys.BIOMETRIC_ENABLED, val ? '1' : '0', false);
}

/* ---------- Lockout state (used by rateLimiter) ---------- */

export async function readFailedAttempts(): Promise<number> {
  const v = await kvGet(SecureKeys.PIN_FAILED_ATTEMPTS, true);
  if (!v) return 0;
  const n = parseInt(v, 10);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

export async function writeFailedAttempts(n: number): Promise<void> {
  await kvSet(SecureKeys.PIN_FAILED_ATTEMPTS, String(Math.max(0, Math.floor(n))), true);
}

export async function readLockoutUntil(): Promise<number | null> {
  const v = await kvGet(SecureKeys.PIN_LOCKOUT_UNTIL, true);
  if (!v) return null;
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : null;
}

export async function writeLockoutUntil(epochMs: number | null): Promise<void> {
  if (epochMs == null) {
    await kvDelete(SecureKeys.PIN_LOCKOUT_UNTIL, true);
    return;
  }
  await kvSet(SecureKeys.PIN_LOCKOUT_UNTIL, String(Math.floor(epochMs)), true);
}

/* ---------- Last-lock time ---------- */

export async function readLastLockTime(): Promise<number | null> {
  const v = await kvGet(SecureKeys.LAST_LOCK_TIME, true);
  if (!v) return null;
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : null;
}

export async function writeLastLockTime(epochMs: number): Promise<void> {
  await kvSet(SecureKeys.LAST_LOCK_TIME, String(Math.floor(epochMs)), true);
}

/* ---------- Full erasure (used by privacy.eraseAllData) ---------- */

export async function deleteKeyFromAllStores(key: string): Promise<void> {
  const s = loadSecureStore();
  if (s) {
    try {
      await s.deleteItemAsync(key);
    } catch {
      // best-effort
    }
  }
  const a = loadAsyncStorage();
  if (a) {
    try {
      await a.removeItem(key);
    } catch {
      // best-effort
    }
  }
}

export async function wipeSecureStore(): Promise<void> {
  for (const key of Object.values(SecureKeys)) {
    await deleteKeyFromAllStores(key);
  }
}
