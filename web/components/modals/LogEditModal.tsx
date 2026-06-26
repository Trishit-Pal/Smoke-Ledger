'use client';

import * as React from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { revalidateAppViews } from '@web/app/(app)/_actions/revalidate';
import { updateLog } from '@/db/repositories/logs';
import { toSafeErrorMessage } from '@/lib/errors';
import { Button } from '@web/components/ui/Button';
import { Text } from '@web/components/ui/Text';
import { ChoiceRun } from '@web/components/visual';
import { CategoryTabs } from '@web/components/brands/CategoryTabs';
import { useBrandCategoryFilter } from '@web/components/brands/categoryFilter';
import { TRIGGER_OPTIONS } from '@/constants/triggers';
import { MOOD_OPTIONS } from '@/constants/moods';
import { CONTEXT_OPTIONS } from '@/constants/contexts';
import type { Brand, BrandVariant, CigaretteLog } from '@/types';

interface LogEditModalProps {
  open: boolean;
  log: CigaretteLog | null;
  brands: (Brand & { variants: BrandVariant[] })[];
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
  onDelete?: (log: CigaretteLog) => void;
}

// ── Reusable form row component ─────────────────────────────────────────────

interface FieldRowProps {
  label: string;
  sublabel?: React.ReactNode;
  htmlFor?: string;
  children: React.ReactNode;
  hint?: React.ReactNode;
}

function FieldRow({ label, sublabel, htmlFor, children, hint }: FieldRowProps) {
  return (
    <div className="rule-hair-strong pt-md pb-md flex flex-col gap-sm">
      <div className="flex flex-col">
        {htmlFor ? (
          <label htmlFor={htmlFor} className="editorial-caption">
            {label}
          </label>
        ) : (
          <span className="editorial-caption">{label}</span>
        )}
        {sublabel ? (
          <p className="text-small text-text-muted italic mt-xs">{sublabel}</p>
        ) : null}
      </div>
      <div>{children}</div>
      {hint ? <p className="text-caption text-text-faint nums-tabular">{hint}</p> : null}
    </div>
  );
}

// ── Main modal ──────────────────────────────────────────────────────────────

