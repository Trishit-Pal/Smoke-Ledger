import React, { useEffect, useState } from 'react';
import { View, Switch, Alert, Linking } from 'react-native';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { useRouter } from 'expo-router';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Divider } from '@/components/ui/Divider';
import { Input } from '@/components/ui/Input';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { Chip } from '@/components/ui/Chip';
import { spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';
import { useSession } from '@/store/session';
import { updateProfile } from '@/db/repositories/profile';
import { getSetting, setSetting } from '@/db/repositories/settings';
import { createBrand, upsertVariant } from '@/db/repositories/brands';
import { eraseAllUserData } from '@/services/cloudErase';
import { deleteUserAccount } from '@/services/deleteUserAccount';
import { exportAccountData } from '@/services/exportAccountData';
import { wipeSecureStore } from '@/lib/secureStore';
import { getSupabase } from '@/lib/supabase';
import { cancelAll } from '@/services/notifications';
import {
  invalidateAnalyticsConsentCache,
  primeAnalyticsConsentCache,
  track,
} from '@/services/analytics';
import { AnalyticsEvents } from '@/constants/events';
import { LEGAL_URLS } from '@/lib/legal';
import { toSafeErrorMessage } from '@/lib/errors';
import type { Brand } from '@/types';

export default function Settings() {
  const theme = useTheme();
  const router = useRouter();
  const profile = useSession((s) => s.profile);
  const booted = useSession((s) => s.booted);
  const refreshProfile = useSession((s) => s.refreshProfile);
  const refreshBrands = useSession((s) => s.refreshBrands);
  const boot = useSession((s) => s.boot);
  const [baseline, setBaseline] = useState<string>(
    profile?.baselinePerDay != null ? String(profile.baselinePerDay) : '',
  );
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [analyticsOptIn, setAnalyticsOptIn] = useState(false);
  const [newBrandName, setNewBrandName] = useState('');
  const [newVariantName, setNewVariantName] = useState('Regular');
  const [newPackSize, setNewPackSize] = useState('20');
  const [newAvgPrice, setNewAvgPrice] = useState('');
  const [newCategory, setNewCategory] = useState<Brand['category']>('regular');

  useEffect(() => {
    (async () => {
      const value = await getSetting<boolean>('consent.analyticsOptIn');
      setAnalyticsOptIn(value === true);
    })();
  }, []);

  const toggle = async (key: keyof NonNullable<typeof profile>, value: boolean) => {
    try {
      await updateProfile({ [key]: value } as any);
      await refreshProfile();
    } catch (e) {
      Alert.alert('Update failed', toSafeErrorMessage(e, 'dependency_failure'));
    }
  };

  const saveBaseline = async () => {
    setSaveError(null);
    setSaving(true);
    try {
      const n = baseline === '' ? null : Number(baseline);
      await updateProfile({ baselinePerDay: Number.isFinite(n as number) ? (n as number) : null });
      await refreshProfile();
    } catch (e) {
      setSaveError(toSafeErrorMessage(e, 'validation_error'));
    } finally {
      setSaving(false);
    }
  };

  const toggleAnalytics = async (value: boolean) => {
    setBusy(true);
    try {
      await setSetting('consent.analyticsOptIn', value);
      const {
        data: { user },
      } = await getSupabase().auth.getUser();
      if (user) {
        primeAnalyticsConsentCache(user.id, value);
      } else {
        invalidateAnalyticsConsentCache();
      }
      setAnalyticsOptIn(value);
    } catch (e) {
      Alert.alert('Update failed', toSafeErrorMessage(e, 'dependency_failure'));
    } finally {
      setBusy(false);
    }
  };

  const exportData = async () => {
    setBusy(true);
    try {
      const payload = await exportAccountData();
      const json = JSON.stringify(payload, null, 2);
      const path = `${FileSystem.cacheDirectory}smoke-ledger-export-${new Date().toISOString().slice(0, 10)}.json`;
      await FileSystem.writeAsStringAsync(path, json, { encoding: FileSystem.EncodingType.UTF8 });
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(path, {
          mimeType: 'application/json',
          dialogTitle: 'Export Smoke Ledger data',
        });
      } else {
        Alert.alert(
          'Export ready',
          'Sharing is unavailable on this device. The export file was saved to app cache.',
        );
      }
      await track(AnalyticsEvents.EXPORT_REQUESTED, { format: 'json' });
      if (payload.truncated) {
        Alert.alert(
          'Export may be incomplete',
          'This file includes your most recent entries only. Older entries beyond the export limit were not included. Contact support if you need a full historical export.',
        );
      }
    } catch (e) {
      Alert.alert('Export failed', toSafeErrorMessage(e, 'dependency_failure'));
    } finally {
      setBusy(false);
    }
  };

  const addCustomBrand = async () => {
    const brandName = newBrandName.trim();
    const variantName = newVariantName.trim() || 'Regular';
    const packSize = Number(newPackSize);
    const avgPrice = newAvgPrice.trim() === '' ? null : Number(newAvgPrice);
    if (!brandName) {
      Alert.alert('Validation', 'Brand name is required.');
      return;
    }
    if (!Number.isFinite(packSize) || packSize < 1) {
      Alert.alert('Validation', 'Pack size must be a positive number.');
      return;
    }
    if (avgPrice != null && (!Number.isFinite(avgPrice) || avgPrice < 0)) {
      Alert.alert('Validation', 'Average price must be valid.');
      return;
    }
    setBusy(true);
    try {
      const brand = await createBrand(brandName, newCategory);
      await upsertVariant(brand.id, variantName, packSize, avgPrice);
      await refreshBrands();
      await track(AnalyticsEvents.BRAND_CREATED, { category: newCategory, is_seed: false });
      setNewBrandName('');
      setNewVariantName('Regular');
      setNewPackSize('20');
      setNewAvgPrice('');
      setNewCategory('regular');
    } catch (e) {
      Alert.alert('Brand not added', toSafeErrorMessage(e, 'validation_error'));
    } finally {
      setBusy(false);
    }
  };

  const signOut = () => {
    Alert.alert('Sign out?', 'You will need to sign in again to view your data.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: async () => {
          setBusy(true);
          try {
            await getSupabase().auth.signOut();
            router.replace('/login');
          } catch (e) {
            Alert.alert('Sign out failed', toSafeErrorMessage(e, 'dependency_failure'));
          } finally {
            setBusy(false);
          }
        },
      },
    ]);
  };

  const deleteAccount = () => {
    Alert.alert(
      'Delete account?',
      'Permanently deletes your Supabase auth account and all cloud data. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setBusy(true);
            try {
              await deleteUserAccount();
              await wipeSecureStore();
              router.replace('/login');
            } catch (e) {
              Alert.alert('Error', toSafeErrorMessage(e, 'dependency_failure'));
            } finally {
              setBusy(false);
            }
          },
        },
      ],
    );
  };

  const eraseAll = () => {
    Alert.alert(
      'Erase all data?',
      'Removes every log, brand, goal and setting from your cloud account for this app. Your login will stay active. Default brands will be restored.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Erase',
          style: 'destructive',
          onPress: async () => {
            setBusy(true);
            try {
              await cancelAll();
              await eraseAllUserData();
              await wipeSecureStore();
              await boot();
              router.replace('/onboarding/welcome');
            } catch (e) {
              Alert.alert('Error', toSafeErrorMessage(e, 'dependency_failure'));
            } finally {
              setBusy(false);
            }
          },
        },
      ],
    );
  };

  if (!booted) {
    return (
      <Screen>
        <Text variant="small" muted>
          Loading settings…
        </Text>
      </Screen>
    );
  }

  if (!profile) {
    return (
      <Screen>
        <Text variant="small" muted>
          Could not load your profile. Pull to refresh or sign in again.
        </Text>
        <Button title="Retry" onPress={() => void refreshProfile()} />
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={{ gap: spacing.xs }}>
        <Text variant="caption" muted>
          SETTINGS
        </Text>
        <Text variant="display">Preferences</Text>
      </View>

      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ gap: 2 }}>
            <Text variant="bodyStrong">Appearance</Text>
            <Text variant="caption" muted>Light · Auto · Dark</Text>
          </View>
          <ThemeToggle />
        </View>
      </Card>

      <Card>
        <View style={{ gap: spacing.md }}>
          <Text variant="bodyStrong">Baseline</Text>
          <Input
            label="Sticks per day"
            keyboardType="number-pad"
            value={baseline}
            onChangeText={setBaseline}
            placeholder="e.g., 10"
          />
          <Button title="Save baseline" onPress={saveBaseline} loading={saving} />
          {saveError ? (
            <Text variant="small" color={theme.danger}>{saveError}</Text>
          ) : null}
        </View>
      </Card>

      <Card>
        <View style={{ gap: spacing.md }}>
          <Text variant="bodyStrong">Privacy</Text>
          <Row
            label="Discreet mode"
            hint="Hides numeric totals and brand names on Home"
            value={profile.discreetMode}
            onChange={(v) => {
              toggle('discreetMode', v);
              if (v) track(AnalyticsEvents.DISCREET_MODE_ENABLED, { enabled: true });
            }}
          />
          <Divider />
          <Row
            label="Hide totals on Home"
            hint="Masks sticks and spend on the dashboard"
            value={profile.hideTotalsOnHome}
            onChange={(v) => toggle('hideTotalsOnHome', v)}
          />
          <Divider />
          <Row
            label="Product analytics"
            hint="Optional first-party analytics events to improve app quality"
            value={analyticsOptIn}
            onChange={toggleAnalytics}
          />
        </View>
      </Card>

      <Card>
        <View style={{ gap: spacing.md }}>
          <Text variant="bodyStrong">Account</Text>
          <Text variant="small" muted>
            Data is stored in Smoke Ledger cloud (Supabase Postgres). Sign in is required to use the app.
          </Text>
          <Button title="Export account data" variant="secondary" onPress={exportData} loading={busy} />
          <Button title="Sign out" variant="secondary" onPress={signOut} loading={busy} />
          <Button title="Delete account" variant="danger" onPress={deleteAccount} loading={busy} />
        </View>
      </Card>

      <Card>
        <View style={{ gap: spacing.md }}>
          <Text variant="bodyStrong">Brand catalog</Text>
          <Text variant="small" muted>
            Add custom brands and variants if your preferred option is missing.
          </Text>
          <Input
            label="Brand name"
            value={newBrandName}
            onChangeText={setNewBrandName}
            placeholder="e.g., Camel"
          />
          <Input
            label="Variant"
            value={newVariantName}
            onChangeText={setNewVariantName}
            placeholder="e.g., Blue"
          />
          <View style={{ flexDirection: 'row', gap: spacing.md }}>
            <Input
              label="Pack size"
              keyboardType="number-pad"
              value={newPackSize}
              onChangeText={setNewPackSize}
              containerStyle={{ flex: 1 }}
            />
            <Input
              label="Avg price (₹)"
              keyboardType="decimal-pad"
              value={newAvgPrice}
              onChangeText={setNewAvgPrice}
              placeholder="optional"
              containerStyle={{ flex: 1 }}
            />
          </View>
          <Text variant="caption" muted>
            CATEGORY
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            {(['budget', 'regular', 'premium', 'imported', 'other'] as Brand['category'][]).map(
              (category) => (
                <Chip
                  key={category}
                  label={category}
                  selected={newCategory === category}
                  onPress={() => setNewCategory(category)}
                />
              ),
            )}
          </View>
          <Button title="Add brand" variant="secondary" onPress={addCustomBrand} loading={busy} />
        </View>
      </Card>

      <Card>
        <View style={{ gap: spacing.sm }}>
          <Text variant="bodyStrong">About Smoke Ledger</Text>
          <Text variant="small" muted>
            Cessation support for smoking behavior and spend in INR. Data syncs securely to the cloud.
            No advertising SDKs. Optional usage events stay in first-party tables. This is not medical
            advice and not a substitute for professional care.
          </Text>
          <View style={{ flexDirection: 'row', gap: spacing.md }}>
            <Button
              title="Privacy"
              size="sm"
              variant="secondary"
              onPress={() => Linking.openURL(LEGAL_URLS.privacy)}
            />
            <Button
              title="Terms"
              size="sm"
              variant="secondary"
              onPress={() => Linking.openURL(LEGAL_URLS.terms)}
            />
            <Button
              title="Support"
              size="sm"
              variant="secondary"
              onPress={() => Linking.openURL(LEGAL_URLS.support)}
            />
          </View>
          <Text variant="caption" muted>
            v0.2.0
          </Text>
        </View>
      </Card>

      <Card>
        <View style={{ gap: spacing.sm }}>
          <Text variant="bodyStrong" color={theme.danger}>
            Danger zone
          </Text>
          <Text variant="small" muted>
            Erases app data in the cloud for this account. Your login remains; default brands are
            re-seeded.
          </Text>
          <Button title="Erase all data" variant="danger" onPress={eraseAll} loading={busy} />
        </View>
      </Card>
    </Screen>
  );
}

interface RowProps {
  label: string;
  hint?: string;
  value: boolean;
  onChange: (v: boolean) => void;
}

function Row({ label, hint, value, onChange }: RowProps) {
  const theme = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="body">{label}</Text>
        {hint ? (
          <Text variant="caption" muted>
            {hint}
          </Text>
        ) : null}
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: theme.border, true: theme.accent }}
      />
    </View>
  );
}
