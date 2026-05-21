'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { X } from 'lucide-react';

import { createLog, inferUnitPriceForVariant } from '@/db/repositories/logs';
import { deriveUnitPrice } from '@/domain/calc';
import { TRIGGER_OPTIONS } from '@/constants/triggers';
import { MOOD_OPTIONS } from '@/constants/moods';
import { CONTEXT_OPTIONS } from '@/constants/contexts';
import { AnalyticsEvents } from '@/constants/events';
import { track } from '@/services/analytics';
import { toSafeErrorMessage } from '@/lib/errors';
import type {
  Brand,
  BrandVariant,
  ContextTag,
  Mood,
  PurchaseMode,
  TriggerTag,
} from '@/types';

import { Button } from '@web/components/ui/Button';
import { Chip } from '@web/components/ui/Chip';
import { Text } from '@web/components/ui/Text';
import { Input } from '@web/components/ui/Input';
import { FadeSlideIn } from '@web/components/anim/dynamic';

const PURCHASE_MODES: { value: PurchaseMode; label: string }[] = [
  { value: 'single', label: 'Single' },
  { value: 'pack', label: 'Pack' },
  { value: 'carton', label: 'Carton' },
  { value: 'custom', label: 'Custom' },
];
const QUANTITY_OPTIONS = [1, 2, 3, 4, 5, 6, 8, 10, 12, 15, 20, 25, 30, 40];

export interface LogNewClientProps {
  brands: (Brand & { variants: BrandVariant[] })[];
}

