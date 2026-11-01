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
  props: z
    .object({
      // Sent today by consent_accepted (web/app/onboarding/privacy/page.tsx).
      termsVersion: propValue,
      privacyVersion: propValue,
      healthDisclaimerVersion: propValue,
      // Short, non-prose extras for future events.
      reason: propValue,
      count: propValue,
      ok: propValue,
      prev: propValue,
      next: propValue,
      step: propValue,
      source: propValue,
      version: propValue,
    })
    .strict()
    .optional(),
});

export type AuditBody = z.infer<typeof auditBodySchema>;
