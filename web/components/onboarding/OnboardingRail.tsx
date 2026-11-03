'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ThemeToggle } from '@web/components/layout/ThemeToggle';

export type OnboardingStepKey = 'welcome' | 'privacy' | 'usage' | 'goal' | 'brands' | 'done';

function pathnameToStep(pathname: string | null): OnboardingStepKey {
  if (!pathname) return 'welcome';
  if (pathname === '/onboarding' || pathname === '/onboarding/') return 'welcome';
  if (pathname.startsWith('/onboarding/privacy')) return 'privacy';
  if (
    pathname.startsWith('/onboarding/usage') ||
    pathname.startsWith('/onboarding/baseline') ||
    pathname.startsWith('/onboarding/setup')
  )
    return 'usage';
  if (pathname.startsWith('/onboarding/goal')) return 'goal';
  if (pathname.startsWith('/onboarding/brands')) return 'brands';
  if (pathname.startsWith('/onboarding/done')) return 'done';
  return 'welcome';
}

interface StepEntry {
  key: OnboardingStepKey;
  index: string;
  label: string;
  href: string | null;
}

const STEPS: StepEntry[] = [
  { key: 'welcome', index: '00', label: 'Welcome', href: '/onboarding' },
  { key: 'privacy', index: '01', label: 'Privacy', href: '/onboarding/privacy' },
  { key: 'usage', index: '02', label: 'Baseline', href: '/onboarding/usage' },
  { key: 'goal', index: '03', label: 'Goal', href: '/onboarding/goal' },
  { key: 'brands', index: '04', label: 'Brands', href: '/onboarding/brands' },
  { key: 'done', index: '05', label: 'Done', href: null },
];

/**
 * Below md the rail is hidden, so phones get this instead: a single hairline
 * that fills with the journey (ink, not accent — progress isn't a "win"), plus
 * a small-caps caption. Same step source as the rail, so the two never disagree.
 */
export function OnboardingProgress() {
  const pathname = usePathname();
  const activeStep = pathnameToStep(pathname);
  const i = STEPS.findIndex((s) => s.key === activeStep);
  const last = STEPS.length - 1;
  return (
    <div className="md:hidden mb-lg flex flex-col gap-xs">
      <div
        role="progressbar"
        aria-label="Onboarding progress"
        aria-valuemin={1}
        aria-valuemax={STEPS.length}
        aria-valuenow={i + 1}
        aria-valuetext={`${STEPS[i].label}, step ${i + 1} of ${STEPS.length}`}
        className="relative h-px w-full"
        style={{ background: 'var(--rule)' }}
      >
        <div
          className="absolute inset-y-0 left-0 transition-[width] duration-[720ms] ease-[var(--ease-editorial)] motion-reduce:transition-none"
          style={{ width: `${(i / last) * 100}%`, background: 'var(--text)' }}
        />
      </div>
      {/* Same folio as the rail ("00 · Welcome"), not a wizard counter. */}
      <span className="editorial-caption nums-tabular" aria-hidden>
        {STEPS[i].index} · {STEPS[i].label}
      </span>
    </div>
  );
}

export function OnboardingRail() {
  const pathname = usePathname();
  const activeStep = pathnameToStep(pathname);
  return (
    <aside
      className="hidden md:flex flex-col gap-xl"
      style={{
        width: 280,
        flexShrink: 0,
        borderRight: '1px solid var(--rule)',
        padding: '32px 28px',
        background: 'var(--bg)',
        minHeight: '100dvh',
        position: 'sticky',
        top: 0,
      }}
    >
      <header className="flex flex-col gap-md">
        <div className="flex items-start justify-between gap-md">
          <div className="flex flex-col gap-xs">
            <span
              style={{
                fontFamily: 'var(--font-display)',
                fontWeight: 400,
                fontSize: 22,
                letterSpacing: '-0.015em',
                color: 'var(--text)',
                lineHeight: 1.05,
              }}
            >
              Smoke<span style={{ fontStyle: 'italic', color: 'var(--accent-ink)' }}> Ledger</span>
            </span>
            <span className="editorial-caption">V3 · Onboarding</span>
          </div>
          <ThemeToggle placement="inline" />
        </div>
      </header>

      <nav aria-label="Onboarding steps" className="flex flex-col">
        <div
          aria-hidden
          style={{ borderTop: '1px solid var(--rule-strong)', marginBottom: 4 }}
        />
        {STEPS.map((step) => {
          const active = step.key === activeStep;
          const inner = (
            <div
              style={{
                display: 'flex',
                alignItems: 'baseline',
                gap: 14,
                padding: '14px 0',
                borderBottom: '1px solid var(--rule)',
                color: active ? 'var(--accent-ink)' : 'var(--text-muted)',
                transition: 'color 200ms ease',
              }}
            >
              <span
                className="editorial-caption-tight nums-tabular"
                style={{
                  color: active ? 'var(--accent-ink)' : 'var(--text-faint)',
                  minWidth: 22,
                }}
              >
                {step.index}
              </span>
              <span
                style={{
                  fontSize: 13,
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                  fontWeight: active ? 600 : 500,
                }}
              >
                {step.label}
              </span>
              {active ? (
                <span
                  aria-hidden
                  style={{
                    marginLeft: 'auto',
                    fontFamily: 'var(--font-display)',
                    fontStyle: 'italic',
                    fontSize: 12,
                    color: 'var(--accent-ink)',
                  }}
                >
                  ·
                </span>
              ) : null}
            </div>
          );
          return step.href ? (
            <Link
              key={step.key}
              href={step.href}
              prefetch={false}
              style={{ textDecoration: 'none' }}
            >
              {inner}
            </Link>
          ) : (
            <div key={step.key}>{inner}</div>
          );
        })}
      </nav>

      <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div
          aria-hidden
          style={{ borderTop: '1px solid var(--rule)', width: 32 }}
        />
        <p
          style={{
            fontFamily: 'var(--font-display)',
            fontStyle: 'italic',
            fontSize: 13,
            color: 'var(--text-muted)',
            lineHeight: 1.55,
            margin: 0,
          }}
        >
          &ldquo;Awareness is the first move. Nothing to prove today — just observe, log, learn.&rdquo;
        </p>
        <span className="editorial-caption-tight" style={{ color: 'var(--text-faint)' }}>
          Editor&rsquo;s note
        </span>
      </div>
    </aside>
  );
}

export default OnboardingRail;
