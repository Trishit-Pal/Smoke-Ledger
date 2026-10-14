'use client';

import * as React from 'react';
import { formatMoney } from '@/lib/format';
import { localeForCountry } from '@/lib/regions';
import { maskBrandName, maskInr } from '@/lib/discreet';
import type { Brand, BrandVariant, CigaretteLog, UserProfile } from '@/types';
import { Button } from '@web/components/ui/Button';
import { Text } from '@web/components/ui/Text';
import { Chip } from '@web/components/ui/Chip';

export interface QuickLogSheetProps {
  profile: UserProfile;
  brands: (Brand & { variants?: BrandVariant[] })[];
  lastLog: CigaretteLog | null;
  pending?: boolean;
  onLog: (opts: {
    brandId: string | null;
    brandName: string | null;
    variantName: string | null;
    quantity: number;
  }) => Promise<void>;
  onAdvanced?: () => void;
}

export function QuickLogSheet({
  profile,
  brands,
  lastLog,
  pending = false,
  onLog,
  onAdvanced,
}: QuickLogSheetProps) {
  const discreet = profile.discreetMode;
  const favorites = React.useMemo(
    () =>
      [...brands]
        .filter((b) => b.isFavorite)
        .sort((a, b) => a.name.localeCompare(b.name))
        .slice(0, 6),
    [brands],
  );

  const lastLabel = lastLog
    ? `${maskBrandName(lastLog.brandNameSnap ?? 'Unknown', discreet)}${
        lastLog.variantSnap ? ` · ${lastLog.variantSnap}` : ''
      }`
    : 'No brand yet';

  const lastPrice =
    lastLog?.unitPriceInr != null
      ? maskInr(lastLog.unitPriceInr, discreet, (n) => formatMoney(n, profile.currency, { compact: true, locale: localeForCountry(profile.country) }))
      : 'Price estimated';

  return (
    <div className="flex flex-col gap-md rounded-2xl border border-border bg-card p-lg shadow-[var(--shadow-card)]">
      <div className="flex flex-col gap-xs">
        <Text variant="caption" muted>
          Quick log
        </Text>
        <Text variant="bodyStrong">{lastLabel}</Text>
        <Text variant="small" muted>
          {lastPrice}
        </Text>
      </div>

      <div className="flex gap-sm">
        <Button
          title={pending ? 'Logging…' : 'Log 1'}
          variant="primary"
          fullWidth
          loading={pending}
          className="min-h-[48px] text-base font-semibold"
          onPress={() =>
            onLog({
              brandId: lastLog?.brandId ?? null,
              brandName: lastLog?.brandNameSnap ?? null,
              variantName: lastLog?.variantSnap ?? null,
              quantity: 1,
            })
          }
        />
        <Button
          title="+2"
          variant="secondary"
          loading={pending}
          className="min-h-[48px] min-w-[4rem]"
          onPress={() =>
            onLog({
              brandId: lastLog?.brandId ?? null,
              brandName: lastLog?.brandNameSnap ?? null,
              variantName: lastLog?.variantSnap ?? null,
              quantity: 2,
            })
          }
        />
      </div>

      {favorites.length > 0 ? (
        <div className="flex flex-col gap-sm">
          <Text variant="caption" muted>
            Favorites
          </Text>
          <div className="flex flex-wrap gap-sm">
            {favorites.map((brand) => {
              const variant = brand.variants?.[0];
              return (
                <Chip
                  key={brand.id}
                  label={maskBrandName(brand.name, discreet)}
                  selected={lastLog?.brandId === brand.id}
                  onPress={() =>
                    onLog({
                      brandId: brand.id,
                      brandName: brand.name,
                      variantName: variant?.name ?? null,
                      quantity: 1,
                    })
                  }
                />
              );
            })}
          </div>
        </div>
      ) : null}

      {onAdvanced ? (
        <Button title="Add details" variant="ghost" fullWidth onPress={onAdvanced} />
      ) : null}
    </div>
  );
}
