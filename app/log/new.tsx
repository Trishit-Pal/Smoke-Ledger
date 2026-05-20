import React, { useMemo, useState } from 'react';
import { View, ScrollView, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Chip } from '@/components/ui/Chip';
import { Divider } from '@/components/ui/Divider';
import { spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';
import { useSession } from '@/store/session';
import { createLog, inferUnitPriceForVariant } from '@/db/repositories/logs';
import { deriveUnitPrice } from '@/domain/calc';
import { TRIGGER_OPTIONS } from '@/constants/triggers';
import { MOOD_OPTIONS } from '@/constants/moods';
import { CONTEXT_OPTIONS } from '@/constants/contexts';
import { track } from '@/services/analytics';
import { AnalyticsEvents } from '@/constants/events';
import { success } from '@/lib/haptics';
import type { Mood, PurchaseMode, TriggerTag, ContextTag } from '@/types';

const MODES: { id: PurchaseMode; label: string }[] = [
  { id: 'single', label: 'Single' },
  { id: 'pack', label: 'Pack' },
  { id: 'carton', label: 'Carton' },
  { id: 'custom', label: 'Custom' },
];

const priceLabelFor = (mode: PurchaseMode) =>
  mode === 'pack' ? 'Pack price (₹)' : mode === 'carton' ? 'Carton price (₹)' : 'Total paid (₹)';

export default function NewLog() {
  const router = useRouter();
  const theme = useTheme();
  const brands = useSession((s) => s.brands);
  const refreshLogs = useSession((s) => s.refreshLogs);
  const refreshBrands = useSession((s) => s.refreshBrands);

  const [brandId, setBrandId] = useState<string | null>(null);
  const [variantName, setVariantName] = useState<string | null>(null);
  const [quantity, setQuantity] = useState('1');
  const [mode, setMode] = useState<PurchaseMode>('single');
  const [packSize, setPackSize] = useState('10');
  const [totalPrice, setTotalPrice] = useState('');
  const [trigger, setTrigger] = useState<TriggerTag | null>(null);
  const [moodBefore, setMoodBefore] = useState<Mood | null>(null);
  const [context, setContext] = useState<ContextTag | null>(null);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const { favs, others, selected } = useMemo(() => ({
    favs: brands.filter((b) => b.isFavorite).slice(0, 8),
    others: brands.filter((b) => !b.isFavorite).slice(0, 30),
    selected: brands.find((b) => b.id === brandId) ?? null,
  }), [brands, brandId]);

  const selectBrand = (id: string, firstVariant?: string) => {
    setBrandId(id);
    setVariantName(firstVariant ?? null);
  };

  const selectVariant = (name: string, defaultPack: number) => {
    setVariantName(name);
    setPackSize(String(defaultPack));
  };

  const handleSave = async () => {
    setSaveError(null);
    setSaving(true);
    try {
      const q = Math.max(1, Number(quantity) || 1);
      const pSize = mode === 'pack' || mode === 'carton' ? Number(packSize) || null : null;
      const total = totalPrice ? Number(totalPrice) : null;

      let inferred: number | null = null;
      if (total == null && brandId) {
        inferred = await inferUnitPriceForVariant(variantName, brandId);
        if (inferred == null) {
          const v = selected?.variants.find((v) => v.name === variantName);
          inferred = v?.avgPriceInr ? v.avgPriceInr / (v.defaultPackSize || 10) : null;
        }
      }

      const priced = deriveUnitPrice({ quantity: q, purchaseMode: mode, packSize: pSize, totalPriceInr: total, inferredUnitInr: inferred });

      await createLog({
        tsUtc: new Date().toISOString(),
        brandId,
        brandNameSnap: selected?.name ?? null,
        variantSnap: variantName,
        quantity: q,
        purchaseMode: mode,
        packSize: pSize,
        totalPriceInr: priced.totalPriceInr,
        unitPriceInr: priced.unitPriceInr,
        priceSource: priced.source,
        triggerTag: trigger,
        moodBefore,
        moodAfter: null,
        craving: null,
        contextTag: context,
        notes: notes.trim() || null,
      });
      await track(AnalyticsEvents.CIGARETTE_LOGGED, { quantity: q, mode, has_price: priced.totalPriceInr != null, price_source: priced.source });
      success();
      await Promise.all([refreshLogs(), refreshBrands()]);
      router.back();
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Could not save. Try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text variant="h1">New log</Text>
        <Pressable onPress={() => router.back()} hitSlop={8} accessibilityRole="button" accessibilityLabel="Cancel">
          <Text variant="bodyStrong" color={theme.textMuted}>Cancel</Text>
        </Pressable>
      </View>

      {/* Brand */}
      <Card>
        <View style={{ gap: spacing.md }}>
          <Text variant="bodyStrong">Brand</Text>
          {brands.length === 0 ? (
            <Text variant="small" muted>No brands available. Add brands in Settings to log by brand.</Text>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                {favs.map((b) => (
                  <Chip key={b.id} label={`★ ${b.name}`} selected={brandId === b.id}
                    onPress={() => selectBrand(b.id, b.variants[0]?.name)} />
                ))}
                {others.map((b) => (
                  <Chip key={b.id} label={b.name} selected={brandId === b.id}
                    onPress={() => selectBrand(b.id, b.variants[0]?.name)} />
                ))}
              </View>
            </ScrollView>
          )}
          {selected && selected.variants.length > 0 && (
            <View style={{ gap: spacing.sm }}>
              <Text variant="caption" muted>VARIANT</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
                {selected.variants.map((v) => (
                  <Chip key={v.id} label={v.name} selected={variantName === v.name}
                    onPress={() => selectVariant(v.name, v.defaultPackSize)} />
                ))}
              </View>
            </View>
          )}
        </View>
      </Card>

      {/* Purchase */}
      <Card>
        <View style={{ gap: spacing.md }}>
          <Text variant="bodyStrong">How did you buy?</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            {MODES.map((m) => (
              <Chip key={m.id} label={m.label} selected={mode === m.id} onPress={() => setMode(m.id)} />
            ))}
          </View>
          <View style={{ flexDirection: 'row', gap: spacing.md }}>
            <Input label="Sticks" keyboardType="number-pad" value={quantity}
              onChangeText={setQuantity} containerStyle={{ flex: 1 }} />
            {(mode === 'pack' || mode === 'carton') && (
              <Input label="Pack size" keyboardType="number-pad" value={packSize}
                onChangeText={setPackSize} containerStyle={{ flex: 1 }} />
            )}
          </View>
          <Input
            label={priceLabelFor(mode)}
            keyboardType="decimal-pad"
            value={totalPrice}
            onChangeText={setTotalPrice}
            placeholder="Leave blank to estimate"
            hint="We use your recent average if left blank"
          />
        </View>
      </Card>

      {/* Context */}
      <Card>
        <View style={{ gap: spacing.md }}>
          <Text variant="bodyStrong">Why now? (optional)</Text>
          <ChipRow options={TRIGGER_OPTIONS} value={trigger} onChange={(v) => setTrigger(v as TriggerTag | null)} />
          <Divider />
          <Text variant="caption" muted>MOOD</Text>
          <ChipRow options={MOOD_OPTIONS} value={moodBefore} onChange={(v) => setMoodBefore(v as Mood | null)} />
          <Divider />
          <Text variant="caption" muted>WHERE / WITH WHOM</Text>
          <ChipRow options={CONTEXT_OPTIONS} value={context} onChange={(v) => setContext(v as ContextTag | null)} />
          <Input label="Notes" multiline value={notes} onChangeText={setNotes}
            placeholder="Anything worth remembering" />
        </View>
      </Card>

      <Button title="Save log" size="lg" fullWidth loading={saving} onPress={handleSave} />
      {saveError && (
        <Text variant="small" color={theme.danger} style={{ textAlign: 'center' }}>{saveError}</Text>
      )}
    </Screen>
  );
}

function ChipRow<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T | null;
  onChange: (v: T | null) => void;
}) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
      {options.map((o) => (
        <Chip key={o.value} label={o.label} selected={value === o.value}
          onPress={() => onChange(value === o.value ? null : o.value)} />
      ))}
    </View>
  );
}
