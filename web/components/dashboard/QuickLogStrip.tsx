'use client';

/*
 * QuickLogStrip — editorial reframe of QuickLogSheet for the revamped dashboard.
 *
 * Goal: keep the same data path (the `onLog` callback signature is identical to
 * QuickLogSheet) but present quick-log as small editorial actions sitting flush
 * under the headline number, with no nested card chrome. The "last cigarette"
 * line is rendered as a sub-deck (italic Fraunces caption) so the eye reads:
 *
 *   ┌─────────────┐
 *   │ 4           │   <- editorial numeral, lives in DashboardClient
 *   └─────────────┘
 *   Last: Marlboro Gold · ₹22
 *   ────────────────────────
 *   [ Log 1 ]  [ +2 ]   Favorites: Marlboro · Classic · Wills
 *
 * Brand is mandatory for every log (price stays optional). The "Log one"/"+2"
 * actions replay the last entry's brand, so they are disabled until there is a
 * last entry that carried a brand; favourites always carry a brand. When the
 * catalog is empty, the strip prompts the reader to add a brand first.
 */

import * as React from 'react';
import { formatInr } from '@/lib/format';
import { maskBrandName, maskInr } from '@/lib/discreet';
import type { Brand, BrandVariant, CigaretteLog, UserProfile } from '@/types';

export interface QuickLogStripProps {
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

export function QuickLogStrip({
  profile,
  brands,
  lastLog,
  pending = false,
  onLog,
  onAdvanced,
}: QuickLogStripProps) {
  const discreet = profile.discreetMode;
  const favorites = React.useMemo(
    () =>
      [...brands]
        .filter((b) => b.isFavorite)
        .sort((a, b) => a.name.localeCompare(b.name))
        .slice(0, 4),
    [brands],
  );

  const noBrands = brands.length === 0;
  // Brand is required, so the replay actions are only valid when the last entry
  // carried a brand to repeat.
  const canRepeatLast = Boolean(lastLog?.brandId);

  const lastBrandLabel = lastLog
    ? `${maskBrandName(lastLog.brandNameSnap ?? 'Unknown', discreet)}${
        lastLog.variantSnap ? ` · ${lastLog.variantSnap}` : ''
      }`
    : null;

  const lastPrice =
    lastLog?.unitPriceInr != null
      ? maskInr(lastLog.unitPriceInr, discreet, (n) => formatInr(n, { compact: true }))
      : null;

  const logLast = (quantity: number) => {
    if (!lastLog?.brandId) return;
    return onLog({
      brandId: lastLog.brandId,
      brandName: lastLog.brandNameSnap ?? null,
      variantName: lastLog.variantSnap ?? null,
      quantity,
    });
  };

  const repeatDisabledTitle = !canRepeatLast
    ? 'Log a full entry with a brand first, or pick a favourite below.'
    : undefined;

  return (
    <div className="flex flex-col gap-md">
      {/* Editorial deck: last cigarette, no card chrome */}
      <p className="text-small text-text-muted">
        {lastBrandLabel ? (
          <>
            <span className="text-text-faint">Last:&nbsp;</span>
            <span className="text-text">{lastBrandLabel}</span>
            {lastPrice ? <span className="text-text-faint"> · {lastPrice}</span> : null}
          </>
        ) : (
          <span className="italic">No cigarettes logged yet.</span>
        )}
      </p>

      {noBrands ? (
        /* No catalog yet — brand is required, so guide to add one first. */
        <a
          href="/settings"
          className="
            self-start inline-flex items-center justify-center
            min-h-[44px] px-lg rounded-md
            bg-text text-bg font-medium text-body
            transition-opacity hover:opacity-90
            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg
          "
        >
          Add a brand to start logging →
        </a>
      ) : (
        /* Two primary actions + favourites, all on one line that wraps on small viewports */
        <div className="flex flex-wrap items-center gap-sm">
          <button
            type="button"
            onClick={() => logLast(1)}
            disabled={pending || !canRepeatLast}
            aria-busy={pending || undefined}
            title={repeatDisabledTitle}
            className="
              inline-flex items-center justify-center
              min-h-[44px] px-lg rounded-md
              bg-text text-bg font-medium text-body
              transition-opacity hover:opacity-90
              disabled:opacity-50 disabled:cursor-not-allowed
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg
            "
          >
            {pending ? 'Logging…' : 'Log one'}
          </button>

          <button
            type="button"
            onClick={() => logLast(2)}
            disabled={pending || !canRepeatLast}
            title={repeatDisabledTitle}
            className="
              inline-flex items-center justify-center
              min-h-[44px] px-md rounded-md
              border text-text font-medium text-body
              transition-colors hover:border-text/40
              disabled:opacity-50 disabled:cursor-not-allowed
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg
            "
            style={{ borderColor: 'var(--rule-strong)' }}
          >
            +2
          </button>

          {favorites.length > 0 ? (
            <>
              <span className="text-caption text-text-faint ml-sm" aria-hidden>
                ·
              </span>
              <ul className="flex flex-wrap items-center gap-sm" role="list">
                {favorites.map((brand) => {
                  const variant = brand.variants?.[0];
                  const isLast = lastLog?.brandId === brand.id;
                  return (
                    <li key={brand.id}>
                      <button
                        type="button"
                        onClick={() =>
                          onLog({
                            brandId: brand.id,
                            brandName: brand.name,
                            variantName: variant?.name ?? null,
                            quantity: 1,
                          })
                        }
                        disabled={pending}
                        aria-pressed={isLast}
                        className="
                          inline-flex items-center
                          min-h-[36px] px-md
                          text-small text-text-muted hover:text-text
                          underline-offset-4 hover:underline decoration-1
                          disabled:opacity-50 disabled:cursor-not-allowed
                          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg rounded-sm
                        "
                        style={{ textDecorationColor: 'var(--rule-strong)' }}
                      >
                        {maskBrandName(brand.name, discreet)}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </>
          ) : null}
        </div>
      )}

      {/* When the replay actions are unavailable but a catalog exists, nudge to
          the full form (which enforces brand selection). */}
      {!noBrands && !canRepeatLast && favorites.length === 0 ? (
        <p className="text-caption text-text-faint italic">
          Pick a brand on the full entry to log your first stick.
        </p>
      ) : null}

      {onAdvanced ? (
        <button
          type="button"
          onClick={onAdvanced}
          className="
            self-start text-small text-text-muted hover:text-text
            underline underline-offset-4 decoration-1
            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg rounded-sm
          "
          style={{ textDecorationColor: 'var(--rule-strong)' }}
        >
          Add details →
        </button>
      ) : null}
    </div>
  );
}

export default QuickLogStrip;
