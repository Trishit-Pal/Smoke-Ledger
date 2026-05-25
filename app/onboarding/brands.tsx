import React, { useEffect, useState, useMemo } from 'react';
import { View, ScrollView, Pressable, TextInput } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { Button } from '@/components/ui/Button';
import { Divider } from '@/components/ui/Divider';
import { FadeSlideIn } from '@/components/anim/FadeSlideIn';
import { spacing, radius } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';
import { listBrands, toggleFavorite } from '@/db/repositories/brands';
import { updateProfile, setOnboardingStep } from '@/db/repositories/profile';
import { setSetting } from '@/db/repositories/settings';
import { recordAuditEvent } from '@/services/audit';
import { toSafeErrorMessage } from '@/lib/errors';
import { useSession } from '@/store/session';
import type { Brand } from '@/types';

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

export default function BrandsPick() {
  const router = useRouter();
  const theme = useTheme();
  const refreshBrands = useSession((s) => s.refreshBrands);
  const refreshProfile = useSession((s) => s.refreshProfile);

  const [brands, setBrands] = useState<Brand[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const rows = await listBrands();
        setBrands(rows);
      } catch (e) {
        setErrorMsg(toSafeErrorMessage(e, 'dependency_failure'));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return brands;
    return brands.filter((b) => b.name.toLowerCase().includes(q));
  }, [brands, query]);

  const topPicks = useMemo(
    () => filtered.filter((b) => TOP_BRAND_NAMES.has(b.name)).slice(0, 16),
    [filtered],
  );

  const displayList = query.trim()
    ? filtered
    : topPicks.length > 0
      ? topPicks
      : filtered.slice(0, 16);

  const favorites = useMemo(() => brands.filter((b) => b.isFavorite), [brands]);

  const onToggle = async (brand: Brand) => {
    try {
      setErrorMsg(null);
      await toggleFavorite(brand.id);
      setBrands((rows) =>
        rows.map((row) =>
          row.id === brand.id ? { ...row, isFavorite: !row.isFavorite } : row,
        ),
      );
    } catch (e) {
      setErrorMsg(toSafeErrorMessage(e, 'dependency_failure'));
    }
  };

  const onFinish = async () => {
    setSubmitting(true);
    setErrorMsg(null);
    try {
      const now = new Date().toISOString();
      await Promise.all([
        updateProfile({ onboardedAt: now }),
        setSetting('consent.onboardingCompletedAt', now),
      ]);
      await setOnboardingStep('done');
      try {
        await recordAuditEvent('onboarding_completed', 'compliance', {});
      } catch (auditErr) {
        // Audit is non-gating — proceed regardless
        console.warn('[onboarding] onboarding_completed audit failed', auditErr);
      }
      await Promise.all([refreshBrands(), refreshProfile()]);
      router.replace('/onboarding/done');
    } catch (e) {
      setErrorMsg(toSafeErrorMessage(e, 'dependency_failure'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Screen>
      {/* Step header */}
      <FadeSlideIn index={0} delay={40}>
        <Text variant="caption" color={theme.textFaint} style={{ letterSpacing: 1.5 }}>
          STEP 04 · FAVORITES
        </Text>
      </FadeSlideIn>

      <FadeSlideIn index={1}>
        <Text variant="display">Pick a few brands for one-tap logging.</Text>
      </FadeSlideIn>

      <FadeSlideIn index={2}>
        <Text variant="body" muted>
          Two or three is enough — you can always add more from Settings. Don't see yours?
          Add a custom one later.
        </Text>
      </FadeSlideIn>

      {/* Hairline rule */}
      <FadeSlideIn index={3}>
        <View style={{ width: 60 }}>
          <Divider strong />
        </View>
      </FadeSlideIn>

      {/* Search */}
      <FadeSlideIn index={4}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            height: 44,
            paddingHorizontal: spacing.lg,
            borderRadius: radius.md,
            borderWidth: 1,
            borderColor: theme.rule,
            backgroundColor: theme.bgElevated,
            gap: spacing.sm,
          }}
        >
          <Text variant="small" color={theme.textMuted}>
            ⌕
          </Text>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search Gold Flake, Marlboro…"
            placeholderTextColor={theme.textFaint}
            style={{
              flex: 1,
              fontSize: 15,
              color: theme.text,
              fontFamily: 'DMSans_400Regular',
            }}
            returnKeyType="search"
            clearButtonMode="while-editing"
          />
        </View>
      </FadeSlideIn>

      {/* Brand list */}
      <FadeSlideIn index={5}>
        <View
          style={{
            borderTopWidth: 1,
            borderTopColor: theme.ruleStrong,
            borderBottomWidth: 1,
            borderBottomColor: theme.rule,
          }}
        >
          {loading ? (
            <View style={{ paddingVertical: spacing.xl, alignItems: 'center' }}>
              <Text variant="small" muted>
                Loading brands…
              </Text>
            </View>
          ) : displayList.length === 0 ? (
            <View style={{ paddingVertical: spacing.xl, alignItems: 'center' }}>
              <Text variant="small" muted>
                No brands match. You can add custom brands in Settings after onboarding.
              </Text>
            </View>
          ) : (
            <ScrollView style={{ maxHeight: 380 }} showsVerticalScrollIndicator={false}>
              {displayList.map((brand, i) => {
                const selected = brand.isFavorite;
                return (
                  <Pressable
                    key={brand.id}
                    onPress={() => void onToggle(brand)}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: spacing.md,
                      paddingVertical: spacing.md,
                      paddingHorizontal: spacing.xs,
                      borderBottomWidth: i < displayList.length - 1 ? 1 : 0,
                      borderBottomColor: theme.rule,
                      backgroundColor: selected ? theme.accentSoft : 'transparent',
                    }}
                  >
                    {/* Index */}
                    <Text
                      variant="caption"
                      color={selected ? theme.accent : theme.textFaint}
                      style={{ minWidth: 28, letterSpacing: 0.5 }}
                    >
                      {String(i + 1).padStart(2, '0')}
                    </Text>

                    {/* Name */}
                    <Text
                      variant="body"
                      color={theme.text}
                      style={{
                        flex: 1,
                        fontFamily: selected
                          ? 'DMSans_600SemiBold'
                          : 'DMSans_400Regular',
                      }}
                    >
                      {brand.name}
                    </Text>

                    {/* Category */}
                    <Text
                      variant="caption"
                      color={theme.textFaint}
                      style={{ minWidth: 56, textAlign: 'right' }}
                    >
                      {brand.category}
                    </Text>

                    {/* Selection circle */}
                    <View
                      style={{
                        width: 24,
                        height: 24,
                        borderRadius: radius.pill,
                        borderWidth: selected ? 0 : 1,
                        borderColor: theme.ruleStrong,
                        backgroundColor: selected ? theme.accent : 'transparent',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {selected ? (
                        <Text variant="caption" color="#ffffff">
                          ✓
                        </Text>
                      ) : (
                        <Text variant="caption" color={theme.textFaint}>
                          +
                        </Text>
                      )}
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>
          )}
        </View>
      </FadeSlideIn>

      {/* Selected chips */}
      {favorites.length > 0 ? (
        <FadeSlideIn index={6}>
          <View style={{ gap: spacing.sm }}>
            <Text variant="caption" color={theme.accent} style={{ letterSpacing: 1.2 }}>
              {favorites.length} SELECTED
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
              {favorites.map((brand) => (
                <Pressable
                  key={brand.id}
                  onPress={() => void onToggle(brand)}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: spacing.sm,
                    height: 32,
                    paddingHorizontal: spacing.md,
                    borderRadius: radius.pill,
                    backgroundColor: theme.accent,
                  }}
                >
                  <Text variant="small" color="#ffffff">
                    {brand.name}
                  </Text>
                  <Text variant="caption" color="rgba(255,255,255,0.7)">
                    ×
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        </FadeSlideIn>
      ) : null}

      {/* Error */}
      {errorMsg ? (
        <FadeSlideIn index={7}>
          <Text variant="small" color={theme.warnEarth}>
            {errorMsg}
          </Text>
        </FadeSlideIn>
      ) : null}

      {/* Footer nav */}
      <FadeSlideIn index={8}>
        <View style={{ flexDirection: 'row', gap: spacing.md }}>
          <Button
            title="← Back"
            variant="secondary"
            style={{ flex: 1 }}
            onPress={() => router.push('/onboarding/goal')}
          />
          <Button
            title={submitting ? 'Finishing…' : 'Finish setup →'}
            loading={submitting}
            disabled={favorites.length === 0 || submitting}
            style={{ flex: 2 }}
            onPress={onFinish}
          />
        </View>
      </FadeSlideIn>
    </Screen>
  );
}
