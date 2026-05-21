import React, { useEffect, useState } from 'react';
import { View, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { Card } from '@/components/ui/Card';
import { spacing } from '@/constants/theme';
import { listBrands, toggleFavorite } from '@/db/repositories/brands';
import { updateProfile, setOnboardingStep } from '@/db/repositories/profile';
import { setSetting } from '@/db/repositories/settings';
import { recordAuditEvent } from '@/services/audit';
import type { Brand } from '@/types';
import { useSession } from '@/store/session';

export default function BrandsPick() {
  const router = useRouter();
  const refresh = useSession((s) => s.refreshBrands);
  const [brands, setBrands] = useState<Brand[]>([]);

  useEffect(() => {
    (async () => setBrands(await listBrands()))();
  }, []);

  return (
    <Screen>
      <View style={{ gap: spacing.lg }}>
        <Text variant="h1">Favourite brands</Text>
        <Text variant="body" muted>
          Tap the brands you use most. This puts them at the top of the quick-log
          picker.
        </Text>

        <Card>
          <ScrollView style={{ maxHeight: 420 }}>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
              {brands.map((b) => (
                <Chip
                  key={b.id}
                  label={b.name}
                  selected={b.isFavorite}
                  onPress={async () => {
                    await toggleFavorite(b.id);
                    setBrands((xs) =>
                      xs.map((x) => (x.id === b.id ? { ...x, isFavorite: !x.isFavorite } : x)),
                    );
                  }}
                />
              ))}
            </View>
          </ScrollView>
        </Card>

        <Button
          title="Continue"
          fullWidth
          size="lg"
          onPress={async () => {
            await refresh();
            const now = new Date().toISOString();
            await Promise.all([
              updateProfile({ onboardedAt: now }),
              setSetting('consent.onboardingCompletedAt', now),
            ]);
            await setOnboardingStep('done');
            await recordAuditEvent('onboarding_completed', 'compliance', {});
            router.replace('/(tabs)');
          }}
        />
      </View>
    </Screen>
  );
}
