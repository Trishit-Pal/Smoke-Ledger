import { readFileSync } from 'fs';
import path from 'path';
import { describe, expect, test } from 'vitest';

// Deleting the CSRF guard must not leave every test green: pin that the audit
// route calls requireSameOrigin, and does so before it reads the body.
const src = readFileSync(path.resolve(__dirname, '..', 'app/api/audit/route.ts'), 'utf8');

describe('audit route CSRF guard', () => {
  test('calls requireSameOrigin before parsing the body', () => {
    const guard = src.indexOf('requireSameOrigin(request)');
    const parse = src.indexOf('auditBodySchema.safeParse');
    expect(guard).toBeGreaterThan(-1);
    expect(parse).toBeGreaterThan(-1);
    expect(guard).toBeLessThan(parse);
  });
});
