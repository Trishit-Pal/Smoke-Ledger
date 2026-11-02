import { z } from 'zod';

/**
 * Audit events are long-lived compliance rows (DPDP). Props are a closed set of
 * short, non-prose values so no caller can ever write user text — a question, a
 * note, a brand name — into audit_events. Add a key here deliberately; `.strict()`
 * rejects anything else.
 */
const propValue = z.union([z.string().max(200), z.number(), z.boolean(), z.null()]).optional();

export const auditBodySchema = z.object({
  eventType: z.string().min(1).max(80),
  eventCategory: z
    .enum(['account', 'compliance', 'auth', 'privacy', 'preferences'])
    .default('account'),
  // Exactly the keys AuditEventPropsMap (src/services/audit.ts) registers.
  // Register a key there first, then here; the test enumerates both.
  props: z
    .object({
      termsVersion: propValue, // consent_accepted
      privacyVersion: propValue, // consent_accepted
      reason: propValue, // consent_revoked
      goalSet: propValue, // onboarding_completed
      format: propValue, // account_data_exported_requested
      enabled: propValue, // discreet_mode_toggled / ledger_chat_consent_toggled
      kind: propValue, // reminder_enabled / reminder_disabled
    })
    .strict()
    .optional(),
});

export type AuditBody = z.infer<typeof auditBodySchema>;