export function LogEditModal({
  open,
  log,
  brands,
  onOpenChange,
  onSaved,
  onDelete,
}: LogEditModalProps) {
  const router = useRouter();
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Form state
  const [selectedBrand, setSelectedBrand] = React.useState<Brand | null>(null);
  const [selectedVariant, setSelectedVariant] = React.useState<BrandVariant | null>(null);
  const [quantity, setQuantity] = React.useState<string>('1');
  const [price, setPrice] = React.useState<string>('');
  const [mood, setMood] = React.useState<string>('');
  const [trigger, setTrigger] = React.useState<string>('');
  const [context, setContext] = React.useState<string>('');
  const [notes, setNotes] = React.useState<string>('');

  // Category filter
  const {
    activeCategory,
    setActiveCategory,
    filteredBrands: visibleBrands,
  } = useBrandCategoryFilter(brands);

  // Initialize form when log opens
  React.useEffect(() => {
    if (open && log) {
      const brand = brands.find((b) => b.id === log.brandId);
      const variant = brand?.variants.find((v) => v.id === log.variantId);
      setSelectedBrand(brand ?? null);
      setSelectedVariant(variant ?? null);
      setQuantity(String(log.quantity));
      setPrice(log.unitPriceInr ? String(log.unitPriceInr) : '');
      setMood(log.moodBefore ?? '');
      setTrigger(log.triggerTag ?? '');
      setContext(log.contextTag ?? '');
      setNotes(log.notes ?? '');
      setError(null);
      if (brand) {
        setActiveCategory(brand.category);
      }
    }
  }, [open, log, brands, setActiveCategory]);

  async function handleSave() {
    if (!log || !selectedBrand) {
      setError('Brand is required. Please select a brand before saving.');
      return;
    }
    if (!quantity || Number(quantity) <= 0) {
      setError('Quantity must be at least 0.25 sticks. Please enter a valid amount.');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await updateLog(log.id, {
        brandId: selectedBrand.id,
        variantId: selectedVariant?.id ?? null,
        quantity: Number(quantity),
        unitPriceInr: price ? Number(price) : null,
        moodBefore: mood || null,
        triggerTag: trigger || null,
        contextTag: context || null,
        notes: notes || null,
      });

      await revalidateAppViews();
      router.refresh();
      onOpenChange(false);
      onSaved();
    } catch (err) {
      setError(toSafeErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  if (!log) return null;

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        {/* Backdrop */}
        <Dialog.Overlay className="fixed inset-0 bg-black/50 z-50" />

        {/* Modal */}
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[min(92vw,40rem)] max-h-[90vh] -translate-x-1/2 -translate-y-1/2 rounded-lg bg-card border border-border shadow-xl overflow-y-auto">
          {/* Header */}
          <div className="sticky top-0 bg-card border-b border-border p-lg flex items-center justify-between">
            <Dialog.Title asChild>
              <Text variant="h2">Edit log entry</Text>
            </Dialog.Title>
            <Dialog.Close asChild>
              <button
                type="button"
                aria-label="Close"
                className="inline-flex items-center justify-center min-h-[44px] min-w-[44px] rounded-md hover:bg-bg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                <X className="w-5 h-5 text-text-muted" />
              </button>
            </Dialog.Close>
          </div>

          {/* Form content */}
          <div className="flex flex-col p-lg gap-0">
            {/* Category tabs */}
            <FieldRow label="Category" sublabel="Narrows your brand list">
              <CategoryTabs
                activeCategory={activeCategory}
                onCategoryChange={setActiveCategory}
              />
            </FieldRow>

            {/* Brand selection */}
            <FieldRow label="Brand" hint="Required">
              <div className="flex flex-col gap-sm">
                <div className="flex gap-sm overflow-x-auto pb-2 -mx-1 px-1 scrollbar-hide">
                  {visibleBrands.map((b) => (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => {
                        setSelectedBrand(b);
                        setSelectedVariant(null);
                      }}
                      className={
                        'shrink-0 inline-flex items-center min-h-[36px] px-md rounded-md border text-small transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg ' +
                        (selectedBrand?.id === b.id
                          ? 'border-[var(--text)] bg-[var(--text)] text-[var(--bg)]'
                          : 'border-[var(--rule-strong)] text-text-muted hover:text-text hover:border-[var(--text)]')
                      }
                    >
                      {b.name}
                    </button>
                  ))}
                </div>
              </div>
            </FieldRow>

            {/* Variant selection */}
            {selectedBrand && selectedBrand.variants.length > 0 ? (
              <FieldRow label="Variant" sublabel="Strength, flavor, or type — optional">
                <div className="flex gap-sm overflow-x-auto pb-2 -mx-1 px-1 scrollbar-hide">
                  {selectedBrand.variants.map((v) => (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => setSelectedVariant(v)}
                      className={
                        'shrink-0 inline-flex items-center min-h-[36px] px-md rounded-md border text-small transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg ' +
                        (selectedVariant?.id === v.id
                          ? 'border-[var(--text)] bg-[var(--text)] text-[var(--bg)]'
                          : 'border-[var(--rule-strong)] text-text-muted hover:text-text hover:border-[var(--text)]')
                      }
                    >
                      {v.name}
                    </button>
                  ))}
                </div>
              </FieldRow>
            ) : null}

            {/* Quantity */}
            <FieldRow label="Quantity" hint="0.25 sticks or more" htmlFor="edit-qty">
              <input
                id="edit-qty"
                type="number"
                min="0.25"
                step="0.25"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                disabled={saving}
                placeholder="1"
                className="w-full bg-transparent border-0 border-b border-[var(--rule)] focus:border-[var(--text)] py-sm text-body text-text placeholder:text-text-faint outline-none transition-colors nums-tabular"
              />
            </FieldRow>

            {/* Price per stick */}
            <FieldRow label="Price per stick" sublabel="Optional — helps track spending" htmlFor="edit-price">
              <input
                id="edit-price"
                type="number"
                min="0"
                step="0.1"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                disabled={saving}
                placeholder="5.50"
                className="w-full bg-transparent border-0 border-b border-[var(--rule)] focus:border-[var(--text)] py-sm text-body text-text placeholder:text-text-faint outline-none transition-colors nums-tabular"
              />
            </FieldRow>

            {/* Mood */}
            <FieldRow label="Mood before" sublabel="How you felt right before this">
              <ChoiceRun
                value={mood}
                options={MOOD_OPTIONS}
                onChange={setMood}
                disabled={saving}
              />
            </FieldRow>

            {/* Trigger */}
            <FieldRow label="Trigger" sublabel="What made you reach for one">
              <ChoiceRun
                value={trigger}
                options={TRIGGER_OPTIONS}
                onChange={setTrigger}
                disabled={saving}
              />
            </FieldRow>

            {/* Context */}
            <FieldRow label="Context" sublabel="Where you were when it happened">
              <ChoiceRun
                value={context}
                options={CONTEXT_OPTIONS}
                onChange={setContext}
                disabled={saving}
              />
            </FieldRow>

            {/* Notes */}
            <FieldRow label="Notes" sublabel="Anything else to remember about this moment" htmlFor="edit-notes">
              <textarea
                id="edit-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                disabled={saving}
                placeholder="E.g., 'After meeting,' 'Stress test,' 'With coffee'"
                rows={3}
                className="w-full bg-transparent border border-[var(--rule)] rounded-md focus:border-[var(--text)] p-sm text-body text-text placeholder:text-text-faint outline-none transition-colors resize-none"
              />
            </FieldRow>

            {/* Error message */}
            {error ? (
              <div className="mt-md p-md bg-bg border border-[var(--warn-earth)] rounded-md">
                <p className="text-small text-[var(--warn-earth)]">{error}</p>
              </div>
            ) : null}

            {/* Buttons */}
            <div className="flex flex-col gap-md mt-lg pt-lg border-t border-border">
              <div className="flex gap-md">
                <Button
                  title="Cancel"
                  variant="ghost"
                  className="flex-1"
                  disabled={saving}
                  onPress={() => onOpenChange(false)}
                />
                <Button
                  title={saving ? 'Saving…' : 'Save changes'}
                  className="flex-1"
                  loading={saving}
                  onPress={handleSave}
                />
              </div>
              {onDelete ? (
                <Button
                  title="Delete this entry"
                  variant="danger"
                  className="w-full"
                  disabled={saving}
                  onPress={() => {
                    if (log) {
                      onOpenChange(false);
                      onDelete(log);
                    }
                  }}
                />
              ) : null}
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
