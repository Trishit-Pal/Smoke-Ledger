/*
 * ─────────────────────────────────────────────────────────────────────────────
 *  Log · New entry — writing one line into today's ledger
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *  Form metaphor (deliberate): a single editorial spread where each field is a
 *  hairline-row of typographic captions and controls, not a stack of Cards.
 *  One focused action: write a line, save it, return.
 *
 *  Layout mirrors web/app/(app)/log/new/LogNewClient.tsx:
 *    · Masthead (centred rule + caption + italic sub)
 *    · Brand pills (horizontal scroll, fav-first)
 *    · Variant pills (horizontal scroll, conditional)
 *    · Quantity field + Price field (row)
 *    · "Add trigger / mood / context / notes" toggle
 *    · Advanced: Purchase mode · Pack size · Qty preset · Trigger ·
 *                Mood before · Mood after · Craving (0-10) · Context · Notes
 *    · Save + Cancel
 *
 *  All capture fields from the original form are preserved:
 *    brand, variant, purchase mode, quantity, pack size, price,
 *    trigger, mood-before, mood-after, craving, context, notes.
 *
 *  Data paths: createLog, inferUnitPriceForVariant, deriveUnitPrice,
 *  analytics event (price_source), haptics — all unchanged.
 */

import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';

import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Divider } from '@/components/ui/Divider';