export function LogNewClient({ brands }: LogNewClientProps) {
  const router = useRouter();

  const [brandId, setBrandId] = React.useState<string | null>(null);
  const [variantName, setVariantName] = React.useState<string | null>(null);
  const [purchaseMode, setPurchaseMode] = React.useState<PurchaseMode>('single');
  const [quantity, setQuantity] = React.useState<string>('1');
  const [packSize, setPackSize] = React.useState<string>('');
  const [priceText, setPriceText] = React.useState<string>('');
  const [triggerTag, setTriggerTag] = React.useState<TriggerTag | null>(null);
  const [moodBefore, setMoodBefore] = React.useState<Mood | null>(null);
  const [moodAfter, setMoodAfter] = React.useState<Mood | null>(null);
  const [craving, setCraving] = React.useState<number | null>(null);
  const [contextTag, setContextTag] = React.useState<ContextTag | null>(null);
  const [notes, setNotes] = React.useState<string>('');

  const [showAdvanced, setShowAdvanced] = React.useState(false);

  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const sortedBrands = React.useMemo(
    () =>
      [...brands].sort((a, b) => {
        if (a.isFavorite !== b.isFavorite) return a.isFavorite ? -1 : 1;
        return a.name.localeCompare(b.name);
      }),
    [brands],
  );

  const selectedBrand = React.useMemo(
    () => sortedBrands.find((b) => b.id === brandId) ?? null,
    [sortedBrands, brandId],
  );

  const handleSave = async () => {
    try {
      setSubmitting(true);
      setError(null);

      const qty = Math.max(1, Number(quantity) || 1);
      const ps = packSize ? Math.max(1, Number(packSize)) : null;
      const totalPrice = priceText ? Number(priceText) : null;
      if (priceText && (!Number.isFinite(totalPrice) || (totalPrice ?? -1) < 0)) {
        throw new Error('Enter a valid price.');
      }

      const inferred = await inferUnitPriceForVariant(variantName, brandId);
      const result = deriveUnitPrice({
        quantity: qty,
        purchaseMode,
        packSize: ps,
        totalPriceInr: totalPrice,
        inferredUnitInr: inferred,
      });

      await createLog({
        tsUtc: new Date().toISOString(),
        brandId,
        brandNameSnap: selectedBrand?.name ?? null,
        variantSnap: variantName,
        quantity: qty,
        purchaseMode,
        packSize: ps,
        totalPriceInr: result.totalPriceInr,
        unitPriceInr: result.unitPriceInr,
        priceSource: result.source,
        triggerTag,
        moodBefore,
        moodAfter,
        craving,
        contextTag,
        notes: notes.trim() || null,
      });

      await track(AnalyticsEvents.CIGARETTE_LOGGED, {
        quantity: qty,
        mode: purchaseMode,
        has_price: result.unitPriceInr != null,
        price_source: result.source,
      });

      router.refresh();
      router.back();
    } catch (e) {
      setError(toSafeErrorMessage(e, 'dependency_failure'));
    } finally {
      setSubmitting(false);
    }
  };

  const showPackInput = purchaseMode === 'pack' || purchaseMode === 'carton';

  let i = 0;
  return (
    <div className="max-w-2xl mx-auto p-lg flex flex-col gap-xl pb-32">
      <FadeSlideIn index={i++}>
        <div className="flex items-center justify-between">
          <Text variant="display">Log smoke</Text>
          <button
            type="button"
            onClick={() => router.back()}
            aria-label="Cancel"
            className="w-9 h-9 rounded-md border border-border bg-bg-elevated hover:bg-card flex items-center justify-center text-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <X className="w-4 h-4" aria-hidden />
          </button>
        </div>
      </FadeSlideIn>

      {/* Brand row */}
      <FadeSlideIn index={i++}>
        <div>
          <Text variant="caption" muted className="mb-sm">
            Brand
          </Text>
          {sortedBrands.length === 0 ? (
            <Text variant="small" faint>
              No brands yet — add one from settings or save without a brand.
            </Text>
          ) : (
            <div className="flex gap-sm overflow-x-auto pb-2 -mx-1 px-1">
              <Chip
                label="None"
                selected={brandId === null}
                onPress={() => {
                  setBrandId(null);
                  setVariantName(null);
                }}
              />
              {sortedBrands.map((b) => (
                <Chip
                  key={b.id}
                  label={b.isFavorite ? `★ ${b.name}` : b.name}
                  selected={brandId === b.id}
                  onPress={() => {
                    setBrandId(b.id);
                    setVariantName(null);
                  }}
                />
              ))}
            </div>
          )}
        </div>
      </FadeSlideIn>

      {/* Variant grid */}
      {selectedBrand && selectedBrand.variants.length > 0 ? (
        <FadeSlideIn index={i++}>
          <div>
            <Text variant="caption" muted className="mb-sm">
              Variant
            </Text>
            <div className="flex flex-wrap gap-sm">
              {selectedBrand.variants.map((v) => (
                <Chip
                  key={v.id}
                  label={v.name}
                  selected={variantName === v.name}
                  onPress={() =>
                    setVariantName((cur) => (cur === v.name ? null : v.name))
                  }
                />
              ))}
            </div>
          </div>
        </FadeSlideIn>
      ) : null}

      {!showAdvanced ? (
        <FadeSlideIn index={i++}>
          <div className="grid grid-cols-2 gap-md">
            <Input
              label="Quantity"
              type="number"
              inputMode="numeric"
              min={1}
              step={1}
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
            />
            <Input
              label="Price (INR)"
              type="number"
              inputMode="decimal"
              min={0}
              step="0.01"
              placeholder="Optional"
              hint="Leave blank to estimate from catalog"
              value={priceText}
              onChange={(e) => setPriceText(e.target.value)}
            />
          </div>
          <Button
            title={showAdvanced ? 'Hide advanced' : 'Show advanced options'}
            variant="ghost"
            fullWidth
            className="mt-md"
            onPress={() => setShowAdvanced(true)}
          />
        </FadeSlideIn>
      ) : null}

      {showAdvanced ? (
        <>
      {/* Purchase mode */}
      <FadeSlideIn index={i++}>
        <div>
          <Text variant="caption" muted className="mb-sm">
            Purchase
          </Text>
          <div className="flex flex-wrap gap-sm">
            {PURCHASE_MODES.map((m) => (
              <Chip
                key={m.value}
                label={m.label}
                selected={purchaseMode === m.value}
                onPress={() => setPurchaseMode(m.value)}
              />
            ))}
          </div>
        </div>
      </FadeSlideIn>

      {/* Quantity + pack size */}
      <FadeSlideIn index={i++}>
        <div className="grid grid-cols-2 gap-md">
          <label className="flex flex-col gap-1 text-caption uppercase text-text-muted">
            Quantity
            <select
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className="w-full bg-bg-elevated border border-border rounded-md px-md py-sm text-body text-text"
            >
              {QUANTITY_OPTIONS.map((qty) => (
                <option key={qty} value={String(qty)}>
                  {qty}
                </option>
              ))}
            </select>
          </label>
          {showPackInput ? (
            <Input
              label="Pack size"
              type="number"
              inputMode="numeric"
              min={1}
              step={1}
              placeholder="20"
              value={packSize}
              onChange={(e) => setPackSize(e.target.value)}
            />
          ) : (
            <Input
              label="Price (INR)"
              type="number"
              inputMode="decimal"
              min={0}
              step="0.01"
              placeholder="0"
              hint="Leave blank to estimate"
              value={priceText}
              onChange={(e) => setPriceText(e.target.value)}
            />
          )}
        </div>
        {showPackInput ? (
          <div className="mt-md">
            <Input
              label="Price (INR)"
              type="number"
              inputMode="decimal"
              min={0}
              step="0.01"
              placeholder="0"
              hint="Leave blank to estimate"
              value={priceText}
              onChange={(e) => setPriceText(e.target.value)}
            />
          </div>
        ) : null}
      </FadeSlideIn>

      {/* Trigger */}
      <FadeSlideIn index={i++}>
        <div>
          <Text variant="caption" muted className="mb-sm">
            Trigger
          </Text>
          <div className="flex flex-wrap gap-sm">
            {TRIGGER_OPTIONS.map((t) => (
              <Chip
                key={t.value}
                label={t.label}
                selected={triggerTag === t.value}
                onPress={() =>
                  setTriggerTag((cur) => (cur === t.value ? null : t.value))
                }
              />
            ))}
          </div>
        </div>
      </FadeSlideIn>

      {/* Mood before */}
      <FadeSlideIn index={i++}>
        <div>
          <Text variant="caption" muted className="mb-sm">
            Mood before
          </Text>
          <div className="flex flex-wrap gap-sm">
            {MOOD_OPTIONS.map((m) => (
              <Chip
                key={m.value}
                label={m.label}
                selected={moodBefore === m.value}
                onPress={() =>
                  setMoodBefore((cur) => (cur === m.value ? null : m.value))
                }
              />
            ))}
          </div>
        </div>
      </FadeSlideIn>

      {/* Mood after */}
      <FadeSlideIn index={i++}>
        <div>
          <Text variant="caption" muted className="mb-sm">
            Mood after
          </Text>
          <div className="flex flex-wrap gap-sm">
            {MOOD_OPTIONS.map((m) => (
              <Chip
                key={m.value}
                label={m.label}
                selected={moodAfter === m.value}
                onPress={() =>
                  setMoodAfter((cur) => (cur === m.value ? null : m.value))
                }
              />
            ))}
          </div>
        </div>
      </FadeSlideIn>

      {/* Craving */}
      <FadeSlideIn index={i++}>
        <div>
          <Text variant="caption" muted className="mb-sm">
            Craving (0–10)
          </Text>
          <div className="flex flex-wrap gap-xs">
            {Array.from({ length: 11 }, (_, n) => (
              <Chip
                key={n}
                label={String(n)}
                selected={craving === n}
                onPress={() => setCraving((cur) => (cur === n ? null : n))}
              />
            ))}
          </div>
        </div>
      </FadeSlideIn>

      {/* Context */}
      <FadeSlideIn index={i++}>
        <div>
          <Text variant="caption" muted className="mb-sm">
            Context
          </Text>
          <div className="flex flex-wrap gap-sm">
            {CONTEXT_OPTIONS.map((c) => (
              <Chip
                key={c.value}
                label={c.label}
                selected={contextTag === c.value}
                onPress={() =>
                  setContextTag((cur) => (cur === c.value ? null : c.value))
                }
              />
            ))}
          </div>
        </div>
      </FadeSlideIn>

      {/* Notes */}
      <FadeSlideIn index={i++}>
        <Input
          label="Notes"
          multiline
          rows={3}
          placeholder="Optional"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </FadeSlideIn>

          <Button
            title="Hide advanced options"
            variant="ghost"
            fullWidth
            className="mt-md"
            onPress={() => setShowAdvanced(false)}
          />
        </>
      ) : null}

      <FadeSlideIn index={i++}>
        <div className="flex flex-col gap-sm">
          <Button
            title={submitting ? 'Saving…' : 'Save log'}
            variant="primary"
            fullWidth
            loading={submitting}
            onPress={handleSave}
          />
          {error ? (
            <Text
              variant="small"
              color="var(--danger, #C85A54)"
              className="text-center"
            >
              {error}
            </Text>
          ) : null}
        </div>
      </FadeSlideIn>
    </div>
  );
}
