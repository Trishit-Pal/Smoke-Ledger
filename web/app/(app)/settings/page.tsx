'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Header } from '@web/components/layout/Header';
import { Card } from '@web/components/ui/Card';
import { Button } from '@web/components/ui/Button';
import { Input } from '@web/components/ui/Input';
import { Text } from '@web/components/ui/Text';
import { updateProfile } from '@/db/repositories/profile';
import { useSession } from '@/store/session';
import { getSupabase } from '@web/lib/supabase/client';
import { track } from '@/services/analytics';
import { AnalyticsEvents } from '@/constants/events';
import { eraseAllUserData } from '@/services/cloudErase';
import { deleteUserAccount } from '@/services/deleteUserAccount';
import { wipeSecureStore } from '@/lib/secureStore';
import { exportAccountData } from '@/services/exportAccountData';
import { getSetting, setSetting } from '@/db/repositories/settings';
import { toSafeErrorMessage } from '@/lib/errors';
import { invalidateAnalyticsConsentCache, primeAnalyticsConsentCache } from '@/services/analytics';
import { createBrand, upsertVariant } from '@/db/repositories/brands';
import type { Brand } from '@/types';

type BusyAction =
  | null
  | 'save-profile'
  | 'signout'
  | 'export-json'
  | 'erase-all'
  | 'delete-account'
  | 'toggle-discreet'
  | 'toggle-hide'
  | 'toggle-analytics'
  | 'add-brand';

