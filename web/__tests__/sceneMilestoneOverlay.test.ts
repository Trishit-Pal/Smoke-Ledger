import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  AIRWAY_LIGHT_MS,
  airwayLightLevel,
  createAirwayLight,
} from '@web/components/marketing/scene/airwayLight';
import { MilestoneNote, MilestoneOverlay } from '@web/components/marketing/scene/MilestoneOverlay';
import { OVERLAY_ANCHOR } from '@web/components/marketing/scene/layout';
import { requestAirwayLight, subscribeAirwayLight } from '@web/components/marketing/scene/sceneSignals';

const MARKETING = join(__dirname, '..', 'components', 'marketing');
const read = (...p: string[]) => readFileSync(join(MARKETING, ...p), 'utf8');
const overlaySrc = read('scene', 'MilestoneOverlay.tsx');
const backgroundSrc = read('SceneBackground.tsx');
const COLOUR_LITERAL = /#[0-9a-fA-F]{3,8}\b|\brgba?\(|\bhsla?\(|\b0x[0-9a-fA-F]{6}\b/;

describe('airwayLightLevel', () => {
  it('rises from 0 to 1 at the midpoint and returns to 0, ease-in-out', () => {
    expect(airwayLightLevel(0)).toBe(0);
    expect(airwayLightLevel(AIRWAY_LIGHT_MS / 2)).toBeCloseTo(1, 6);
    expect(airwayLightLevel(AIRWAY_LIGHT_MS)).toBeCloseTo(0, 6);
    // ease-in: the first tenth of the rise covers well under a tenth of the height
    expect(airwayLightLevel(AIRWAY_LIGHT_MS * 0.05)).toBeLessThan(0.1);
    expect(airwayLightLevel(AIRWAY_LIGHT_MS * 0.25)).toBeLessThan(airwayLightLevel(AIRWAY_LIGHT_MS * 0.4));
  });

  it('runs about 2.4 s', () => {
    expect(AIRWAY_LIGHT_MS).toBe(2400);
  });
});

describe('createAirwayLight', () => {
  it('animates once, ends at 0, and ignores start while running', () => {
    const apply = vi.fn();
    const light = createAirwayLight(apply);
    light.start(1000);
    light.start(1500); // no-op: already running, must not restart the clock
    light.tick(1000 + AIRWAY_LIGHT_MS / 2);
    expect(apply).toHaveBeenLastCalledWith(expect.closeTo(1, 6));
    light.tick(1000 + AIRWAY_LIGHT_MS + 1);
    expect(apply).toHaveBeenLastCalledWith(0);
    const calls = apply.mock.calls.length;
    light.tick(1000 + AIRWAY_LIGHT_MS + 50); // finished: nothing more to do
    expect(apply.mock.calls.length).toBe(calls);
    light.start(9000); // may run again once finished
    light.tick(9000 + AIRWAY_LIGHT_MS / 2);
    expect(apply).toHaveBeenLastCalledWith(expect.closeTo(1, 6));
  });

  it('does nothing before it is started', () => {
    const apply = vi.fn();
    createAirwayLight(apply).tick(100);
    expect(apply).not.toHaveBeenCalled();
  });
});

