// Compliance audit service. Web posts to /api/audit (Next.js → audit-record Edge
// Function). Mobile invokes audit-record directly. Client-side redaction is
// defense in depth before the server allowlist + insert.

import { getSupabase } from '@/lib/supabase';
import { AppError } from '@/lib/errors';

function isNextWebClient(): boolean {
  return typeof window !== 'undefined' && !!process.env.NEXT_PUBLIC_SUPABASE_URL;
}

/** Supabase gateway and Next.js may surface 204 as 200 on success. */
export function isAuditSuccessStatus(status: number): boolean {
  return status === 204 || status === 200;
}

const PII_KEY_DENYLIST = new Set<string>([
  'password',
  'pass',
  'passwd',
  'pwd',
  'token',
  'access_token',
  'refresh_token',
  'id_token',
  'bearer',
  'jwt',
  'otp',
  'code',
  'secret',
  'api_key',
  'apikey',
  'client_secret',
  'cookie',
  'set-cookie',
  'authorization',
  'email',
  'phone',
  'msisdn',
  'ssn',
  'aadhaar',
  'pan',
  'notes',
  'note',
  'comment',
]);

const MAX_VALUE_LEN = 200;
const MAX_PROPS_KEYS = 16;
const MAX_PROPS_BYTES = 3500; // < 4 KB DB cap with headroom

/**
 * Curated event registry. Adding a new audit event here is the only way to
 * record it; this keeps the audit_events.event_type domain auditable.
 */
export type AuditEventType =
  | 'consent_accepted'
  | 'consent_revoked'
  | 'onboarding_completed'
  | 'account_data_exported_requested'
  | 'account_data_erased_requested'
  | 'account_delete_requested'
  | 'password_reset_requested'
  | 'password_changed'
  | 'discreet_mode_toggled'
  | 'app_lock_enabled'
  | 'app_lock_disabled'
  | 'reminder_enabled'
  | 'reminder_disabled'
  | 'ledger_chat_consent_toggled';

export type AuditEventCategory =
  | 'account'
  | 'compliance'
  | 'auth'
  | 'privacy'
  | 'preferences';

export interface AuditEventPropsMap {
  consent_accepted: { termsVersion?: string; privacyVersion?: string };
  consent_revoked: { reason?: string };
  onboarding_completed: { goalSet?: boolean };
  account_data_exported_requested: { format?: 'json' | 'csv' };
  account_data_erased_requested: Record<string, never>;
  account_delete_requested: Record<string, never>;
  password_reset_requested: Record<string, never>;
  password_changed: Record<string, never>;
  discreet_mode_toggled: { enabled: boolean };
  app_lock_enabled: Record<string, never>;
  app_lock_disabled: Record<string, never>;
  reminder_enabled: { kind: string };
  reminder_disabled: { kind: string };
  // Consent to send ledger figures to the AI processor (Ask the ledger), with
  // the privacy-policy version and the notice version (LEDGER_CHAT_NOTICE_VERSION) it rested on.
  ledger_chat_consent_toggled: { enabled: boolean; privacyVersion?: string; noticeVersion?: string };
}

function isPrimitive(value: unknown): value is string | number | boolean | null {
  return (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  );
}

export function redactAuditProps(props: Record<string, unknown> | undefined | null): Record<string, unknown> {
  if (!props || typeof props !== 'object') return {};
  const out: Record<string, unknown> = {};
  let keys = 0;
  for (const rawKey of Object.keys(props)) {
    if (keys >= MAX_PROPS_KEYS) break;
    const lowered = rawKey.toLowerCase();
    if (PII_KEY_DENYLIST.has(lowered)) continue;
    const value = (props as Record<string, unknown>)[rawKey];
    if (!isPrimitive(value)) continue;
    if (typeof value === 'string') {
      out[rawKey] = value.length > MAX_VALUE_LEN ? value.slice(0, MAX_VALUE_LEN) : value;
    } else {
      out[rawKey] = value;
    }
    keys += 1;
  }
  // Final size guard: if serialized output exceeds budget, drop keys from the end
  // until it fits.
  while (
    Object.keys(out).length > 0 &&
    new Blob([JSON.stringify(out)]).size > MAX_PROPS_BYTES
  ) {
    const lastKey = Object.keys(out).pop();
    if (lastKey) delete out[lastKey];
  }
  return out;
}

async function postAuditToEdge(
  eventType: string,
  eventCategory: string,
  safeProps: Record<string, unknown>,
): Promise<void> {
  const supabase = getSupabase();
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;
  if (!accessToken) {
    throw new AppError('authentication_error', 'audit_not_signed_in');
  }

  const { error } = await supabase.functions.invoke('audit-record', {
    body: {
      event_type: eventType,
      event_category: eventCategory,
      props: safeProps,
    },
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (error) {
    throw new AppError('dependency_failure', `audit_failed:${error.message}`);
  }
}

export async function recordAuditEvent<K extends AuditEventType>(
  eventType: K,
  eventCategory: AuditEventCategory = 'account',
  props?: K extends keyof AuditEventPropsMap ? AuditEventPropsMap[K] : Record<string, unknown>,
): Promise<void> {
  const safeProps = redactAuditProps(props as Record<string, unknown> | undefined);

  if (isNextWebClient()) {
    const res = await fetch('/api/audit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventType, eventCategory, props: safeProps }),
    });
    if (isAuditSuccessStatus(res.status)) return;
    if (res.status === 429) {
      throw new AppError('rate_limited', 'audit_rate_limited');
    }
    if (res.status === 401) {
      throw new AppError('authentication_error', 'audit_not_signed_in');
    }
    throw new AppError('dependency_failure', `audit_failed:${res.status}`);
  }

  await postAuditToEdge(eventType, eventCategory, safeProps);
}
