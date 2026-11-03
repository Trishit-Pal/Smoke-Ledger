'use client';

/*
 * ─────────────────────────────────────────────────────────────────────────────
 *  Log · New entry — writing one line into today's ledger
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *  Form metaphor (deliberate): a single editorial spread where each field is
 *  a hairline-row of typographic prefaces and controls, not a stacked stack
 *  of Cards. The page is one focused single-action: write a line, save it,
 *  return to where you came from.
 *
 *  Decision on the literal "fill-in-the-blanks" prose layout I considered:
 *  rejected. With nine+ controls (brand, variant, mode, quantity, price,
 *  trigger, mood-before, mood-after, craving, context, notes), the cognitive
 *  cost of parsing a sentence where every other word is a picker outweighs
 *  the typographic delight. The hairline-rows version is the editorial
 *  language done quietly and well — small-caps caption, optional sublabel,
 *  control, hairline beneath. That is the chosen form.
 *
 *  All data paths preserved: createLog, inferUnitPriceForVariant,
 *  resolveLogUnitPrice, the trigger/mood/context/purchase-mode enums, and the
 *  analytics emit are unchanged. Only the rendering changed.
 */

import * as React from 'react';
import { useRouter } from 'next/navigation';

import { safeRevalidateAppViews as revalidateAppViews } from '@web/lib/safeRevalidate';
import { createLog, inferUnitPriceForVariant } from '@/db/repositories/logs';
import { currencyFor, localeForCountry, timezoneForCountry } from '@/lib/regions';
import { resolveLogUnitPrice } from '@/domain/calc';
import { CategoryTabs } from '@web/components/brands/CategoryTabs';
import { useBrandCategoryFilter } from '@web/components/brands/categoryFilter';
import { ChoiceRun } from '@web/components/visual';
import { BackdateTimeField, maxBackdateMs } from './BackdateTimeField';
import { buildPricePreview } from './pricePreview';
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

const PURCHASE_MODES: { value: PurchaseMode; label: string }[] = [
  { value: 'single', label: 'Single' },
  { value: 'pack', label: 'Pack' },
  { value: 'carton', label: 'Carton' },
  { value: 'custom', label: 'Custom' },
];
const QUANTITY_OPTIONS = [1, 2, 3, 4, 5, 6, 8, 10, 12, 15, 20, 25, 30, 40];

export interface LogNewClientProps {
  brands: (Brand & { variants: BrandVariant[] })[];
  country?: string | null;
}

// ── Inline editorial primitives ───────────────────────────────────────────────

interface FieldRowProps {
  label: string;
  sublabel?: React.ReactNode;
  htmlFor?: string;
  children: React.ReactNode;
  hint?: React.ReactNode;
}

/** A hairline-row form section: small-caps caption + optional sublabel + control. */
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

interface EditorialPillRowProps<T> {
  items: { key: string; label: React.ReactNode; selected: boolean; onPress: () => void }[];
  ariaLabel: string;
}

/** Hairline-outline pill row that scrolls horizontally. Used for brand + variant
 *  where the set can grow large and label content includes a star marker. */
function EditorialPillRow({ items, ariaLabel }: EditorialPillRowProps<unknown>) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className="flex gap-sm overflow-x-auto pb-2 -mx-1 px-1 scrollbar-hide scroll-fade-x"
    >
      {items.map((it) => (
        <button
          key={it.key}
          type="button"
          aria-pressed={it.selected}
          onClick={it.onPress}
          className={
            'shrink-0 inline-flex items-center justify-center min-h-11 min-w-11 px-md rounded-md border text-small transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg ' +
            (it.selected
              ? 'border-[var(--text)] bg-[var(--text)] text-[var(--bg)]'
              : 'border-[var(--rule-strong)] text-text-muted hover:text-text hover:border-[var(--text)]')
          }
        >
          {it.label}
        </button>
      ))}
    </div>
  );
}

/** Minimal editorial number/text input — hairline rule below, no boxed chrome. */
const EditorialInput = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(function EditorialInput(props, ref) {
  return (
    <input
      ref={ref}
      {...props}
      className={
        'w-full bg-transparent border-0 border-b border-[var(--rule)] focus:border-[var(--text)] min-h-11 py-sm text-body text-text placeholder:text-text-faint outline-none transition-colors nums-tabular ' +
        (props.className ?? '')
      }
    />
  );
});

// ── Page ─────────────────────────────────────────────────────────────────────

