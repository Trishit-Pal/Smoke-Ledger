import { describe, expect, test } from 'vitest';
import { auditBodySchema } from '@web/app/api/audit/schema';

// Security review F4: the schema accepted free keys and unbounded strings, so a
// future caller could write {question: "<user prose>"} into audit_events (DPDP).
describe('auditBodySchema props', () => {
  test('rejects a prop value longer than 200 chars', () => {
    const r = auditBodySchema.safeParse({ eventType: 'x', props: { reason: 'a'.repeat(201) } });
    expect(r.success).toBe(false);
  });
  test('rejects a prop key outside the registered set', () => {
    const r = auditBodySchema.safeParse({ eventType: 'x', props: { question: 'how much' } });
    expect(r.success).toBe(false);
  });
  // Every key AuditEventPropsMap (src/services/audit.ts) registers must pass, or
  // the first caller of that event gets a 400 and a hard AppError.
  test.each([
    ['consent_accepted', { termsVersion: '2026-05-19', privacyVersion: '2026-05-19' }],
    ['consent_revoked', { reason: 'user' }],
    ['onboarding_completed', { goalSet: true }],
    ['account_data_exported_requested', { format: 'csv' }],
    ['discreet_mode_toggled', { enabled: false }],
    ['reminder_enabled', { kind: 'evening' }],
  ])('accepts the registered props of %s', (eventType, props) => {
    expect(auditBodySchema.safeParse({ eventType, props }).success).toBe(true);
  });
});