describe('airway light request channel', () => {
  it('delivers to a subscriber and stops after unsubscribe', () => {
    const fn = vi.fn();
    const off = subscribeAirwayLight(fn);
    requestAirwayLight();
    expect(fn).toHaveBeenCalledTimes(1);
    off();
    requestAirwayLight();
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('replays one request made before the scene (three.js loads late) subscribed', () => {
    const early = vi.fn();
    subscribeAirwayLight(early)(); // drain anything left pending by an earlier case
    requestAirwayLight();
    const fn = vi.fn();
    const off = subscribeAirwayLight(fn);
    expect(fn).toHaveBeenCalledTimes(1);
    off();
    const again = vi.fn();
    subscribeAirwayLight(again)();
    expect(again).not.toHaveBeenCalled(); // consumed, not replayed twice
  });
});

describe('MilestoneNote markup', () => {
  const html = renderToStaticMarkup(
    React.createElement(MilestoneNote, { text: 'Lung capacity begins to improve — in 3 h', caption: 'Next, from your last entry' }),
  );

  it('is aria-hidden, pointer-events none, hidden below the wide breakpoint', () => {
    expect(html).toMatch(/aria-hidden="true"/);
    expect(html).toMatch(/pointer-events:none/);
    expect(html).toMatch(/class="[^"]*hidden[^"]*min-\[1440px\]:block/);
  });

  it('carries the label and caption in their tokens', () => {
    expect(html).toContain('Lung capacity begins to improve — in 3 h');
    expect(html).toContain('Next, from your last entry');
    expect(html).toContain('var(--accent-ink)');
    expect(html).toContain('var(--text-faint)');
    expect(html).not.toMatch(COLOUR_LITERAL);
  });

  it('sits above the 91% veil (z-index 1), at the layout anchor', () => {
    expect(html).toMatch(/z-index:2/);
    expect(html).toContain(`top:${OVERLAY_ANCHOR.top}`);
  });
});

describe('MilestoneOverlay', () => {
  it('renders nothing on the server (the line needs the reader clock)', () => {
    expect(renderToStaticMarkup(React.createElement(MilestoneOverlay, { lastSmokeIso: '2026-11-04T00:00:00Z', intensity: 'quiet' }))).toBe('');
  });

  it('declines when discreet, under full intensity, or with no entries', () => {
    expect(overlaySrc).toMatch(/if \(discreet \|\| intensity === 'full'\) return false/);
    expect(overlaySrc).toMatch(/milestoneLine\(/);
    expect(overlaySrc).toMatch(/if \(!line\) return null/);
  });

  it('has no colour literals and uses the token pair', () => {
    expect(overlaySrc.replace(/\/\*[\s\S]*?\*\//g, '')).not.toMatch(COLOUR_LITERAL);
    expect(overlaySrc).toContain('var(--accent-ink)');
    expect(overlaySrc).toContain('var(--text-faint)');
  });

  it('re-computes once a minute, only while visible, and clears on unmount', () => {
    expect(overlaySrc).toMatch(/setInterval\([^)]*TICK_MS\)/);
    expect(overlaySrc).toMatch(/TICK_MS = 60_000/);
    expect(overlaySrc).toMatch(/document\.visibilityState === 'visible'/);
    expect(overlaySrc).toMatch(/clearInterval\(/);
  });

  it('reads the current signals on subscribe and applies a clear only on the next frame', () => {
    expect(overlaySrc).toMatch(/subscribeHomeSignals\(/);
    expect(overlaySrc).toMatch(/getHomeSignals\(\)/);
    expect(overlaySrc).toMatch(/requestAnimationFrame\(/);
    expect(overlaySrc).toMatch(/cancelAnimationFrame\(/);
  });

  it('requests the airway light only when a sweep is due and motion is allowed', () => {
    expect(overlaySrc).toMatch(/prefers-reduced-motion: reduce/);
    expect(overlaySrc).toMatch(/sweepDue\(window\.sessionStorage, [^)]+\)/);
    const reduce = overlaySrc.indexOf('prefers-reduced-motion');
    const sweep = overlaySrc.indexOf('sweepDue(window');
    const request = overlaySrc.indexOf('requestAirwayLight()');
    expect(reduce).toBeGreaterThan(-1);
    expect(sweep).toBeGreaterThan(reduce);
    expect(request).toBeGreaterThan(sweep);
  });
});

describe('wiring', () => {
  const backdrop = read('SceneBackdrop.tsx');

  afterEach(() => vi.restoreAllMocks());

  it('SceneBackdrop mounts the overlay next to the scene', () => {
    expect(backdrop).toMatch(/<MilestoneOverlay\s+lastSmokeIso=\{lastSmokeIso\}\s+discreet=\{discreet\}\s+intensity=\{intensity\}\s*\/>/);
  });

  it('SceneBackground subscribes to the airway light and drives it per frame', () => {
    expect(backgroundSrc).toMatch(/subscribeAirwayLight\(/);
    expect(backgroundSrc).toMatch(/createAirwayLight\(/);
    expect(backgroundSrc).toMatch(/light\.tick\(/);
    expect(backgroundSrc).toMatch(/setAirwayGlow/);
  });

  it('keeps SceneBackground.tsx at 400 lines or fewer', () => {
    expect(backgroundSrc.split('\n').length).toBeLessThanOrEqual(401); // trailing newline
  });

  it('exposes the glow handle from the lungs', () => {
    expect(read('scene', 'lungMeshes.ts')).toMatch(/setAirwayGlow\(level: number\): void/);
  });

  it('puts the overlay under the desktop lungs, in the right gutter', () => {
    expect(OVERLAY_ANCHOR.right).toBeTruthy();
    expect(OVERLAY_ANCHOR.top).toMatch(/%$/);
  });
});