export default function SettingsPage() {
  const router = useRouter();
  const { booted, boot, profile, refreshProfile, refreshLogs, refreshBrands, refreshGoals, reset } =
    useSession();
  const [baseline, setBaseline] = React.useState('');
  const [analyticsOptIn, setAnalyticsOptIn] = React.useState(false);
  const [newBrandName, setNewBrandName] = React.useState('');
  const [newVariantName, setNewVariantName] = React.useState('Regular');
  const [newPackSize, setNewPackSize] = React.useState('20');
  const [newAvgPrice, setNewAvgPrice] = React.useState('');
  const [newCategory, setNewCategory] = React.useState<Brand['category']>('regular');
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState<BusyAction>(null);

  React.useEffect(() => {
    if (!booted) {
      void boot().catch(() => {});
    }
  }, [booted, boot]);

  React.useEffect(() => {
    setBaseline(profile?.baselinePerDay != null ? String(profile.baselinePerDay) : '');
  }, [profile?.baselinePerDay]);

  React.useEffect(() => {
    void (async () => {
      const value = await getSetting<boolean>('consent.analyticsOptIn');
      setAnalyticsOptIn(value === true);
    })();
  }, []);

  const onSaveProfile = async () => {
    setBusy('save-profile');
    setError(null);
    try {
      const parsed = baseline.trim() === '' ? null : Number(baseline);
      if (parsed != null && (!Number.isFinite(parsed) || parsed < 0)) {
        throw new Error('Baseline must be a valid number.');
      }
      await updateProfile({ baselinePerDay: parsed });
      await refreshProfile();
    } catch (e) {
      setError(toSafeErrorMessage(e, 'validation_error'));
    } finally {
      setBusy(null);
    }
  };

  const onToggleDiscreet = async (value: boolean) => {
    setBusy('toggle-discreet');
    setError(null);
    try {
      await updateProfile({ discreetMode: value });
      await refreshProfile();
      if (value) {
        await track(AnalyticsEvents.DISCREET_MODE_ENABLED, { enabled: true });
      }
    } catch (e) {
      setError(toSafeErrorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  const onToggleHideTotals = async (value: boolean) => {
    setBusy('toggle-hide');
    setError(null);
    try {
      await updateProfile({ hideTotalsOnHome: value });
      await refreshProfile();
    } catch (e) {
      setError(toSafeErrorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  const onToggleAnalytics = async (value: boolean) => {
    setBusy('toggle-analytics');
    setError(null);
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
      setError(toSafeErrorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  const onExportJson = async () => {
    setBusy('export-json');
    setError(null);
    try {
      const payload = await exportAccountData();

      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `smoke-ledger-export-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      await track(AnalyticsEvents.EXPORT_REQUESTED, { format: 'json' });
    } catch (e) {
      setError(toSafeErrorMessage(e, 'dependency_failure'));
    } finally {
      setBusy(null);
    }
  };

  const onAddCustomBrand = async () => {
    const brandName = newBrandName.trim();
    const variantName = newVariantName.trim() || 'Regular';
    const packSize = Number(newPackSize);
    const avgPrice = newAvgPrice.trim() === '' ? null : Number(newAvgPrice);
    if (!brandName) {
      setError('Brand name is required.');
      return;
    }
    if (!Number.isFinite(packSize) || packSize < 1) {
      setError('Pack size must be a valid positive number.');
      return;
    }
    if (avgPrice != null && (!Number.isFinite(avgPrice) || avgPrice < 0)) {
      setError('Average price must be valid.');
      return;
    }

    setBusy('add-brand');
    setError(null);
    try {
      const brand = await createBrand(brandName, newCategory);
      await upsertVariant(brand.id, variantName, packSize, avgPrice);
      await refreshBrands();
      await track(AnalyticsEvents.BRAND_CREATED, { brand_name: brandName });
      setNewBrandName('');
      setNewVariantName('Regular');
      setNewPackSize('20');
      setNewAvgPrice('');
      setNewCategory('regular');
    } catch (e) {
      setError(toSafeErrorMessage(e, 'validation_error'));
    } finally {
      setBusy(null);
    }
  };

  const onSignOut = async () => {
    setBusy('signout');
    setError(null);
    try {
      await getSupabase().auth.signOut();
      reset();
      router.replace('/login');
    } catch (e) {
      setError(toSafeErrorMessage(e, 'authentication_error'));
    } finally {
      setBusy(null);
    }
  };

  const onEraseAll = async () => {
    const confirmed = window.confirm(
      'Erase all app data for this account? This keeps your login and re-seeds default brands.',
    );
    if (!confirmed) return;
    setBusy('erase-all');
    setError(null);
    try {
      await eraseAllUserData();
      await wipeSecureStore();
      await Promise.all([refreshProfile(), refreshLogs(), refreshBrands(), refreshGoals()]);
      router.replace('/onboarding/privacy');
    } catch (e) {
      setError(toSafeErrorMessage(e, 'dependency_failure'));
    } finally {
      setBusy(null);
    }
  };

  const onDeleteAccount = async () => {
    const confirmed = window.confirm(
      'Delete your account permanently? This action cannot be undone.',
    );
    if (!confirmed) return;
    setBusy('delete-account');
    setError(null);
    try {
      await deleteUserAccount();
      await wipeSecureStore();
      reset();
      router.replace('/login');
    } catch (e) {
      setError(toSafeErrorMessage(e, 'dependency_failure'));
    } finally {
      setBusy(null);
    }
  };

  if (!booted || !profile) {
    return (
      <div className="max-w-2xl mx-auto p-lg">
        <Card>
          <div className="h-20 bg-bg-elevated rounded-md animate-pulse" />
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-lg flex flex-col gap-lg pb-32">
      <Header title="Settings" subtitle="Account and privacy" />

      <Card>
        <div className="flex flex-col gap-md">
          <Text variant="bodyStrong">Baseline</Text>
          <Input
            label="Sticks per day"
            type="number"
            min={0}
            step={1}
            inputMode="numeric"
            value={baseline}
            onChange={(e) => setBaseline(e.target.value)}
            placeholder="e.g. 10"
          />
          <Button
            title={busy === 'save-profile' ? 'Saving…' : 'Save baseline'}
            loading={busy === 'save-profile'}
            disabled={busy != null}
            onPress={onSaveProfile}
          />
        </div>
      </Card>

      <Card>
        <div className="flex flex-col gap-md">
          <Text variant="bodyStrong">Privacy display</Text>
          <label className="flex items-start gap-sm text-small text-text-muted">
            <input
              type="checkbox"
              checked={profile.discreetMode}
              onChange={(e) => void onToggleDiscreet(e.target.checked)}
              disabled={busy != null}
              className="mt-0.5"
            />
            <span>Enable discreet mode (mask sensitive dashboard text).</span>
          </label>
          <label className="flex items-start gap-sm text-small text-text-muted">
            <input
              type="checkbox"
              checked={profile.hideTotalsOnHome}
              onChange={(e) => void onToggleHideTotals(e.target.checked)}
              disabled={busy != null}
              className="mt-0.5"
            />
            <span>Hide totals on dashboard.</span>
          </label>
          <label className="flex items-start gap-sm text-small text-text-muted">
            <input
              type="checkbox"
              checked={analyticsOptIn}
              onChange={(e) => void onToggleAnalytics(e.target.checked)}
              disabled={busy != null}
              className="mt-0.5"
            />
            <span>Allow optional first-party product analytics events.</span>
          </label>
        </div>
      </Card>

      <Card>
        <div className="flex flex-col gap-md">
          <Text variant="bodyStrong">Brand catalog</Text>
          <Text variant="small" muted>
            Add custom brands and variants when your preferred option is not already listed.
          </Text>
          <Input
            label="Brand name"
            value={newBrandName}
            onChange={(event) => setNewBrandName(event.target.value)}
            placeholder="e.g. Camel"
          />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-md">
            <Input
              label="Variant"
              value={newVariantName}
              onChange={(event) => setNewVariantName(event.target.value)}
              placeholder="e.g. Blue"
            />
            <Input
              label="Pack size"
              type="number"
              min={1}
              step={1}
              inputMode="numeric"
              value={newPackSize}
              onChange={(event) => setNewPackSize(event.target.value)}
              placeholder="20"
            />
            <Input
              label="Avg price (INR)"
              type="number"
              min={0}
              step="0.01"
              inputMode="decimal"
              value={newAvgPrice}
              onChange={(event) => setNewAvgPrice(event.target.value)}
              placeholder="optional"
            />
          </div>
          <label className="flex flex-col gap-1 text-caption uppercase text-text-muted">
            Category
            <select
              value={newCategory}
              onChange={(event) => setNewCategory(event.target.value as Brand['category'])}
              className="w-full bg-bg-elevated border border-border rounded-md px-md py-sm text-body text-text"
            >
              <option value="budget">Budget</option>
              <option value="regular">Regular</option>
              <option value="premium">Premium</option>
              <option value="imported">Imported</option>
              <option value="other">Other</option>
            </select>
          </label>
          <Button
            title={busy === 'add-brand' ? 'Adding…' : 'Add brand'}
            variant="secondary"
            loading={busy === 'add-brand'}
            disabled={busy != null}
            onPress={onAddCustomBrand}
          />
        </div>
      </Card>

      <Card>
        <div className="flex flex-col gap-sm">
          <Text variant="bodyStrong">Data controls</Text>
          <Text variant="small" muted>
            Export your account data as JSON, erase app data while keeping login, or delete the
            account permanently.
          </Text>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-md">
            <Button
              title={busy === 'export-json' ? 'Exporting…' : 'Export data (JSON)'}
              variant="secondary"
              loading={busy === 'export-json'}
              disabled={busy != null}
              onPress={onExportJson}
            />
            <Button
              title={busy === 'erase-all' ? 'Erasing…' : 'Erase all app data'}
              variant="danger"
              loading={busy === 'erase-all'}
              disabled={busy != null}
              onPress={onEraseAll}
            />
          </div>
          <Button
            title={busy === 'delete-account' ? 'Deleting…' : 'Delete account'}
            variant="danger"
            loading={busy === 'delete-account'}
            disabled={busy != null}
            onPress={onDeleteAccount}
          />
        </div>
      </Card>

      <Card>
        <div className="flex flex-col gap-sm">
          <Text variant="bodyStrong">Session</Text>
          <Button
            title={busy === 'signout' ? 'Signing out…' : 'Sign out'}
            variant="ghost"
            loading={busy === 'signout'}
            disabled={busy != null}
            onPress={onSignOut}
          />
        </div>
      </Card>

      {error ? (
        <Text variant="small" color="var(--danger, #C85A54)">
          {error}
        </Text>
      ) : null}
    </div>
  );
}
