'use client';

import * as React from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { safeRevalidateAppViews as revalidateAppViews } from '@web/lib/safeRevalidate';
import { updateLog } from '@/db/repositories/logs';
import { round2 } from '@/domain/calc';
import { toSafeErrorMessage } from '@/lib/errors';
import { MAX_PRICE_INR } from '@/lib/validation';
import { Button } from '@web/components/ui/Button';
import { Text } from '@web/components/ui/Text';
import { ChoiceRun } from '@web/components/visual';
import { CategoryTabs } from '@web/components/brands/CategoryTabs';
import { useBrandCategoryFilter } from '@web/components/brands/categoryFilter';
import { TRIGGER_OPTIONS } from '@/constants/triggers';
import { MOOD_OPTIONS } from '@/constants/moods';
import { CONTEXT_OPTIONS } from '@/constants/contexts';
import type {
  Brand,
  BrandVariant,
  CigaretteLog,
  Mood,
  TriggerTag,
  ContextTag,
} from '@/types';

type BrandWithVariants = Brand & { variants: BrandVariant[] };

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
  const [selectedBrand, setSelectedBrand] = React.useState<BrandWithVariants | null>(null);
  const [selectedVariant, setSelectedVariant] = React.useState<BrandVariant | null>(null);
  const [quantity, setQuantity] = React.useState<string>('1');
  const [price, setPrice] = React.useState<string>('');
  const [mood, setMood] = React.useState<Mood | null>(null);
  const [trigger, setTrigger] = React.useState<TriggerTag | null>(null);
  const [context, setContext] = React.useState<ContextTag | null>(null);
  const [notes, setNotes] = React.useState<string>('');

  // Category filter
  const {
    category,
    setCategory,
    categories,
    filtered: visibleBrands,
  } = useBrandCategoryFilter(brands);

  // Initialize form when log opens
  React.useEffect(() => {
    if (open && log) {
      const brand = brands.find((b) => b.id === log.brandId);
      // Logs snapshot the variant name, not its id, so re-link by name.
      const variant = brand?.variants.find((v) => v.name === log.variantSnap);
      setSelectedBrand(brand ?? null);
      setSelectedVariant(variant ?? null);
      setQuantity(String(log.quantity));
      // Seed the per-stick price. Fall back to total/quantity when only the
      // total was recorded (e.g. imported logs), and use a null check so a
      // genuine ₹0 survives — otherwise an unrelated edit would reconstruct
      // totalPriceInr from an empty price and silently erase the stored total.
      setPrice(
        log.unitPriceInr != null
          ? String(log.unitPriceInr)
          : log.totalPriceInr != null && log.quantity > 0
            ? String(round2(log.totalPriceInr / log.quantity))
            : '',
      );
      setMood(log.moodBefore ?? null);
      setTrigger(log.triggerTag ?? null);
      setContext(log.contextTag ?? null);
      setNotes(log.notes ?? '');
      setError(null);
      if (brand) {
        setCategory(brand.category);
      }
    }
  }, [open, log, brands, setCategory]);

  async function handleSave() {
    if (!log || !selectedBrand) {
      setError('Brand is required. Please select a brand before saving.');
      return;
    }
    const qty = Number(quantity);
    if (!quantity || !Number.isInteger(qty) || qty < 1 || qty > 100) {
      setError('Quantity must be a whole number of sticks between 1 and 100.');
      return;
    }
    const unit = price ? round2(Number(price)) : null;
    if (unit != null && (Number.isNaN(unit) || unit < 0 || unit > MAX_PRICE_INR)) {
      setError(`Price per stick must be between ₹0 and ₹${MAX_PRICE_INR.toLocaleString('en-IN')}.`);
      return;
    }

    setSaving(true);
    setError(null);

    try {
      // Preserve the original variant snapshot when the brand is unchanged and
      // the stored variant is no longer in the catalog, so an unrelated edit
      // (e.g. only the note) can't silently erase historical detail. A real
      // brand switch clears it.
      const brandChanged = selectedBrand.id !== log.brandId;
      await updateLog(log.id, {
        brandId: selectedBrand.id,
        brandNameSnap: selectedBrand.name,
        variantSnap: selectedVariant?.name ?? (brandChanged ? null : log.variantSnap),
        quantity: qty,
        unitPriceInr: unit,
        // Keep the stored total consistent with the edited per-stick price.
        totalPriceInr: unit != null ? round2(unit * qty) : null,
        // A user-entered price is an exact figure; fall back to unknown if cleared.
        priceSource: unit != null ? 'exact' : 'unknown',
        moodBefore: mood,
        triggerTag: trigger,
        contextTag: context,
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
          <Dialog.Description className="sr-only">
            Edit the details of this log entry, then save or delete it.
          </Dialog.Description>
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
                categories={categories}
                value={category}
                onChange={setCategory}
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
            <FieldRow label="Quantity" hint="Whole sticks, 1 or more" htmlFor="edit-qty">
              <input
                id="edit-qty"
                type="number"
                min="1"
                step="1"
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
                onSelect={setMood}
                ariaLabel="Mood before"
              />
            </FieldRow>

            {/* Trigger */}
            <FieldRow label="Trigger" sublabel="What made you reach for one">
              <ChoiceRun
                value={trigger}
                options={TRIGGER_OPTIONS}
                onSelect={setTrigger}
                ariaLabel="Trigger"
              />
            </FieldRow>

            {/* Context */}
            <FieldRow label="Context" sublabel="Where you were when it happened">
              <ChoiceRun
                value={context}
                options={CONTEXT_OPTIONS}
                onSelect={setContext}
                ariaLabel="Context"
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