export function LogNewClient({ brands, country }: LogNewClientProps) {
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
  const [backdate, setBackdate] = React.useState<Date | null>(null);

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

  // Category tabs: 'All' lists every brand; switching filters. The selected brand
  // is always kept in the list (even when its category is filtered out) so the
  // choice stays visible and retained across tab switches.
  const { category, setCategory, categories, filtered } = useBrandCategoryFilter(sortedBrands);
  const pillBrands = React.useMemo(() => {
    if (!selectedBrand || filtered.some((b) => b.id === selectedBrand.id)) return filtered;
    return [selectedBrand, ...filtered];
  }, [filtered, selectedBrand]);

  const showPackInput = purchaseMode === 'pack' || purchaseMode === 'carton';

  // Live per-stick preview: the typed value IS the per-stick price; show the
  // resulting total so there's no ambiguity before saving.
  const pricePreview = React.useMemo(
    () => buildPricePreview(priceText, quantity, currencyFor(country), localeForCountry(country)),
    [priceText, quantity, country],
  );

  const handleSave = async () => {
    try {
      setSubmitting(true);
      setError(null);

      const qty = Math.max(1, Number(quantity) || 1);
      const ps = packSize ? Math.max(1, Number(packSize)) : null;
      // The price field is PER STICK and authoritative. A typed value is used
      // as-is (total = per-stick × quantity); we only infer when it's blank.
      const perStick = priceText ? Number(priceText) : null;
      if (priceText && (!Number.isFinite(perStick) || (perStick ?? -1) < 0)) {
        throw new Error('Enter a valid price per stick.');
      }

      const inferred =
        perStick == null ? await inferUnitPriceForVariant(variantName, brandId) : null;
      const result = resolveLogUnitPrice({
        perStickInr: perStick,
        quantity: qty,
        inferredUnitInr: inferred,
      });

      // Resolve the timestamp against a FRESH clock. "Now" logs at the current
      // instant. A custom backdate is re-clamped into the valid [now-24h, now]
      // window (with a small buffer off the 24h floor to absorb client/server
      // clock skew) rather than rejected: the picker validated against a clock
      // frozen at mount, so a form left open a while could otherwise trip the
      // cap on a pick that was in-window when chosen. Clamping — not throwing —
      // means a legitimate within-window entry never surfaces a false error.
      const now = new Date();
      let requestedTs: Date;
      if (backdate == null) {
        requestedTs = now;
      } else {
        const SKEW_BUFFER_MS = 60_000;
        const minMs = maxBackdateMs(now) + SKEW_BUFFER_MS;
        const maxMs = now.getTime();
        requestedTs = new Date(Math.max(minMs, Math.min(maxMs, backdate.getTime())));
      }

      await createLog({
        tsUtc: requestedTs.toISOString(),
        timeZone: timezoneForCountry(country),
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

      await revalidateAppViews();
      router.refresh();
      router.back();
    } catch (e) {
      setError(toSafeErrorMessage(e, 'dependency_failure'));
    } finally {
      setSubmitting(false);
    }
  };

  const idx = (n: number) => ({ ['--ed-index' as string]: n } as React.CSSProperties);

  // ── Choice option sets ─────────────────────────────────────────────────────
  const purchaseChoices = PURCHASE_MODES.map((m) => ({ value: m.value, label: m.label }));
  const triggerChoices = TRIGGER_OPTIONS.map((t) => ({ value: t.value, label: t.label }));
  const moodChoices = MOOD_OPTIONS.map((m) => ({ value: m.value, label: m.label }));
  const contextChoices = CONTEXT_OPTIONS.map((c) => ({ value: c.value, label: c.label }));
  const cravingChoices = Array.from({ length: 11 }, (_, n) => ({ value: n, label: String(n) }));
  const quantityChoices = QUANTITY_OPTIONS.map((n) => ({ value: n, label: String(n) }));

  return (
    <div className="relative page-column pt-xl pb-xxxl md:pt-xxl">
      <div aria-hidden className="paper-noise absolute inset-0 -z-10" />

      <div className="editorial-stage flex flex-col gap-xl">
        {/* ── Masthead ── */}
        <header style={idx(0)} className="flex flex-col gap-sm">
          <div className="flex items-center gap-md">
            <span aria-hidden className="h-px flex-1 bg-[var(--rule-strong)] rule-draw" style={idx(0)} />
            <span className="editorial-caption nums-tabular">Log · New entry</span>
            <span aria-hidden className="h-px flex-1 bg-[var(--rule-strong)] rule-draw" style={idx(0)} />
          </div>
          <p className="text-small text-text-muted text-center italic">
            Write one line into today&apos;s ledger.
          </p>
        </header>

        {/* ── Brand ── */}
        <section style={idx(1)}>
          <FieldRow
            label="Brand"
            sublabel={
              sortedBrands.length === 0
                ? 'Add a brand to your catalog before you can log an entry.'
                : 'Pick the brand for this entry — required.'
            }
          >
            {sortedBrands.length === 0 ? (
              <a
                href="/settings"
                className="inline-flex items-center min-h-11 text-small text-accent-ink underline underline-offset-4 decoration-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg rounded-sm"
              >
                Add a brand in Settings →
              </a>
            ) : (
              <>
                <CategoryTabs
                  categories={categories}
                  value={category}
                  onChange={setCategory}
                  ariaLabel="Brand category"
                />
                <EditorialPillRow
                  ariaLabel="Brand"
                  items={pillBrands.map((b) => ({
                    key: b.id,
                    label: b.isFavorite ? (
                      <>
                        <span aria-hidden className="mr-xs">
                          ★
                        </span>
                        {b.name}
                      </>
                    ) : (
                      b.name
                    ),
                    selected: brandId === b.id,
                    onPress: () => {
                      setBrandId(b.id);
                      setVariantName(null);
                    },
                  }))}
                />
              </>
            )}
          </FieldRow>
        </section>

        {/* ── Variant (only if brand has them) ── */}
        {selectedBrand && selectedBrand.variants.length > 0 ? (
          <section style={idx(2)}>
            <FieldRow label="Variant" sublabel="Tap again to deselect.">
              <EditorialPillRow
                ariaLabel="Variant"
                items={selectedBrand.variants.map((v) => ({
                  key: v.id,
                  label: v.name,
                  selected: variantName === v.name,
                  onPress: () =>
                    setVariantName((cur) => (cur === v.name ? null : v.name)),
                }))}
              />
            </FieldRow>
          </section>
        ) : null}

        {/* ── Quantity + Price (the always-visible essentials) ── */}
        <section style={idx(3)} className="grid grid-cols-1 md:grid-cols-2 gap-x-xl">
          <FieldRow label="Quantity" htmlFor="qty-input">
            <EditorialInput
              id="qty-input"
              type="number"
              inputMode="numeric"
              min={1}
              step={1}
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              aria-label="Quantity"
            />
          </FieldRow>
          <FieldRow
            label={`Price per stick (${currencyFor(country)})`}
            htmlFor="price-input"
            sublabel={
              <>
                Optional — leave blank to estimate from your catalog.
                <br />
                Always per stick, even for a pack or carton.
              </>
            }
            hint={pricePreview}
          >
            <EditorialInput
              id="price-input"
              type="number"
              inputMode="decimal"
              min={0}
              step="0.01"
              placeholder="0"
              value={priceText}
              onChange={(e) => setPriceText(e.target.value)}
              aria-label={`Price per stick in ${currencyFor(country)}`}
            />
          </FieldRow>
        </section>

        {/* ── When ── (backdate, capped at 24h back) */}
        <section style={idx(4)}>
          <FieldRow
            label="When"
            sublabel="Stamp this line with a specific moment. Useful when you log a few minutes after the fact."
          >
            <BackdateTimeField value={backdate} onChange={setBackdate} zone={timezoneForCountry(country)} />
          </FieldRow>
        </section>

        {/* ── Show / hide advanced ── */}
        <section style={idx(5)}>
          <button
            type="button"
            onClick={() => setShowAdvanced((s) => !s)}
            aria-expanded={showAdvanced}
            className="inline-flex items-center min-h-11 text-small text-text-muted hover:text-text underline underline-offset-4 decoration-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg rounded-sm"
            style={{ textDecorationColor: 'var(--rule-strong)' }}
          >
            {showAdvanced ? 'Hide trigger, mood, context, notes' : 'Add trigger, mood, context, notes'}
          </button>
        </section>

        {/* ── Advanced ── */}
        {showAdvanced ? (
          <>
            <section style={idx(6)}>
              <FieldRow label="Purchase" sublabel="How this stick was bought.">
                <ChoiceRun
                  options={purchaseChoices}
                  value={purchaseMode}
                  onSelect={(v) => v != null && setPurchaseMode(v)}
                  allowClear={false}
                  ariaLabel="Purchase mode"
                />
              </FieldRow>
            </section>

            {showPackInput ? (
              <section style={idx(7)}>
                <FieldRow
                  label="Pack size"
                  htmlFor="pack-input"
                  sublabel="Sticks in this pack or carton."
                >
                  <EditorialInput
                    id="pack-input"
                    type="number"
                    inputMode="numeric"
                    min={1}
                    step={1}
                    placeholder="20"
                    value={packSize}
                    onChange={(e) => setPackSize(e.target.value)}
                    aria-label="Pack size"
                  />
                </FieldRow>
              </section>
            ) : null}

            <section style={idx(8)}>
              <FieldRow label="Quantity (preset)" sublabel="Pick a common count, or type above.">
                <ChoiceRun
                  options={quantityChoices}
                  value={Number(quantity) || null}
                  onSelect={(v) => setQuantity(v == null ? '1' : String(v))}
                  allowClear={false}
                  ariaLabel="Quantity preset"
                />
              </FieldRow>
            </section>

            <section style={idx(9)}>
              <FieldRow label="Trigger" sublabel="What prompted this stick?">
                <ChoiceRun
                  options={triggerChoices}
                  value={triggerTag}
                  onSelect={(v) => setTriggerTag((cur) => (cur === v ? null : (v as TriggerTag | null)))}
                  ariaLabel="Trigger"
                />
              </FieldRow>
            </section>

            <section style={idx(10)}>
              <FieldRow label="Mood before" sublabel="How you felt going in.">
                <ChoiceRun
                  options={moodChoices}
                  value={moodBefore}
                  onSelect={(v) => setMoodBefore((cur) => (cur === v ? null : (v as Mood | null)))}
                  ariaLabel="Mood before"
                />
              </FieldRow>
            </section>

            <section style={idx(11)}>
              <FieldRow label="Mood after" sublabel="And how you felt at the end.">
                <ChoiceRun
                  options={moodChoices}
                  value={moodAfter}
                  onSelect={(v) => setMoodAfter((cur) => (cur === v ? null : (v as Mood | null)))}
                  ariaLabel="Mood after"
                />
              </FieldRow>
            </section>

            <section style={idx(12)}>
              <FieldRow label="Craving (0–10)" sublabel="Honest scale — zero is none.">
                <ChoiceRun
                  options={cravingChoices}
                  value={craving}
                  onSelect={(v) => setCraving(v == null ? null : Number(v))}
                  ariaLabel="Craving"
                />
              </FieldRow>
            </section>

            <section style={idx(13)}>
              <FieldRow label="Context" sublabel="Where or with whom.">
                <ChoiceRun
                  options={contextChoices}
                  value={contextTag}
                  onSelect={(v) => setContextTag((cur) => (cur === v ? null : (v as ContextTag | null)))}
                  ariaLabel="Context"
                />
              </FieldRow>
            </section>

            <section style={idx(14)}>
              <FieldRow
                label="Notes"
                htmlFor="notes-input"
                sublabel="Up to 500 characters. Honest writing helps you later."
                hint={`${notes.length}/500`}
              >
                <textarea
                  id="notes-input"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value.slice(0, 500))}
                  rows={3}
                  placeholder="A line about this one, if you want."
                  className="w-full bg-transparent border-0 border-b border-[var(--rule)] focus:border-[var(--text)] py-sm text-body text-text placeholder:text-text-faint outline-none resize-none transition-colors"
                />
              </FieldRow>
            </section>
          </>
        ) : null}

        {/* ── Save + Cancel ── */}
        <section style={idx(15)} className="flex flex-col items-center gap-sm pt-xl">
          {error ? (
            <p
              role="alert"
              className="text-small text-center mb-sm"
              style={{ color: 'var(--warn-earth-ink)' }}
            >
              {error}
            </p>
          ) : null}
          {brandId === null && sortedBrands.length > 0 ? (
            <p className="text-caption text-text-faint italic mb-xs">
              Choose a brand above to save this entry.
            </p>
          ) : null}
          <button
            type="button"
            onClick={handleSave}
            disabled={submitting || brandId === null}
            aria-busy={submitting}
            className="inline-flex items-center justify-center min-h-[48px] min-w-[14rem] px-xl rounded-md bg-text text-bg font-medium text-body hover:opacity-90 transition-opacity disabled:opacity-60 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
          >
            {submitting ? 'Saving…' : 'Save log'}
          </button>
          <button
            type="button"
            onClick={() => router.back()}
            className="min-h-11 px-xs text-small text-text-muted hover:text-text underline underline-offset-4 decoration-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg rounded-sm"
            style={{ textDecorationColor: 'var(--rule-strong)' }}
          >
            Cancel
          </button>
        </section>

        {/* ── End-mark ── */}
        <footer style={idx(16)} className="rule-hair pt-md text-center">
          <span className="text-caption text-text-faint italic">
            One line at a time.
          </span>
        </footer>
      </div>
    </div>
  );
}
