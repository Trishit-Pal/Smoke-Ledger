import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  getHomeSignals,
  publishHomeSignals,
  subscribeHomeSignals,
  type HomeSignals,
} from '@web/components/marketing/scene/sceneSignals';

const SIGNALS: HomeSignals = { fill: 0.4, label: '•••', underBaselineYesterday: true, lastSmokeIso: null };

describe('sceneSignals store', () => {
  afterEach(() => publishHomeSignals(null));

  it('notifies subscribers on publish and returns the last value', () => {
    const fn = vi.fn();
    const off = subscribeHomeSignals(fn);
    publishHomeSignals(SIGNALS);
    expect(fn).toHaveBeenCalledWith(SIGNALS);
    expect(getHomeSignals()).toBe(SIGNALS);
    off();
  });

  it('stops notifying after unsubscribe', () => {
    const fn = vi.fn();
    subscribeHomeSignals(fn)();
    publishHomeSignals(SIGNALS);
    expect(fn).not.toHaveBeenCalled();
  });

  it('clears the value on publish(null)', () => {
    publishHomeSignals(SIGNALS);
    publishHomeSignals(null);
    expect(getHomeSignals()).toBeNull();
  });
});

describe('DashboardClient publishes to the scene', () => {
  const src = readFileSync(join(__dirname, '..', 'app', '(app)', 'dashboard', 'DashboardClient.tsx'), 'utf8');

  it('publishes inside an effect and clears on cleanup', () => {
    expect(src).toMatch(/React\.useEffect\(\(\) => \{[\s\S]*?publishHomeSignals\(\{[\s\S]*?return \(\) => publishHomeSignals\(null\)/);
  });

  it('publishes null in discreet mode', () => {
    expect(src).toMatch(/if \(discreet\) \{\s*publishHomeSignals\(null\);/);
    expect(src).toMatch(/const discreet = isDiscreetMode\(profile\)/);
  });

  it('builds the label with maskInr over the hide-totals flag, never raw money', () => {
    expect(src).toMatch(/const sceneLabel = maskInr\(allTimeSaved\.totalInr, hidden, /);
    expect(src).toMatch(/label: sceneLabel/);
  });

  it('derives fill, lastSmokeIso and the grain signal from the existing values', () => {
    expect(src).toMatch(/jarFill\(allTimeSaved\.totalInr, baseline, fallbackUnit\)/);
    expect(src).toMatch(/lastSmokeIso: last\?\.tsUtc \?\? null/);
    // No grain on day one: the rule (rows exist, yesterday is on/after onboarding) lives in grainEligible.
    expect(src).toMatch(/grainEligible\(summary, baseline, today, summarySinceYmd\)/);
  });
});
