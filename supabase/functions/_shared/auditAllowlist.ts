// Keep in sync with src/services/audit.ts AuditEventType / AuditEventCategory.

export const AUDIT_EVENT_TYPES = new Set<string>([
  'consent_accepted',
  'consent_revoked',
  'onboarding_completed',
  'account_data_exported_requested',
  'account_data_erased_requested',
  'account_delete_requested',
  'password_reset_requested',
  'password_changed',
  'discreet_mode_toggled',
  'app_lock_enabled',
  'app_lock_disabled',
  'reminder_enabled',
  'reminder_disabled',
  'phone_otp_sent',
  'phone_otp_verified',
  'phone_otp_rate_limited',
]);

export const AUDIT_EVENT_CATEGORIES = new Set<string>([
  'account',
  'compliance',
  'auth',
  'privacy',
  'preferences',
]);

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
const MAX_PROPS_BYTES = 3500;

function isPrimitive(value: unknown): value is string | number | boolean | null {
  return (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  );
}

/**
 * Rows written through audit-record are claims the signed-in user made about
 * their own account, not facts the server observed. Stamp them so a reviewer can
 * tell them from server-written compliance rows (erase / delete). The stamp is
 * applied last, so a client-supplied `source` cannot pose as a server row.
 */
export function markClientReported(props: Record<string, unknown>): Record<string, unknown> {
  return { ...props, source: 'client_reported' };
}

export function redactAuditProps(
  props: Record<string, unknown> | undefined | null,
): Record<string, unknown> {
  if (!props || typeof props !== 'object') return {};
  const out: Record<string, unknown> = {};
  let keys = 0;
  for (const rawKey of Object.keys(props)) {
    if (keys >= MAX_PROPS_KEYS) break;
    const lowered = rawKey.toLowerCase();
    if (PII_KEY_DENYLIST.has(lowered)) continue;
    const value = props[rawKey];
    if (!isPrimitive(value)) continue;
    if (typeof value === 'string') {
      out[rawKey] = value.length > MAX_VALUE_LEN ? value.slice(0, MAX_VALUE_LEN) : value;
    } else {
      out[rawKey] = value;
    }
    keys += 1;
  }
  while (
    Object.keys(out).length > 0 &&
    new TextEncoder().encode(JSON.stringify(out)).length > MAX_PROPS_BYTES
  ) {
    const lastKey = Object.keys(out).pop();
    if (lastKey) delete out[lastKey];
  }
  return out;
}
