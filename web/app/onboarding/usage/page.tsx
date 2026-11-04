'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { DigitRoll } from '@web/components/onboarding/DigitRoll';
import { OnboardingStepFooter } from '@web/components/onboarding/OnboardingStepFooter';
import { setRegion } from '@/db/repositories/profile';
import { loadUsageStep, submitUsageStep } from '@/services/onboarding';
import { CountryField } from '@web/components/settings/CountryField';
import { isRegionPickerEnabled, regionChangeNeeded, regionFor } from '@/lib/regions';
import { formatMoney } from '@/lib/format';
import { isUsageDraftEmpty, useOnboardingDraft } from '@/store/onboardingDraft';
import { toSafeErrorMessage } from '@/lib/errors';

const PRICE_PER_STICK = 18;
const MAX_TICKS = 40;

interface WindowOption {
  id: 7 | 30;
  label: string;
  sub: string;
}

const WINDOW_OPTIONS: WindowOption[] = [
  { id: 7, label: '7 days', sub: 'Tight cycle' },
  { id: 30, label: '30 days', sub: 'Smoother trend' },
];

interface PurchaseOption {
  id: 'single' | 'pack' | 'mixed';
  label: string;
}

const PURCHASE_OPTIONS: PurchaseOption[] = [
  { id: 'single', label: 'Mostly singles' },
  { id: 'pack', label: 'Mostly packs' },
  { id: 'mixed', label: 'Mix of both' },
];

// An account with no country is the India ledger.
const INDIA_COUNTRY = 'IN';

