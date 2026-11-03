import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, test } from 'vitest';
import { ONBOARDING_STEPS, SETUP_STEPS } from '@web/components/onboarding/steps';

const read = (...p: string[]) => readFileSync(path.resolve(__dirname, '..', ...p), 'utf8');

describe('onboarding Welcome is a setup welcome, not the landing pitch', () => {
  const welcome = read('app', 'onboarding', 'page.tsx');

  test('drops the landing headline, the ghost numeral and the pillars', () => {
    for (const pitch of ['Know every stick', 'Spend less', 'Quit on your terms', '№.01', 'TiltCard', 'PILLARS']) {
      expect(welcome, `Welcome still contains "${pitch}"`).not.toContain(pitch);
    }
  });

  test('lists the four setup steps under the rail’s own labels, in order', () => {
    expect(SETUP_STEPS.map((s) => s.label)).toEqual(['Privacy', 'Baseline', 'Goal', 'Brands']);
    // Both read the one shared list, so a renamed step changes both.
    expect(welcome).toContain('SETUP_STEPS.map(');
    expect(read('components', 'onboarding', 'OnboardingRail.tsx')).toContain(
      "from '@web/components/onboarding/steps'",
    );
  });

  test('keeps Enter / → to continue and the editorial-stage entrance', () => {
    expect(welcome).toContain("e.key === 'Enter' || e.key === 'ArrowRight'");
    expect(welcome).toContain('editorial-stage');
  });
});

describe('sign-in and sign-up are distinct entry pages', () => {
  const layout = read('app', '(auth)', 'layout.tsx');
  const signup = read('app', '(auth)', 'signup', 'page.tsx');
  const login = read('app', '(auth)', 'login', 'page.tsx');

  test('auth pages carry a wordmark link home instead of the floating link', () => {
    expect(layout).toContain('showGoHome={false}');
    expect(layout).toMatch(/<Link\s+href="\/"/);
  });

  test('sign-up names the account step and the onboarding steps that follow', () => {
    expect(signup).toContain('data-setup-progress');
    expect(signup).toContain("['Account', ...ONBOARDING_STEPS");
    expect(ONBOARDING_STEPS.filter((s) => s.key !== 'welcome').map((s) => s.label)).toEqual([
      'Privacy',
      'Baseline',
      'Goal',
      'Brands',
      'Done',
    ]);
  });

  test('sign-in carries no setup signals', () => {
    expect(login).not.toContain('data-setup-progress');
    expect(login).not.toContain('Account · Sign in');
  });
});
