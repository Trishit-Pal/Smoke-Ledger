import { describe, expect, it } from 'vitest';
import { isLocalStack } from '../e2e/_helpers/seed';

// The e2e helpers clear login rate-limit counters only on a local Supabase stack.
// This guard is what keeps that write off a hosted project.
describe('isLocalStack', () => {
  it('is true for the local stack hosts', () => {
    expect(isLocalStack('http://127.0.0.1:54321')).toBe(true);
    expect(isLocalStack('http://localhost:54321')).toBe(true);
  });

  it('is false for a hosted project', () => {
    expect(isLocalStack('https://abc.supabase.co')).toBe(false);
  });

  it('is false for a look-alike host', () => {
    expect(isLocalStack('https://localhost.evil.example')).toBe(false);
    expect(isLocalStack('https://127.0.0.1.supabase.co')).toBe(false);
  });

  it('is false for a malformed or empty URL', () => {
    expect(isLocalStack('not a url')).toBe(false);
    expect(isLocalStack('')).toBe(false);
  });
});