export default function OnboardingUsagePage() {
  const router = useRouter();
  // Draft-backed so values survive back/forward navigation within the session.
  const {
    perDay: draftPerDay,
    windowDays: draftWindow,
    purchasePref: pref,
    setUsage,
  } = useOnboardingDraft();
  const perDay = draftPerDay != null ? String(draftPerDay) : '10';
  const windowDays = draftWindow ?? 30;
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  // Start from the saved country so going Back never silently switches it.
  const [savedCountry, setSavedCountry] = React.useState<string | null>(null);
  const [country, setCountry] = React.useState(INDIA_COUNTRY);
  const pickerOn = isRegionPickerEnabled();
  // Server is the source of truth: when the draft is empty (refresh, re-login,
  // Back after saving) seed it from what was saved. Un-saved edits always win.
  const draftEmpty = draftPerDay == null && draftWindow == null && pref == null;
  React.useEffect(() => {
    // Nothing to fetch: the draft already holds the values and no country field.
    if (!draftEmpty && !pickerOn) return;
    let cancelled = false;
    loadUsageStep()
      .then(({ profile, draft }) => {
        if (cancelled) return;
        setSavedCountry(profile.country ?? null);
        setCountry(profile.country ?? INDIA_COUNTRY);
        // Re-check at resolve time: an edit made while the load was in
        // flight must win over the server values.
        if (draft && isUsageDraftEmpty()) {
          setUsage({
            perDay: draft.perDay,
            windowDays: draft.windowDays,
            ...(draft.purchasePref ? { purchasePref: draft.purchasePref } : {}),
          });
        }
      })
      .catch(() => {
        // Keep the defaults; Continue will still save whatever the user picks.
      });
    return () => {
      cancelled = true;
    };
    // Mount-only: hydrate once; later edits live in the draft.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const region = regionFor(country);

  const n = Math.max(0, Math.min(MAX_TICKS, Number(perDay) || 0));
  const setPerDay = (value: string) =>
    setUsage({ perDay: Math.max(0, Math.min(MAX_TICKS, Number(value) || 0)) });
  const dailySpend = n * PRICE_PER_STICK;
  const yearlySpend = dailySpend * 365;

  const onContinue = async () => {
    const parsed = Number(perDay);
    if (!Number.isFinite(parsed) || parsed < 0) {
      setError('Enter a valid daily amount.');
      return;
    }
    if (!pref) return;
    setSubmitting(true);
    setError(null);
    try {
      // Country first: if it fails, the step has not advanced and the user
      // retries both. setRegion with an unchanged country is idempotent.
      // Once saved it is remembered, so a retry after a failed baseline write
      // does not run set_region (and its brand re-seed) a second time.
      if (pickerOn && regionChangeNeeded(savedCountry, country)) {
        await setRegion(country);
        setSavedCountry(country);
      }
      // Baseline + step advance land in one profile update (see submitUsageStep).
      await submitUsageStep({ perDay: parsed, windowDays, purchasePref: pref });
      router.push('/onboarding/goal');
    } catch (e) {
      setError(toSafeErrorMessage(e, 'dependency_failure'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="editorial-stage"
      style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 720 }}
    >
      <header style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <span className="editorial-caption">Step 02 · The baseline</span>
        <h2
          className="editorial-headline"
          style={{ fontSize: 'clamp(32px, 4vw, 44px)', margin: 0 }}
        >
          About how many a day?
        </h2>
        <p
          style={{
            fontSize: 14,
            color: 'var(--text-muted)',
            margin: 0,
            lineHeight: 1.55,
            maxWidth: 480,
          }}
        >
          One number is plenty. We&rsquo;ll use it for trends and savings — never to judge you.
        </p>
      </header>

      <CountryField value={country} onChange={setCountry} />

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(240px, 100%), 1fr))',
          gap: 24,
          alignItems: 'end',
          padding: '24px 0',
          borderTop: '1px solid var(--rule-strong)',
          borderBottom: '1px solid var(--rule)',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span className="editorial-caption">Sticks per day</span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
            <span
              className="editorial-numeral nums-tabular"
              style={{ fontSize: 'clamp(72px, 11vw, 128px)', color: 'var(--text)' }}
            >
              <DigitRoll value={n} />
            </span>
            <span style={{ fontSize: 14, color: 'var(--text-muted)' }}>per day</span>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span className="editorial-caption">That&rsquo;s about</span>
          <div
            className="nums-tabular"
            style={{
              fontSize: 22,
              color: 'var(--text)',
              fontFamily: 'var(--font-display)',
              display: 'flex',
              alignItems: 'baseline',
              gap: 6,
              flexWrap: 'wrap',
            }}
          >
            <span style={{ display: 'inline-flex', alignItems: 'baseline' }}>
              {pickerOn ? (
                region?.stickHint == null ? (
                  '—'
                ) : (
                  formatMoney(n * region.stickHint, region.currency, { locale: region.locale })
                )
              ) : (
                <>
                  ₹<DigitRoll value={dailySpend.toLocaleString('en-IN')} />
                </>
              )}
            </span>
            <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>/ day</span>
          </div>
          <div
            className="nums-tabular"
            style={{ fontSize: 13, color: 'var(--text-muted)', display: 'flex', gap: 4, flexWrap: 'wrap' }}
          >
            <span style={{ display: 'inline-flex', alignItems: 'baseline' }}>
              {pickerOn ? (
                region?.stickHint == null ? (
                  'A stick price appears once you log one.'
                ) : (
                  `≈ ${formatMoney(n * region.stickHint * 365, region.currency, { locale: region.locale })} a year`
                )
              ) : (
                <>
                  ≈ ₹<DigitRoll value={yearlySpend.toLocaleString('en-IN')} /> a year
                </>
              )}
            </span>
            {pickerOn ? null : (
              <span style={{ color: 'var(--text-faint)' }}>· at ₹{PRICE_PER_STICK}/stick</span>
            )}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            type="button"
            onClick={() => setPerDay(String(Math.max(0, n - 1)))}
            className="focus-ring"
            aria-label="Decrease"
            style={{
              width: 44,
              height: 44,
              borderRadius: 999,
              border: '1px solid var(--rule)',
              background: 'var(--bg-elevated)',
              cursor: 'pointer',
              fontSize: 18,
              color: 'var(--text-muted)',
              transition: 'border-color 160ms ease, color 160ms ease',
            }}
          >
            −
          </button>
          <input
            type="range"
            min={0}
            max={MAX_TICKS}
            value={n}
            onChange={(e) => setPerDay(e.target.value)}
            className="brand-range focus-ring"
            style={{ flex: 1 }}
            aria-label="Sticks per day"
          />
          <button
            type="button"
            onClick={() => setPerDay(String(Math.min(MAX_TICKS, n + 1)))}
            className="focus-ring"
            aria-label="Increase"
            style={{
              width: 44,
              height: 44,
              borderRadius: 999,
              border: '1px solid var(--rule)',
              background: 'var(--bg-elevated)',
              cursor: 'pointer',
              fontSize: 18,
              color: 'var(--text-muted)',
              transition: 'border-color 160ms ease, color 160ms ease',
            }}
          >
            +
          </button>
        </div>

        <div
          aria-hidden
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${MAX_TICKS}, 1fr)`,
            gap: 3,
            alignItems: 'end',
            height: 32,
            perspective: 400,
          }}
        >
          {Array.from({ length: MAX_TICKS }, (_, i) => i < n).map((on, i) => {
            const isMilestone = i % 5 === 4;
            return (
              <div
                key={i}
                style={{
                  height: on ? (isMilestone ? 24 : 14) : 4,
                  background: on
                    ? 'linear-gradient(to top, var(--accent), color-mix(in oklab, var(--accent) 70%, white))'
                    : 'var(--rule)',
                  opacity: on ? Math.max(0.55, 1 - i * 0.012) : 0.7,
                  borderRadius: 1,
                  transform: on ? `translateZ(${i * 0.6}px)` : 'translateZ(0)',
                  transformStyle: 'preserve-3d',
                  transition:
                    'height 360ms cubic-bezier(0.16, 1, 0.3, 1), background 140ms ease, opacity 200ms ease, transform 360ms cubic-bezier(0.16, 1, 0.3, 1)',
                  transitionDelay: `${i * 8}ms`,
                  boxShadow: on ? '0 1px 0 rgba(47,163,155,0.15)' : 'none',
                }}
              />
            );
          })}
        </div>

        <div
          className="nums-tabular"
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: 11,
            color: 'var(--text-faint)',
          }}
        >
          <span>0</span>
          <span>10</span>
          <span>20</span>
          <span>30</span>
          <span>40+</span>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <span className="editorial-caption">Compare progress over</span>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {WINDOW_OPTIONS.map((opt) => {
            const selected = windowDays === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => setUsage({ windowDays: opt.id })}
                className="focus-ring"
                style={{
                  flex: '1 1 200px',
                  textAlign: 'left',
                  padding: '14px 16px',
                  background: selected ? 'var(--accent-soft)' : 'var(--bg-elevated)',
                  border: selected ? '1px solid var(--accent)' : '1px solid var(--rule)',
                  borderRadius: 10,
                  cursor: 'pointer',
                  transition: 'background 140ms ease, border-color 140ms ease',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 2,
                }}
              >
                <span
                  style={{
                    fontSize: 14,
                    fontWeight: 600,
                    color: selected ? 'var(--accent-ink)' : 'var(--text)',
                  }}
                >
                  {opt.label}
                </span>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{opt.sub}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <span className="editorial-caption">How do you usually buy?</span>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {PURCHASE_OPTIONS.map((opt) => {
            const selected = pref === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => setUsage({ purchasePref: opt.id })}
                className="focus-ring hit-target"
                style={{
                  height: 34,
                  padding: '0 14px',
                  fontSize: 13,
                  borderRadius: 999,
                  border: selected ? '1px solid var(--accent)' : '1px solid var(--rule)',
                  background: selected ? 'var(--accent-soft)' : 'var(--bg-elevated)',
                  color: selected ? 'var(--accent-ink)' : 'var(--text-muted)',
                  fontFamily: 'var(--font-sans)',
                  fontWeight: 500,
                  cursor: 'pointer',
                  transition: 'all 140ms ease',
                }}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      {error ? (
        <p role="alert" style={{ fontSize: 13, color: 'var(--warn-earth-ink)', margin: 0 }}>
          {error}
        </p>
      ) : null}

      <OnboardingStepFooter
        onBack={() => router.push('/onboarding/privacy')}
        primary={{
          label: submitting ? 'Saving…' : 'Continue →',
          onPress: onContinue,
          disabled: !pref || submitting,
          loading: submitting,
        }}
      />
    </div>
  );
}
