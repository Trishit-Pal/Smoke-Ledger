import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { signParts } from '@web/components/marketing/scene/sign';

describe('signParts', () => {
  it('slants the bar at 45 degrees', () => {
    expect(signParts().bar.angleRad).toBe(Math.PI / 4);
  });

  it('gives a ring with a tube thinner than its radius, and a bar long enough to span it', () => {
    const { ring, bar } = signParts();
    expect(ring.tube).toBeGreaterThan(0);
    expect(ring.tube).toBeLessThan(ring.radius);
    expect(bar.length).toBeGreaterThanOrEqual(2 * (ring.radius - ring.tube));
    expect(bar.thickness).toBeGreaterThan(0);
  });

  it('carries no colour literals (colours come from CSS custom properties)', () => {
    const src = readFileSync(resolve(__dirname, '../components/marketing/scene/sign.ts'), 'utf8');
    expect(src).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(src).not.toMatch(/rgba?\(/);
  });
});
