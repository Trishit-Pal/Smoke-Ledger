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

  it('publishes no jar (empty label, zero fill) without a baseline, so "Kept: ₹0" never shows', () => {
    expect(src).toMatch(/const hasJar = baseline > 0;/);
    expect(src).toMatch(/const sceneLabel = hasJar \? maskInr\(/);
    expect(src).toMatch(/const sceneFill = hasJar \? jarFill\(/);
  });

  it('builds the label with maskInr over the hide-totals flag, never raw money', () => {
    expect(src).toMatch(/maskInr\(allTimeSaved\.totalInr, hidden, /);
    expect(src).toMatch(/label: sceneLabel/);
  });

  it('derives fill, lastSmokeIso and the grain signal from the existing values', () => {
    expect(src).toMatch(/jarFill\(allTimeSaved\.totalInr, baseline, fallbackUnit\)/);
    // A long-time quitter has no log in the 60-day window: fall back to the newest log overall.
    expect(src).toMatch(/const lastSmokeIso = last\?\.tsUtc \?\? latestLogIso;/);
    expect(src).toMatch(/lastSmokeIso,\r?\n/);
    expect(src).toMatch(/<HealthMilestones lastSmokeIso=\{lastSmokeIso\} \/>/);
    expect(src).not.toMatch(/last\?\.tsUtc \?\? null/);
    // No grain on day one: the rule (rows exist, yesterday is on/after onboarding) lives in grainEligible.
    expect(src).toMatch(/grainEligible\(summary, baseline, today, summarySinceYmd\)/);
  });
});

describe('Home learns the newest log beyond the 60-day window', () => {
  const data = readFileSync(join(__dirname, '..', 'lib', 'server', 'data.ts'), 'utf8');
  const page = readFileSync(join(__dirname, '..', 'app', '(app)', 'dashboard', 'page.tsx'), 'utf8');

  it('getDashboardData reads it alongside the other loaders (request-cached, shared with the scene)', () => {
    const body = data.slice(data.indexOf('export async function getDashboardData'));
    expect(body).toMatch(/getServerLatestLogIso\(\),\r?\n\s*\]\);/);
    expect(body).toMatch(/latestLogIso,\r?\n/);
  });

  it('the page hands it to DashboardClient', () => {
    expect(page).toMatch(/latestLogIso=\{latestLogIso\}/);
  });
});
