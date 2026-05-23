'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { DigitRoll } from '@web/components/onboarding/DigitRoll';
import { Stamp } from '@web/components/onboarding/Stamp';
import { OnboardingStepFooter } from '@web/components/onboarding/OnboardingStepFooter';
import { listBrands, toggleFavorite } from '@/db/repositories/brands';
import { updateProfile, setOnboardingStep } from '@/db/repositories/profile';
import { setSetting } from '@/db/repositories/settings';
import { recordAuditEvent } from '@/services/audit';
import { useSession } from '@/store/session';
import type { Brand, BrandCategory } from '@/types';
import { toSafeErrorMessage } from '@/lib/errors';

interface CategoryOption {
  id: BrandCategory | 'all';
  label: string;
}

const CATEGORIES: CategoryOption[] = [
  { id: 'all', label: 'All' },
  { id: 'budget', label: 'Budget' },
  { id: 'regular', label: 'Regular' },
  { id: 'premium', label: 'Premium' },
  { id: 'imported', label: 'Imported' },
];

const TOP_BRAND_NAMES = new Set([
  'Gold Flake',
  'Classic',
  'Marlboro',
  'Wills',
  'Navy Cut',
  'Capstan',
  'Four Square',
  'Red & White',
  'Camel',
  'Parliament',
  'Kent',
  'Winston',
]);

function SearchIcon() {
  return (
    <svg
      aria-hidden
      width="14"
      height="14"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <circle cx="9" cy="9" r="6" />
      <path d="M14 14 L18 18" strokeLinecap="round" />
    </svg>
  );
}

