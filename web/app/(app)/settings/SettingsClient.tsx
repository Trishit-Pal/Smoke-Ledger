'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { ConfirmDialog } from '@web/components/ui/ConfirmDialog';
import { Header } from '@web/components/layout/Header';
import { Card } from '@web/components/ui/Card';
import { Button } from '@web/components/ui/Button';
import { Input } from '@web/components/ui/Input';
import { Text } from '@web/components/ui/Text';
import { updateProfile } from '@/db/repositories/profile';
import { getSupabase } from '@web/lib/supabase/client';
import { track } from '@/services/analytics';
import { AnalyticsEvents } from '@/constants/events';
import { eraseAllUserData } from '@/services/cloudErase';
import { deleteUserAccount } from '@/services/deleteUserAccount';
import { wipeSecureStore } from '@/lib/secureStore';
import { exportAccountData } from '@/services/exportAccountData';
import { setSetting } from '@/db/repositories/settings';
import { toSafeErrorMessage } from '@/lib/errors';
import { invalidateAnalyticsConsentCache, primeAnalyticsConsentCache } from '@/services/analytics';
import { createBrand, upsertVariant } from '@/db/repositories/brands';
import type { Brand, BrandVariant, UserProfile } from '@/types';

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

export interface SettingsClientProps {
  profile: UserProfile;
  brands: (Brand & { variants: BrandVariant[] })[];
  analyticsOptIn: boolean;
}

export function SettingsClient({
  profile,
  brands: _initialBrands,
  analyticsOptIn: initialAnalyticsOptIn,
}: SettingsClientProps) {
  const router = useRouter();
  const [baseline, setBaseline] = React.useState(
    profile.baselinePerDay != null ? String(profile.baselinePerDay) : '',
  );
  const [analyticsOptIn, setAnalyticsOptIn] = React.useState(initialAnalyticsOptIn);
  const [newBrandName, setNewBrandName] = React.useState('');
  const [newVariantName, setNewVariantName] = React.useState('Regular');
  const [newPackSize, setNewPackSize] = React.useState('20');
  const [newAvgPrice, setNewAvgPrice] = React.useState('');
  const [newCategory, setNewCategory] = React.useState<Brand['category']>('regular');
  const [error, setError] = React.useState<string | null>(null);
  const [exportWarning, setExportWarning] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState<BusyAction>(null);
  const [confirmAction, setConfirmAction] = React.useState<'erase' | 'delete' | null>(null);

  const onSaveProfile = async () => {
    setBusy('save-profile');
    setError(null);
    try {
      const parsed = baseline.trim() === '' ? null : Number(baseline);
      if (parsed != null && (!Number.isFinite(parsed) || parsed < 0)) {
        throw new Error('Baseline must be a valid number.');
      }
      await updateProfile({ baselinePerDay: parsed });
      router.refresh();
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
      router.refresh();
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
      router.refresh();
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
    setExportWarning(null);
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
      if (payload.truncated) {
        setExportWarning(
          'This export includes your most recent entries only. Older entries beyond the export limit were not included. Contact support if you need a full historical export.',
        );
      }
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
      router.refresh();
      await track(AnalyticsEvents.BRAND_CREATED, { category: newCategory, is_seed: false });
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
      router.replace('/login');
    } catch (e) {
      setError(toSafeErrorMessage(e, 'authentication_error'));
    } finally {
      setBusy(null);
    }
  };

  const onEraseAll = async () => {
    setBusy('erase-all');
    setError(null);
    try {
      await eraseAllUserData();
      await wipeSecureStore();
      router.replace('/onboarding/privacy');
    } catch (e) {
      setError(toSafeErrorMessage(e, 'dependency_failure'));
    } finally {
      setBusy(null);
      setConfirmAction(null);
    }
  };

  const onDeleteAccount = async () => {
    setBusy('delete-account');
    setError(null);
    try {
      await deleteUserAccount();
      await wipeSecureStore();
      router.replace('/login');
    } catch (e) {
      setError(toSafeErrorMessage(e, 'dependency_failure'));
    } finally {
      setBusy(null);
      setConfirmAction(null);
    }
  };

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
              onPress={() => setConfirmAction('erase')}
            />
          </div>
          <Button
            title={busy === 'delete-account' ? 'Deleting…' : 'Delete account'}
            variant="danger"
            loading={busy === 'delete-account'}
            disabled={busy != null}
            onPress={() => setConfirmAction('delete')}
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

      {exportWarning ? (
        <Text variant="small" color="var(--warning, #B45309)">
          {exportWarning}
        </Text>
      ) : null}

      {error ? (
        <Text variant="small" color="var(--danger, #C85A54)">
          {error}
        </Text>
      ) : null}

      <ConfirmDialog
        open={confirmAction === 'erase'}
        title="Erase all app data?"
        description="This keeps your login and re-seeds default brands. Logs, goals, and custom data will be removed."
        confirmLabel="Erase data"
        destructive
        loading={busy === 'erase-all'}
        onConfirm={() => void onEraseAll()}
        onOpenChange={(open) => !open && setConfirmAction(null)}
      />
      <ConfirmDialog
        open={confirmAction === 'delete'}
        title="Delete account permanently?"
        description="This removes your authentication account and cannot be undone."
        confirmLabel="Delete account"
        destructive
        loading={busy === 'delete-account'}
        onConfirm={() => void onDeleteAccount()}
        onOpenChange={(open) => !open && setConfirmAction(null)}
      />
    </div>
  );
}
