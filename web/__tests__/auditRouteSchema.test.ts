import { describe, expect, test } from 'vitest';
import { auditBodySchema } from '@web/app/api/audit/schema';

// Security review F4: the schema accepted free keys and unbounded strings, so a
// future caller could write {question: "<user prose>"} into audit_events (DPDP).
describe('auditBodySchema props', () => {
  test('rejects a prop value longer than 200 chars', () => {
    const r = auditBodySchema.safeParse({ eventType: 'x', props: { note: 'a'.repeat(201) } });
    expect(r.success).toBe(false);
  });
  test('rejects a prop key outside the allowlist', () => {
    const r = auditBodySchema.safeParse({ eventType: 'x', props: { question: 'how much' } });
    expect(r.success).toBe(false);
  });
  test('accepts the keys the app actually sends', () => {
    const r = auditBodySchema.safeParse({ eventType: 'x', props: { reason: 'user', count: 3, ok: true, prev: null } });
    expect(r.success).toBe(true);
  });
});