export default function OnboardingBrandsPage() {
  const router = useRouter();
  const refreshBrands = useSession((s) => s.refreshBrands);
  const refreshProfile = useSession((s) => s.refreshProfile);

  const [brands, setBrands] = React.useState<Brand[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [query, setQuery] = React.useState('');
  const [category, setCategory] = React.useState<BrandCategory | 'all'>('all');
  const [lastToggled, setLastToggled] = React.useState<{ id: string; t: number } | null>(null);

  React.useEffect(() => {
    void (async () => {
      try {
        setError(null);
        const rows = await listBrands();
        setBrands(rows);
      } catch (e) {
        setError(toSafeErrorMessage(e, 'dependency_failure'));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return brands.filter((brand) => {
      if (category !== 'all' && brand.category !== category) return false;
      if (!q) return true;
      return brand.name.toLowerCase().includes(q);
    });
  }, [brands, query, category]);

  const topPicks = React.useMemo(
    () => filtered.filter((b) => TOP_BRAND_NAMES.has(b.name)).slice(0, 16),
    [filtered],
  );

  const displayList = query.trim()
    ? filtered
    : topPicks.length > 0
      ? topPicks
      : filtered.slice(0, 16);

  const favorites = React.useMemo(
    () => brands.filter((b) => b.isFavorite),
    [brands],
  );
  const favoriteCount = favorites.length;

  const onToggle = async (brand: Brand) => {
    try {
      setError(null);
      await toggleFavorite(brand.id);
      setBrands((rows) =>
        rows.map((row) =>
          row.id === brand.id ? { ...row, isFavorite: !row.isFavorite } : row,
        ),
      );
      setLastToggled({ id: brand.id, t: Date.now() });
    } catch (e) {
      setError(toSafeErrorMessage(e, 'dependency_failure'));
    }
  };

  const onFinish = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const now = new Date().toISOString();
      await Promise.all([
        updateProfile({ onboardedAt: now }),
        setSetting('consent.onboardingCompletedAt', now),
      ]);
      await setOnboardingStep('done');
      // Audit is compliance bookkeeping, not a gate: a transient audit failure
      // must never strand the user on the final onboarding step. Record it
      // best-effort and proceed regardless.
      try {
        await recordAuditEvent('onboarding_completed', 'compliance', {});
      } catch (auditErr) {
        console.warn('[onboarding] onboarding_completed audit failed', auditErr);
      }
      await Promise.all([refreshBrands(), refreshProfile()]);
      router.replace('/onboarding/done');
    } catch (e) {
      setError(toSafeErrorMessage(e, 'dependency_failure'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="editorial-stage"
      style={{ display: 'flex', flexDirection: 'column', gap: 22, maxWidth: 760 }}
    >
      <header style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <span className="editorial-caption">Step 04 · Favorites</span>
        <h2
          className="editorial-headline"
          style={{ fontSize: 'clamp(32px, 4vw, 44px)', margin: 0 }}
        >
          Pick a few brands for one-tap logging.
        </h2>
        <p
          style={{
            fontSize: 14,
            color: 'var(--text-muted)',
            margin: 0,
            lineHeight: 1.55,
            maxWidth: 520,
          }}
        >
          Two or three is enough — you can always add more from Settings. Don&rsquo;t see yours?
          Add a custom one later.
        </p>
      </header>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <SearchInput query={query} onChange={setQuery} />
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {CATEGORIES.map((c) => {
            const selected = category === c.id;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => setCategory(c.id)}
                className="focus-ring"
                style={{
                  height: 28,
                  padding: '0 12px',
                  fontSize: 12,
                  borderRadius: 999,
                  border: selected ? '1px solid var(--accent)' : '1px solid var(--rule)',
                  background: selected ? 'var(--accent-soft)' : 'var(--bg-elevated)',
                  color: selected ? 'var(--accent)' : 'var(--text-muted)',
                  fontFamily: 'var(--font-sans)',
                  fontWeight: 500,
                  cursor: 'pointer',
                  transition: 'all 140ms ease',
                }}
              >
                {c.label}
              </button>
            );
          })}
        </div>
      </div>

      <div
        style={{
          borderTop: '1px solid var(--rule-strong)',
          borderBottom: '1px solid var(--rule)',
          maxHeight: 320,
          overflowY: 'auto',
        }}
      >
        {loading ? (
          <div
            style={{
              padding: '24px 8px',
              textAlign: 'center',
              color: 'var(--text-muted)',
              fontSize: 13,
            }}
          >
            Loading brands…
          </div>
        ) : displayList.length === 0 ? (
          <div
            style={{
              padding: '24px 8px',
              textAlign: 'center',
              color: 'var(--text-muted)',
              fontSize: 13,
            }}
          >
            No brands match. You can add custom brands in Settings after onboarding.
          </div>
        ) : (
          displayList.map((brand, i) => {
            const selected = brand.isFavorite;
            const justToggled = lastToggled?.id === brand.id;
            return (
              <button
                key={brand.id}
                type="button"
                onClick={() => void onToggle(brand)}
                className="focus-ring"
                style={{
                  width: '100%',
                  display: 'grid',
                  gridTemplateColumns: '36px 1fr auto auto auto',
                  alignItems: 'center',
                  gap: 12,
                  padding: '12px 4px',
                  borderBottom:
                    i < displayList.length - 1 ? '1px solid var(--rule)' : 'none',
                  background: selected ? 'var(--accent-soft)' : 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'background 180ms ease',
                }}
              >
                <span
                  className="editorial-caption-tight nums-tabular"
                  style={{
                    color: selected ? 'var(--accent)' : 'var(--text-faint)',
                    paddingLeft: 8,
                  }}
                >
                  {String(i + 1).padStart(2, '0')}
                </span>
                <span
                  style={{
                    fontSize: 15,
                    color: 'var(--text)',
                    fontWeight: selected ? 600 : 500,
                  }}
                >
                  {brand.name}
                </span>
                <span
                  style={{ minWidth: 70, display: 'flex', justifyContent: 'flex-end' }}
                >
                  {selected ? (
                    <Stamp
                      key={justToggled ? lastToggled?.t : `stamp-${brand.id}`}
                      show
                      rotate={-8}
                    >
                      Favorite
                    </Stamp>
                  ) : null}
                </span>
                <span
                  className="editorial-caption-tight"
                  style={{ color: 'var(--text-faint)', minWidth: 64, textAlign: 'right' }}
                >
                  {brand.category}
                </span>
                <span
                  aria-hidden
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 24,
                    height: 24,
                    borderRadius: 999,
                    border: selected ? 'none' : '1px solid var(--rule-strong)',
                    background: selected ? 'var(--accent)' : 'transparent',
                    color: '#ffffff',
                    fontSize: 14,
                    fontWeight: 700,
                    marginRight: 8,
                    transition: 'all 200ms cubic-bezier(0.34, 1.56, 0.64, 1)',
                    transform: selected ? 'scale(1.05)' : 'scale(1)',
                  }}
                >
                  {selected ? '✓' : <span style={{ color: 'var(--text-faint)', fontWeight: 400 }}>+</span>}
                </span>
              </button>
            );
          })
        )}
      </div>

      {favoriteCount > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span className="editorial-caption">
            <DigitRoll value={favoriteCount} /> selected
          </span>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {favorites.map((brand, idx) => (
              <button
                key={brand.id}
                type="button"
                onClick={() => void onToggle(brand)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  height: 30,
                  padding: '0 10px 0 12px',
                  borderRadius: 999,
                  background: 'var(--accent)',
                  color: '#ffffff',
                  border: 'none',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                  animation: 'chipPopIn 320ms cubic-bezier(0.34, 1.56, 0.64, 1) both',
                  animationDelay: `${idx * 40}ms`,
                  boxShadow: '0 4px 12px -4px rgba(47, 163, 155, 0.45)',
                  transition: 'transform 120ms ease, box-shadow 200ms ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow =
                    '0 8px 18px -4px rgba(47, 163, 155, 0.55)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow =
                    '0 4px 12px -4px rgba(47, 163, 155, 0.45)';
                }}
              >
                {brand.name}{' '}
                <span aria-hidden style={{ opacity: 0.7, fontSize: 14 }}>
                  ×
                </span>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {error ? (
        <p role="alert" style={{ fontSize: 13, color: 'var(--warn-earth)', margin: 0 }}>
          {error}
        </p>
      ) : null}

      <OnboardingStepFooter
        onBack={() => router.push('/onboarding/goal')}
        primary={{
          label: submitting ? 'Finishing…' : 'Finish setup →',
          onPress: onFinish,
          disabled: favoriteCount === 0 || submitting,
          loading: submitting,
        }}
      />
    </div>
  );
}

interface SearchInputProps {
  query: string;
  onChange: (next: string) => void;
}

function SearchInput({ query, onChange }: SearchInputProps) {
  const [focused, setFocused] = React.useState(false);
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        height: 44,
        padding: '0 14px',
        background: 'var(--bg-elevated)',
        border: `1px solid ${focused ? 'var(--accent)' : 'var(--rule)'}`,
        borderRadius: 10,
        transition: 'border-color 140ms ease',
      }}
    >
      <span style={{ color: 'var(--text-muted)', display: 'inline-flex' }}>
        <SearchIcon />
      </span>
      <input
        type="search"
        value={query}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder="Search Gold Flake, Marlboro…"
        style={{
          flex: 1,
          border: 'none',
          outline: 'none',
          background: 'transparent',
          color: 'var(--text)',
          fontFamily: 'var(--font-sans)',
          fontSize: 15,
          minWidth: 0,
        }}
        aria-label="Search brands"
      />
      {query ? (
        <button
          type="button"
          onClick={() => onChange('')}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--text-muted)',
            fontSize: 12,
            padding: 0,
          }}
        >
          clear
        </button>
      ) : null}
    </div>
  );
}
