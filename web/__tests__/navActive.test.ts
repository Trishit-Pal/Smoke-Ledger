import { describe, it, expect } from 'vitest';
import { isNavActive } from '@web/lib/nav';

describe('isNavActive', () => {
  it('matches the exact route and its children', () => {
    expect(isNavActive('/history', ['/history'])).toBe(true);
    expect(isNavActive('/history/2026-10-01', ['/history'])).toBe(true);
  });

  it('matches any extra prefix — the Ledger tab owns /log/*', () => {
    expect(isNavActive('/log/new', ['/history', '/log'])).toBe(true);
    expect(isNavActive('/log', ['/history', '/log'])).toBe(true);
  });

  it('does not match a sibling that merely shares a prefix', () => {
    expect(isNavActive('/logout', ['/history', '/log'])).toBe(false);
    expect(isNavActive('/goals', ['/history', '/log'])).toBe(false);
  });
});
