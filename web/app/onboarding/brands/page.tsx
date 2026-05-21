'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@web/components/ui/Card';
import { Chip } from '@web/components/ui/Chip';
import { Input } from '@web/components/ui/Input';
import { Button } from '@web/components/ui/Button';
import { Text } from '@web/components/ui/Text';
import { listBrands, toggleFavorite } from '@/db/repositories/brands';
import { updateProfile, setOnboardingStep } from '@/db/repositories/profile';
import { setSetting } from '@/db/repositories/settings';
import { recordAuditEvent } from '@/services/audit';
import { useSession } from '@/store/session';
import type { Brand, BrandCategory } from '@/types';
import { toSafeErrorMessage } from '@/lib/errors';

const CATEGORIES: { id: BrandCategory | 'all'; label: string }[] = [
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

  const displayList = query.trim() ? filtered : topPicks.length > 0 ? topPicks : filtered.slice(0, 16);

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
      await recordAuditEvent('onboarding_completed', 'compliance', {});
      await Promise.all([refreshBrands(), refreshProfile()]);
      router.replace('/dashboard');
    } catch (e) {
      setError(toSafeErrorMessage(e, 'dependency_failure'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-lg">
      <header className="flex flex-col gap-sm">
        <Text variant="caption" muted>
          STEP 3 OF 3
        </Text>
        <Text variant="display">Favorite brands</Text>
        <Text variant="small" muted>
          Pick a few for one-tap logging. Search or filter if you don&apos;t see yours.
        </Text>
      </header>

      <Input
        label="Search brands"
        type="search"
        placeholder="e.g. Gold Flake, Marlboro"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      <div className="flex flex-wrap gap-sm">
        {CATEGORIES.map((item) => (
          <Chip
            key={item.id}
            label={item.label}
            selected={category === item.id}
            onPress={() => setCategory(item.id)}
          />
        ))}
      </div>

      <Card>
        {loading ? (
          <Text variant="small" muted>
            Loading brands…
          </Text>
        ) : displayList.length === 0 ? (
          <Text variant="small" muted>
            No brands match. You can add custom brands in Settings after onboarding.
          </Text>
        ) : (
          <div className="flex flex-wrap gap-sm">
            {displayList.map((brand) => (
              <Chip
                key={brand.id}
                label={brand.name}
                selected={brand.isFavorite}
                onPress={async () => {
                  try {
                    setError(null);
                    await toggleFavorite(brand.id);
                    setBrands((rows) =>
                      rows.map((row) =>
                        row.id === brand.id ? { ...row, isFavorite: !row.isFavorite } : row,
                      ),
                    );
                  } catch (e) {
                    setError(toSafeErrorMessage(e, 'dependency_failure'));
                  }
                }}
              />
            ))}
          </div>
        )}
      </Card>

      {error ? (
        <Text variant="small" color="var(--danger, #C85A54)">
          {error}
        </Text>
      ) : null}

      <Button
        title={submitting ? 'Finishing…' : 'Finish onboarding'}
        fullWidth
        loading={submitting}
        disabled={submitting}
        onPress={onFinish}
      />
    </div>
  );
}
