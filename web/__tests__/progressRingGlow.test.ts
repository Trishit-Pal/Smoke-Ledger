import { describe, expect, test } from 'vitest';
import { ringGlow } from '@web/components/ui/ringGlow';

describe('ringGlow', () => {
  test('scales the halo with the ring so a 40px ring is not a 20% glow', () => {
    // 64px (default KPI ring) keeps the 8px halo it shipped with: 1/8 of size.
    expect(ringGlow(64)).toBe(8);
    // 40px (phone ring) gets a proportionally smaller halo.
    expect(ringGlow(40)).toBe(5);
  });

  test('drops the glow entirely under 48px when asked to read quiet', () => {
    expect(ringGlow(40, { quietBelow: 48 })).toBe(0);
    expect(ringGlow(64, { quietBelow: 48 })).toBe(8);
  });
});
