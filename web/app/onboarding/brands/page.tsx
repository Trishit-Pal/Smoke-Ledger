'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@web/components/ui/Card';
import { Chip } from '@web/components/ui/Chip';
import { Button } from '@web/components/ui/Button';
import { Text } from '@web/components/ui/Text';
import { listBrands, toggleFavorite } from '@/db/repositories/brands';
import { updateProfile, setOnboardingStep } from '@/db/repositories/profile';
import { setSetting } from '@/db/repositories/settings';
import { recordAuditEvent } from '@/services/audit';
import { useSession } from '@/store/session';
import type { Brand } from '@/types';
import { toSafeErrorMessage } from '@/lib/errors';

export default function OnboardingBrandsPage() {
  const router = useRouter();
  const refreshBrands = useSession((s) => s.refreshBrands);
  const refreshProfile = useSession((s) => s.refreshProfile);

  const [brands, setBrands] = React.useState<Brand[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

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
          STEP 4 OF 4
        </Text>
        <Text variant="display">Favorite brands</Text>
        <Text variant="small" muted>
          Pick the brands you use most so quick-log stays fast.
        </Text>
      </header>

      <Card>
        {loading ? (
          <Text variant="small" muted>
            Loading brands…
          </Text>
        ) : brands.length === 0 ? (
          <Text variant="small" muted>
            No brands found. You can continue and add custom brands later.
          </Text>
        ) : (
          <div className="flex flex-wrap gap-sm">
            {brands.map((brand) => (
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
