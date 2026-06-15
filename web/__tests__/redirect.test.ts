import { describe, it, expect } from 'vitest';
import { sanitizeNextPath, isAllowedNextPath } from '@web/lib/auth/redirect';

describe('sanitizeNextPath', () => {
  it('returns the path as-is for allowlisted paths', () => {
    expect(sanitizeNextPath('/dashboard')).toBe('/dashboard');
    expect(sanitizeNextPath('/settings')).toBe('/settings');
    expect(sanitizeNextPath('/log')).toBe('/log');
  });

  it('preserves query strings when the pathname is allowlisted', () => {
    expect(sanitizeNextPath('/settings?action=delete')).toBe('/settings?action=delete');
    expect(sanitizeNextPath('/log?ref=widget')).toBe('/log?ref=widget');
  });

  it('falls back to /dashboard for null', () => {
    expect(sanitizeNextPath(null)).toBe('/dashboard');
  });

  it('falls back for absolute URLs', () => {
    expect(sanitizeNextPath('https://evil.com')).toBe('/dashboard');
    expect(sanitizeNextPath('http://evil.com/settings')).toBe('/dashboard');
  });

  it('falls back for protocol-relative paths', () => {
    expect(sanitizeNextPath('//evil.com')).toBe('/dashboard');
  });

  it('falls back for paths not in the allowlist', () => {
    expect(sanitizeNextPath('/admin')).toBe('/dashboard');
    expect(sanitizeNextPath('/onboarding')).toBe('/dashboard');
    expect(sanitizeNextPath('/Dashboard')).toBe('/dashboard');
  });

  it('rejects paths with ASCII control characters', () => {
    expect(sanitizeNextPath('/settings\r\nX-Injected: header')).toBe('/dashboard');
    expect(sanitizeNextPath('/settings\x00null')).toBe('/dashboard');
  });

  it('honours a custom fallback', () => {
    expect(sanitizeNextPath(null, '/login')).toBe('/login');
    expect(sanitizeNextPath('/admin', '/login')).toBe('/login');
  });
});

describe('isAllowedNextPath', () => {
  it('returns true for allowlisted paths', () => {
    expect(isAllowedNextPath('/dashboard')).toBe(true);
    expect(isAllowedNextPath('/settings')).toBe(true);
  });

  it('returns false for non-allowlisted paths', () => {
    expect(isAllowedNextPath('/admin')).toBe(false);
    expect(isAllowedNextPath(null)).toBe(false);
    expect(isAllowedNextPath('https://evil.com')).toBe(false);
  });
});