import { fonts, radius, spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';
import { useReduceMotion } from '@/hooks/useReduceMotion';

import { useSession } from '@/store/session';
import { createLog, inferUnitPriceForVariant } from '@/db/repositories/logs';
import { deriveUnitPrice } from '@/domain/calc';

import { TRIGGER_OPTIONS } from '@/constants/triggers';
import { MOOD_OPTIONS } from '@/constants/moods';
import { CONTEXT_OPTIONS } from '@/constants/contexts';

import { track } from '@/services/analytics';
import { AnalyticsEvents } from '@/constants/events';
import { success } from '@/lib/haptics';

import type { ContextTag, Mood, PurchaseMode, TriggerTag } from '@/types';

// ─── Constants ────────────────────────────────────────────────────────────────

const PURCHASE_MODES: { value: PurchaseMode; label: string }[] = [
  { value: 'single', label: 'Single' },
  { value: 'pack', label: 'Pack' },
  { value: 'carton', label: 'Carton' },
  { value: 'custom', label: 'Custom' },
];

const QUANTITY_PRESETS = [1, 2, 3, 4, 5, 6, 8, 10, 12, 15, 20, 25, 30, 40] as const;
const CRAVING_OPTIONS = Array.from({ length: 11 }, (_, n) => ({ value: n, label: String(n) }));

const TRIGGER_CHOICES = TRIGGER_OPTIONS.map((t) => ({ value: t.value, label: t.label }));
const MOOD_CHOICES = MOOD_OPTIONS.map((m) => ({ value: m.value, label: m.label }));
const CONTEXT_CHOICES = CONTEXT_OPTIONS.map((c) => ({ value: c.value, label: c.label }));

// ─── Editorial primitives ─────────────────────────────────────────────────────

interface FieldRowProps {
  label: string;
  sublabel?: string;
  hint?: string;
  children: React.ReactNode;
}

/**
 * Hairline-row form section: small-caps caption label + optional sublabel +
 * control + hairline Divider at the bottom. Matches web's FieldRow.
 */
function FieldRow({ label, sublabel, hint, children }: FieldRowProps) {
  const theme = useTheme();
  return (
    <View style={{ paddingVertical: spacing.md, gap: spacing.sm }}>
      <View style={{ gap: spacing.xs }}>
        <Text
          variant="caption"
          color={theme.textMuted}
          style={{ textTransform: 'uppercase', letterSpacing: 1.6 }}
        >
          {label}
        </Text>
        {sublabel ? (
          <Text variant="small" muted style={{ fontStyle: 'italic' }}>
            {sublabel}
          </Text>
        ) : null}
      </View>
      {children}
      {hint ? (
        <Text variant="caption" faint style={{ fontFamily: fonts.bodyMedium }}>
          {hint}
        </Text>
      ) : null}
      <Divider />
    </View>
  );
}

// ─── ChoiceRun ────────────────────────────────────────────────────────────────

interface ChoiceRunProps<T extends string | number> {
  options: readonly { value: T; label: string }[];
  value: T | null;
  onSelect: (next: T | null) => void;
  allowClear?: boolean;
  accessibilityLabel?: string;
}

/**
 * Options separated by middot characters — the publication's chip replacement.
 * Used for purchase mode, trigger, mood, context, craving. Clicking the active
 * choice clears it (unless allowClear = false).
 */
function ChoiceRun<T extends string | number>({
  options,
  value,
  onSelect,
  allowClear = true,
  accessibilityLabel,
}: ChoiceRunProps<T>) {
  const theme = useTheme();
  const reduce = useReduceMotion();
  return (
    <View
      style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' }}
      accessibilityRole="radiogroup"
      accessibilityLabel={accessibilityLabel}
    >
      {options.map((opt, i) => {
        const active = opt.value === value;
        return (
          <React.Fragment key={String(opt.value)}>
            {i > 0 ? (
              <Text
                variant="small"
                faint
                style={{ paddingHorizontal: spacing.xs, userSelect: 'none' } as object}
                aria-hidden
              >
                ·
              </Text>
            ) : null}
            <Pressable
              onPress={() => onSelect(active && allowClear ? null : opt.value)}
              accessibilityRole="radio"
              accessibilityState={{ checked: active }}
              accessibilityLabel={opt.label}
              hitSlop={spacing.xs}
            >
              <Text
                variant="caption"
                color={active ? theme.text : theme.textMuted}
                style={{
                  textTransform: 'uppercase',
                  letterSpacing: 1.2,
                  paddingVertical: spacing.xs,
                  paddingHorizontal: spacing.xs,
                  textDecorationLine: active ? 'underline' : 'none',
                  textDecorationColor: theme.ruleStrong,
                  textDecorationStyle: 'solid',
                  opacity: reduce ? 1 : undefined,
                } as object}
              >
                {opt.label}
              </Text>
            </Pressable>
          </React.Fragment>
        );
      })}
    </View>
  );
}

// ─── EditorialPillRow ─────────────────────────────────────────────────────────

interface PillItem {
  key: string;
  label: string;
  starred?: boolean;
  selected: boolean;
  onPress: () => void;
}

interface EditorialPillRowProps {
  items: PillItem[];
  accessibilityLabel: string;
}

/**
 * Hairline-outline pill row that scrolls horizontally. Used for brand + variant
 * where the set can be large. Selected = filled (text on bg), unselected =
 * bordered. Mirrors web's EditorialPillRow.
 */
function EditorialPillRow({ items, accessibilityLabel }: EditorialPillRowProps) {
  const theme = useTheme();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      accessibilityRole="radiogroup"
      accessible={false}
      contentContainerStyle={{ gap: spacing.sm, paddingVertical: spacing.xs }}
    >
      {items.map((it) => (
        <Pressable
          key={it.key}
          onPress={it.onPress}
          accessibilityRole="radio"
          accessibilityState={{ checked: it.selected }}
          accessibilityLabel={it.starred ? `Favourite: ${it.label}` : it.label}
        >
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              minHeight: 36,
              paddingHorizontal: spacing.md,
              borderRadius: radius.md,
              borderWidth: 1,
              borderColor: it.selected ? theme.text : theme.ruleStrong,
              backgroundColor: it.selected ? theme.text : 'transparent',
            }}
          >
            {it.starred ? (
              <Text
                variant="small"
                color={it.selected ? theme.bg : theme.textMuted}
                style={{ marginRight: spacing.xs }}
              >
                ★
              </Text>
            ) : null}
            <Text
              variant="small"
              color={it.selected ? theme.bg : theme.textMuted}
            >
              {it.label}
            </Text>
          </View>
        </Pressable>
      ))}
    </ScrollView>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function NewLog() {
  const router = useRouter();
  const theme = useTheme();

  const brands = useSession((s) => s.brands);
  const refreshLogs = useSession((s) => s.refreshLogs);
  const refreshBrands = useSession((s) => s.refreshBrands);

  // ── Form state ──────────────────────────────────────────────────────────────
  const [brandId, setBrandId] = useState<string | null>(null);
  const [variantName, setVariantName] = useState<string | null>(null);
  const [purchaseMode, setPurchaseMode] = useState<PurchaseMode>('single');
  const [quantity, setQuantity] = useState<string>('1');
  const [packSize, setPackSize] = useState<string>('');
  const [priceText, setPriceText] = useState<string>('');
  const [triggerTag, setTriggerTag] = useState<TriggerTag | null>(null);
  const [moodBefore, setMoodBefore] = useState<Mood | null>(null);
  const [moodAfter, setMoodAfter] = useState<Mood | null>(null);
  const [craving, setCraving] = useState<number | null>(null);
  const [contextTag, setContextTag] = useState<ContextTag | null>(null);
  const [notes, setNotes] = useState<string>('');

  const [showAdvanced, setShowAdvanced] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Guard against setState after unmount on async save
  const mountedRef = useRef(true);
  React.useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // ── Derived data ────────────────────────────────────────────────────────────
  const sortedBrands = useMemo(
    () =>
      [...brands].sort((a, b) => {
        if (a.isFavorite !== b.isFavorite) return a.isFavorite ? -1 : 1;
        return a.name.localeCompare(b.name);
      }),
    [brands],
  );

  const selectedBrand = useMemo(
    () => sortedBrands.find((b) => b.id === brandId) ?? null,
    [sortedBrands, brandId],
  );

  const showPackInput = purchaseMode === 'pack' || purchaseMode === 'carton';

  const brandPills: PillItem[] = useMemo(
    () =>
      sortedBrands.map((b) => ({
        key: b.id,
        label: b.name,
        starred: b.isFavorite,
        selected: brandId === b.id,
        onPress: () => {
          setBrandId(b.id);
          setVariantName(null);
        },
      })),
    [sortedBrands, brandId],
  );

  const variantPills: PillItem[] = useMemo(
    () =>
      (selectedBrand?.variants ?? []).map((v) => ({
        key: v.id,
        label: v.name,
        selected: variantName === v.name,
        onPress: () => {
          const isDeselect = variantName === v.name;
          setVariantName(isDeselect ? null : v.name);
          // Update pack size to the variant default when selecting (not on deselect)
          if (!isDeselect) {
            setPackSize(v.defaultPackSize ? String(v.defaultPackSize) : '');
          }
        },
      })),
    [selectedBrand, variantName],
  );

  // ── Save ────────────────────────────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    if (!mountedRef.current) return;
    setSaveError(null);
    setSaving(true);
    try {
      const qty = Math.max(1, Number(quantity) || 1);
      const ps = packSize ? Math.max(1, Number(packSize)) : null;
      const totalPrice = priceText ? Number(priceText) : null;

      if (priceText && (!Number.isFinite(totalPrice) || (totalPrice ?? -1) < 0)) {
        throw new Error('Enter a valid price.');
      }

      // Price inference: try log history first, then catalog
      let inferred: number | null = null;
      if (totalPrice == null && brandId) {
        inferred = await inferUnitPriceForVariant(variantName, brandId);
        if (inferred == null) {
          const v = selectedBrand?.variants.find((vt) => vt.name === variantName);
          inferred = v?.avgPriceInr != null
            ? v.avgPriceInr / (v.defaultPackSize || 10)
            : null;
        }
      }

      const priced = deriveUnitPrice({
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
        totalPriceInr: priced.totalPriceInr,
        unitPriceInr: priced.unitPriceInr,
        priceSource: priced.source,
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
        has_price: priced.unitPriceInr != null,
        price_source: priced.source,
      });

      success();

      await Promise.all([refreshLogs(), refreshBrands()]);

      if (mountedRef.current) router.back();
    } catch (e) {
      if (mountedRef.current) {
        setSaveError(e instanceof Error ? e.message : 'Could not save. Try again.');
      }
    } finally {
      if (mountedRef.current) setSaving(false);
    }
  }, [
    quantity, packSize, priceText, brandId, variantName, selectedBrand,
    purchaseMode, triggerTag, moodBefore, moodAfter, craving, contextTag,
    notes, refreshLogs, refreshBrands, router,
  ]);

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <Screen scroll={false} noPadding>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 24}
      >
        <ScrollView
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxxl, gap: spacing.sm }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >

          {/* ── Masthead ── */}
          <View style={{ gap: spacing.sm, marginBottom: spacing.md }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
              <View style={{ flex: 1, height: 1, backgroundColor: theme.ruleStrong }} />
              <Text
                variant="caption"
                color={theme.textMuted}
                style={{ textTransform: 'uppercase', letterSpacing: 1.6 }}
              >
                Log · New entry
              </Text>
              <View style={{ flex: 1, height: 1, backgroundColor: theme.ruleStrong }} />
            </View>
            <Text
              variant="small"
              muted
              style={{ textAlign: 'center', fontStyle: 'italic' }}
            >
              Write one line into today&apos;s ledger.
            </Text>
          </View>

          {/* ── Brand ── */}
          <FieldRow
            label="Brand"
            sublabel={
              sortedBrands.length === 0
                ? 'Add a brand to your catalog before you can log an entry.'
                : 'Pick the brand for this entry — required.'
            }
          >
            {sortedBrands.length === 0 ? (
              <Text variant="small" color={theme.accent} style={{ textDecorationLine: 'underline' }}>
                Add a brand in Settings →
              </Text>
            ) : (
              <EditorialPillRow items={brandPills} accessibilityLabel="Brand" />
            )}
          </FieldRow>

          {/* ── Variant (conditional) ── */}
          {selectedBrand && selectedBrand.variants.length > 0 ? (
            <FieldRow label="Variant" sublabel="Tap again to deselect.">
              <EditorialPillRow items={variantPills} accessibilityLabel="Variant" />
            </FieldRow>
          ) : null}

          {/* ── Quantity + Price ── */}
          <View style={{ flexDirection: 'row', gap: spacing.lg }}>
            <View style={{ flex: 1 }}>
              <FieldRow label="Quantity">
                <Input
                  keyboardType="number-pad"
                  value={quantity}
                  onChangeText={setQuantity}
                  accessibilityLabel="Quantity"
                />
              </FieldRow>
            </View>
            <View style={{ flex: 1 }}>
              <FieldRow
                label="Price (INR)"
                sublabel="Optional — leave blank to estimate."
              >
                <Input
                  keyboardType="decimal-pad"
                  value={priceText}
                  onChangeText={setPriceText}
                  placeholder="0"
                  accessibilityLabel="Total price in rupees"
                  hint="We use your recent average if left blank"
                />
              </FieldRow>
            </View>
          </View>

          {/* ── Advanced toggle ── */}
          <Pressable
            onPress={() => setShowAdvanced((s) => !s)}
            accessibilityRole="button"
            accessibilityState={{ expanded: showAdvanced }}
            accessibilityLabel={
              showAdvanced
                ? 'Hide trigger, mood, context, notes'
                : 'Add trigger, mood, context, notes'
            }
            hitSlop={spacing.sm}
          >
            <Text
              variant="small"
              muted
              style={{ textDecorationLine: 'underline', textDecorationColor: theme.ruleStrong }}
            >
              {showAdvanced
                ? 'Hide trigger, mood, context, notes'
                : 'Add trigger, mood, context, notes'}
            </Text>
          </Pressable>

          {/* ── Advanced fields ── */}
          {showAdvanced ? (
            <>
              {/* Purchase mode */}
              <FieldRow label="Purchase" sublabel="How this stick was bought.">
                <ChoiceRun
                  options={PURCHASE_MODES}
                  value={purchaseMode}
                  onSelect={(v) => { if (v != null) setPurchaseMode(v); }}
                  allowClear={false}
                  accessibilityLabel="Purchase mode"
                />
              </FieldRow>

              {/* Pack size (conditional) */}
              {showPackInput ? (
                <FieldRow label="Pack size" sublabel="Sticks in this pack or carton.">
                  <Input
                    keyboardType="number-pad"
                    value={packSize}
                    onChangeText={setPackSize}
                    placeholder="20"
                    accessibilityLabel="Pack size"
                  />
                </FieldRow>
              ) : null}

              {/* Quantity preset */}
              <FieldRow label="Quantity (preset)" sublabel="Pick a common count, or type above.">
                <ChoiceRun
                  options={QUANTITY_PRESETS.map((n) => ({ value: n, label: String(n) }))}
                  value={Number(quantity) || null}
                  onSelect={(v) => setQuantity(v == null ? '1' : String(v))}
                  allowClear={false}
                  accessibilityLabel="Quantity preset"
                />
              </FieldRow>

              {/* Trigger */}
              <FieldRow label="Trigger" sublabel="What prompted this stick?">
                <ChoiceRun
                  options={TRIGGER_CHOICES}
                  value={triggerTag}
                  onSelect={(v) => setTriggerTag((cur) => (cur === v ? null : (v as TriggerTag | null)))}
                  accessibilityLabel="Trigger"
                />
              </FieldRow>

              {/* Mood before */}
              <FieldRow label="Mood before" sublabel="How you felt going in.">
                <ChoiceRun
                  options={MOOD_CHOICES}
                  value={moodBefore}
                  onSelect={(v) => setMoodBefore((cur) => (cur === v ? null : (v as Mood | null)))}
                  accessibilityLabel="Mood before"
                />
              </FieldRow>

              {/* Mood after */}
              <FieldRow label="Mood after" sublabel="And how you felt at the end.">
                <ChoiceRun
                  options={MOOD_CHOICES}
                  value={moodAfter}
                  onSelect={(v) => setMoodAfter((cur) => (cur === v ? null : (v as Mood | null)))}
                  accessibilityLabel="Mood after"
                />
              </FieldRow>

              {/* Craving */}
              <FieldRow label="Craving (0–10)" sublabel="Honest scale — zero is none.">
                <ChoiceRun
                  options={CRAVING_OPTIONS}
                  value={craving}
                  onSelect={(v) => setCraving(v == null ? null : Number(v))}
                  accessibilityLabel="Craving"
                />
              </FieldRow>

              {/* Context */}
              <FieldRow label="Context" sublabel="Where or with whom.">
                <ChoiceRun
                  options={CONTEXT_CHOICES}
                  value={contextTag}
                  onSelect={(v) => setContextTag((cur) => (cur === v ? null : (v as ContextTag | null)))}
                  accessibilityLabel="Context"
                />
              </FieldRow>

              {/* Notes */}
              <FieldRow
                label="Notes"
                sublabel="Up to 500 characters. Honest writing helps you later."
                hint={`${notes.length}/500`}
              >
                <Input
                  multiline
                  value={notes}
                  onChangeText={(t) => setNotes(t.slice(0, 500))}
                  placeholder="A line about this one, if you want."
                  accessibilityLabel="Notes"
                  numberOfLines={3}
                />
              </FieldRow>
            </>
          ) : null}

          {/* ── Save + error + cancel ── */}
          <View style={{ marginTop: spacing.xl, gap: spacing.sm, alignItems: 'center' }}>
            {saveError ? (
              <Text
                variant="small"
                color={theme.warnEarth}
                style={{ textAlign: 'center' }}
                accessibilityRole="alert"
                accessibilityLiveRegion="polite"
              >
                {saveError}
              </Text>
            ) : null}

            {brandId === null && sortedBrands.length > 0 ? (
              <Text variant="caption" faint style={{ textAlign: 'center', fontStyle: 'italic' }}>
                Choose a brand above to save this entry.
              </Text>
            ) : null}

            <Button
              title={saving ? 'Saving…' : 'Save log'}
              size="lg"
              fullWidth
              loading={saving}
              disabled={saving || brandId === null}
              onPress={handleSave}
            />

            <Pressable
              onPress={() => router.back()}
              hitSlop={spacing.sm}
              accessibilityRole="button"
              accessibilityLabel="Cancel"
            >
              <Text
                variant="small"
                muted
                style={{ textDecorationLine: 'underline', textDecorationColor: theme.ruleStrong }}
              >
                Cancel
              </Text>
            </Pressable>
          </View>

          {/* ── End-mark ── */}
          <View style={{ marginTop: spacing.xl, alignItems: 'center', gap: spacing.sm }}>
            <View style={{ width: '100%', height: 1, backgroundColor: theme.rule }} />
            <Text variant="caption" faint style={{ fontStyle: 'italic' }}>
              One line at a time.
            </Text>
          </View>

        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
