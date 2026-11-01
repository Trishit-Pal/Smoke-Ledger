'use client';

/*
 * ─────────────────────────────────────────────────────────────────────────────
 *  Settings — "Quiet editorial · the colophon"
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *  Aesthetic direction: Settings is the colophon / masthead spread of the same
 *  publication — where the reader sets preferences, signs the policies, and
 *  (in extremis) ends the subscription. Cards have dissolved. Every preference
 *  group is now a typographic table: a small-caps section caption above a
 *  hairline-row preference list. Label-left, control-right. Destructive
 *  operations (Erase data, Delete account) live as hairline rows of the same
 *  visual weight as Export and Sign out — they are data-rights actions, and
 *  they deserve the same dignity. Their colour is --warn-earth (terracotta),
 *  never alarm red.
 *
 *  Motion: .editorial-stage choreography. Index allocation:
 *    0 = masthead, 1 = Preferences, 1.5 = Profile, 2 = Privacy,
 *    3 = Brand catalog, 4 = Data, 5 = Account, 6 = end-mark.
 *  Toggles and inline edits do NOT have entrance animations — they're stateful
 *  controls, not narrative content. All animation short-circuits under
 *  prefers-reduced-motion via the global @media block in globals.css.
 *
 *  Data path is unchanged. All updateProfile / exportAccountData / cloudErase
 *  / deleteUserAccount / setting / brand-create calls keep their semantics.
 *  The Radix-based ConfirmDialog stays as the destructive-action gate; its
 *  title + description preserve the consequence-language contract that the
 *  Playwright DPDP spec asserts ("Erase all app data", "Delete account
 *  permanently", "permanent", "all data"). The exported function name and
 *  prop shape (SettingsClientProps) are untouched so page.tsx is unaffected.
 *
 *  The page is the third sibling in the publication's set. End-marks across
 *  the four spreads: "Quiet, on purpose." (Dashboard) · "End of the ledger."
 *  (History) · "Numbers are a slow mirror." (Trends) · "Set quietly. Reviewed
 *  quietly." (this page).
 */

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  safeRevalidateAppViews as revalidateAppViews,
  safeRevalidateBrands as revalidateBrands,
} from '@web/lib/safeRevalidate';
import { ConfirmDialog } from '@web/components/ui/ConfirmDialog';
import { updateProfile, setRegion, resetLedgerForRegion } from '@/db/repositories/profile';
import { CountryField } from '@web/components/settings/CountryField';
import { isRegionPickerEnabled, localeForCountry } from '@/lib/regions';
import { formatMoney } from '@/lib/format';
import { getSupabase } from '@web/lib/supabase/client';
import { dispatchFarewell } from '@web/lib/character/mood';
import { track } from '@/services/analytics';
import { AnalyticsEvents } from '@/constants/events';
import { eraseAllUserData } from '@/services/cloudErase';
import { deleteUserAccount } from '@/services/deleteUserAccount';
import { wipeSecureStore } from '@/lib/secureStore';
import { exportAccountData } from '@/services/exportAccountData';
import { setSetting } from '@/db/repositories/settings';
import { describeError, isAppError } from '@/lib/errors';
import { invalidateAnalyticsConsentCache, primeAnalyticsConsentCache } from '@/services/analytics';
import { createBrand, upsertVariant, setVariantPriceOverride } from '@/db/repositories/brands';
import { MIN_PRICE_INR, MAX_PRICE_INR } from '@/lib/validation';
import { computeAge } from '@/domain/age';
import {
  normalizeIndianMobile,
  toLocalMobileDigits,
  INDIA_MOBILE_RE,
  nextMobileChangeDate,
  canChangeMobile,
} from '@/lib/mobileNumber';
import { GENDER_LABELS } from '@/lib/profileLabels';
import type { Brand, BrandVariant, UserProfile } from '@/types';
import { SectionLabel } from '@web/components/visual';
import { ThemeToggle } from '@web/components/layout/ThemeToggle';

type BusyAction =
  | null
  | 'save-profile'
  | 'save-mobile'
  | 'save-place'
  | 'save-country'
  | 'signout'
  | 'return-home'
  | 'export-json'
  | 'erase-all'
  | 'delete-account'
  | 'toggle-discreet'
  | 'toggle-hide'
  | 'toggle-analytics'
  | 'add-brand'
  | 'save-price';

export interface SettingsClientProps {
  profile: UserProfile;
  brands: (Brand & { variants: BrandVariant[] })[];
  analyticsOptIn: boolean;
  initialAction?: string;
}

/** Editorial-stage CSS-variable indexing helper — drives the stagger reveal. */
function stageIndex(n: number): React.CSSProperties {
  return { ['--ed-index' as string]: n } as React.CSSProperties;
}

/**
 * One small-caps section caption with a one-sentence deck below it. Used as
 * the head of every preference group. Mirrors the section-head pattern of
 * Dashboard / History / Trends.
 */
function SectionHead({
  caption,
  deck,
  id,
}: {
  caption: string;
  deck: string;
  id: string;
}) {
  return (
    <div className="flex flex-col gap-xs">
      <SectionLabel id={id} spacing="none">
        {caption}
      </SectionLabel>
      <p className="text-small text-text-muted max-w-[44ch]">{deck}</p>
    </div>
  );
}

/**
 * A hairline preference row. Label + sublabel sit left; the control sits right
 * (typically a toggle, a text-link, or an inline editable value). Top-border
 * is a hairline — sequential rows stack into a typographic ledger.
 */
function PrefRow({
  label,
  sublabel,
  control,
  strongRule = false,
}: {
  label: React.ReactNode;
  sublabel?: React.ReactNode;
  control: React.ReactNode;
  strongRule?: boolean;
}) {
  return (
    <div
      className={`${strongRule ? 'rule-hair-strong' : 'rule-hair'} grid grid-cols-[1fr_auto] items-start gap-md py-md`}
    >
      <div className="min-w-0 flex flex-col gap-xs">
        <div className="text-body text-text">{label}</div>
        {sublabel ? (
          <div className="text-small text-text-muted max-w-[48ch]">{sublabel}</div>
        ) : null}
      </div>
      <div className="shrink-0 flex items-center justify-end pt-[2px]">{control}</div>
    </div>
  );
}

/**
 * Editorial-tone switch. Renders a real <button role="switch"> so screen
 * readers announce it as a toggle. The visual treatment is a small hairline
 * pill — track in --rule, thumb in --text when on, --text-faint when off.
 * Avoids the chunky chrome of the Card-era checkbox.
 */
function EditorialSwitch({
  checked,
  onChange,
  disabled,
  ariaLabel,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  ariaLabel: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="hit-target relative inline-flex h-6 w-11 items-center rounded-full border transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg disabled:opacity-60 disabled:cursor-not-allowed"
      style={{
        borderColor: 'var(--rule-strong)',
        backgroundColor: checked ? 'var(--text)' : 'transparent',
      }}
    >
      <span
        aria-hidden
        className="inline-block h-4 w-4 rounded-full transition-transform duration-200"
        style={{
          transform: checked ? 'translateX(22px)' : 'translateX(4px)',
          backgroundColor: checked ? 'var(--bg)' : 'var(--text-faint)',
        }}
      />
    </button>
  );
}

/**
 * A text-link control — underlined, hairline decoration colour. Used for
 * "Save", "Refresh now", "Download JSON", "Sign out". Has a destructive
 * variant that paints in --warn-earth for Erase / Delete.
 */
function TextLink({
  onClick,
  disabled,
  children,
  destructive = false,
  ariaLabel,
  busy = false,
}: {
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
  destructive?: boolean;
  ariaLabel?: string;
  busy?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-busy={busy}
      aria-label={ariaLabel}
      className="text-small underline underline-offset-4 decoration-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg rounded-sm disabled:opacity-60 disabled:cursor-not-allowed transition-colors inline-flex items-center justify-center min-h-11 min-w-11 px-xs"
      style={{
        color: destructive ? 'var(--warn-earth)' : 'var(--text)',
        textDecorationColor: destructive ? 'var(--warn-earth)' : 'var(--rule-strong)',
      }}
    >
      {children}
    </button>
  );
}

export function SettingsClient({
  profile,
  brands: initialBrands,
  analyticsOptIn: initialAnalyticsOptIn,
  initialAction,
}: SettingsClientProps) {
  const router = useRouter();

  // ── Baseline edit-in-place state ────────────────────────────────────────
  const initialBaseline =
    profile.baselinePerDay != null ? String(profile.baselinePerDay) : '';
  const [baseline, setBaseline] = React.useState(initialBaseline);
  const [editingBaseline, setEditingBaseline] = React.useState(false);

  // ── Profile (mobile + place) edit-in-place state ────────────────────────
  // The draft holds only the 10 local digits; the "+91" prefix is fixed in the UI.
  const localMobileDigits = (e164: string | null | undefined) =>
    e164 ? e164.replace(/^\+91/, '') : '';
  const [editingMobile, setEditingMobile] = React.useState(false);
  const [mobileDraft, setMobileDraft] = React.useState(localMobileDigits(profile.mobileE164));
  const [editingPlace, setEditingPlace] = React.useState(false);
  const [placeDraft, setPlaceDraft] = React.useState(profile.place ?? '');
  const [country, setCountry] = React.useState(profile.country ?? 'IN');
  const [countryError, setCountryError] = React.useState<string | null>(null);
  const [confirmRegionReset, setConfirmRegionReset] = React.useState(false);

  const [analyticsOptIn, setAnalyticsOptIn] = React.useState(initialAnalyticsOptIn);
  // Reconcile with the server prop after router.refresh() (e.g. consent changed
  // in another tab) — useState seeds only once, so without this the toggle would
  // show a stale value until a hard reload. Also invalidate the module-level
  // analytics consent cache: the displayed value just moved to match the server,
  // so the next track() must re-read the true consent rather than honor a stale
  // cached value (otherwise the switch could read OFF while tracking continues).
  React.useEffect(() => {
    setAnalyticsOptIn(initialAnalyticsOptIn);
    invalidateAnalyticsConsentCache();
  }, [initialAnalyticsOptIn]);

  // ── Brand catalog state ─────────────────────────────────────────────────
  // Local mutable copy of the server-provided catalog so a price edit reflects
  // immediately without a full reload. Other views are refreshed via revalidate.
  const [brands, setBrands] = React.useState(initialBrands);
  // Reconcile with the server prop whenever it changes (e.g. after add-brand's
  // router.refresh()). useState seeds only once, so without this the panel would
  // miss a newly added brand until a hard reload.
  React.useEffect(() => {
    setBrands(initialBrands);
  }, [initialBrands]);
  const [showAddBrand, setShowAddBrand] = React.useState(false);
  const [newBrandName, setNewBrandName] = React.useState('');
  const [newVariantName, setNewVariantName] = React.useState('Regular');
  const [newPackSize, setNewPackSize] = React.useState('20');
  const [newAvgPrice, setNewAvgPrice] = React.useState('');
  const [newCategory, setNewCategory] = React.useState<Brand['category']>('regular');

  // ── Brand catalog price-editor state ────────────────────────────────────
  const [showPrices, setShowPrices] = React.useState(false);
  const [editingVariantId, setEditingVariantId] = React.useState<string | null>(null);
  const [priceDraft, setPriceDraft] = React.useState('');

  // ── Status / toast state ────────────────────────────────────────────────
  const [error, setError] = React.useState<string | null>(null);
  const [exportWarning, setExportWarning] = React.useState<string | null>(null);
  const [toast, setToast] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState<BusyAction>(null);
  const [confirmAction, setConfirmAction] = React.useState<'erase' | 'delete' | 'leave' | null>(
    null,
  );

  // Keep the toast dismissal timer in a ref so we can clear it on unmount and
  // before re-arming — avoids a setState-after-unmount and matches DashboardClient.
  const toastTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  React.useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  const flashToast = React.useCallback((msg: string) => {
    setToast(msg);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(null), 2500);
  }, []);

  // ── Re-auth resume: open delete dialog if redirected back with ?action=delete ──
  const initialActionHandled = React.useRef(false);
  React.useEffect(() => {
    if (initialActionHandled.current) return;
    if (initialAction === 'delete' && confirmAction === null) {
      initialActionHandled.current = true;
      setConfirmAction('delete');
      router.replace('/settings');
    }
  }, [initialAction, confirmAction, router]);

  // ── Handlers (semantics preserved; data path unchanged) ─────────────────
  const onSaveProfile = async () => {
    setBusy('save-profile');
    setError(null);
    try {
      const parsed = baseline.trim() === '' ? null : Number(baseline);
      if (parsed != null && (!Number.isFinite(parsed) || parsed < 0)) {
        throw new Error('Baseline must be a valid number.');
      }
      await updateProfile({ baselinePerDay: parsed });
      setEditingBaseline(false);
      flashToast(parsed != null ? `Baseline updated to ${parsed}/day.` : 'Baseline cleared.');
      await revalidateAppViews();
      router.refresh();
    } catch (e) {
      setError(describeError(e, 'validation_error'));
    } finally {
      setBusy(null);
    }
  };

  const onToggleDiscreet = async (value: boolean) => {
    setBusy('toggle-discreet');
    setError(null);
    try {
      await updateProfile({ discreetMode: value });
      await revalidateAppViews();
      router.refresh();
      if (value) {
        await track(AnalyticsEvents.DISCREET_MODE_ENABLED, { enabled: true });
      }
    } catch (e) {
      setError(describeError(e));
    } finally {
      setBusy(null);
    }
  };

  const onToggleHideTotals = async (value: boolean) => {
    setBusy('toggle-hide');
    setError(null);
    try {
      await updateProfile({ hideTotalsOnHome: value });
      await revalidateAppViews();
      router.refresh();
    } catch (e) {
      setError(describeError(e));
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
      setError(describeError(e));
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
      } else {
        flashToast('Export downloaded.');
      }
    } catch (e) {
      setError(describeError(e, 'dependency_failure'));
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
      await revalidateBrands();
      await revalidateAppViews();
      router.refresh();
      await track(AnalyticsEvents.BRAND_CREATED, { category: newCategory, is_seed: false });
      setNewBrandName('');
      setNewVariantName('Regular');
      setNewPackSize('20');
      setNewAvgPrice('');
      setNewCategory('regular');
      setShowAddBrand(false);
      flashToast(`Added ${brandName}.`);
    } catch (e) {
      setError(describeError(e, 'validation_error'));
    } finally {
      setBusy(null);
    }
  };

  const packCurrency = profile.currency;
  const packLocale = localeForCountry(profile.country);
  const roundPackPrice = (n: number) =>
    packCurrency === 'EUR' ? Math.round(n * 100) / 100 : Math.round(n);

  const beginEditPrice = (variant: BrandVariant) => {
    setEditingVariantId(variant.id);
    setPriceDraft(variant.avgPriceInr != null ? String(roundPackPrice(variant.avgPriceInr)) : '');
    setError(null);
  };

  const cancelEditPrice = () => {
    setEditingVariantId(null);
    setPriceDraft('');
  };

  const onSaveVariantPrice = async (variantId: string) => {
    const parsed = Number(priceDraft);
    if (!Number.isFinite(parsed) || parsed < MIN_PRICE_INR || parsed > MAX_PRICE_INR) {
      setError(`Price must be a number between ${MIN_PRICE_INR} and ${MAX_PRICE_INR}.`);
      return;
    }
    // India pack MRPs are whole rupees. Euro prices keep cents.
    const price = roundPackPrice(parsed);
    setBusy('save-price');
    setError(null);
    try {
      const updated = await setVariantPriceOverride(variantId, price);
      // Optimistic local update so the new price shows immediately.
      setBrands((prev) =>
        prev.map((b) => ({
          ...b,
          variants: b.variants.map((v) => (v.id === variantId ? updated : v)),
        })),
      );
      setEditingVariantId(null);
      setPriceDraft('');
      // Refresh dashboard/trends/log caches that read variant prices.
      await revalidateBrands();
      await revalidateAppViews();
      flashToast('Price updated.');
    } catch (e) {
      setError(describeError(e, 'validation_error'));
    } finally {
      setBusy(null);
    }
  };

  const onSignOut = async () => {
    setBusy('signout');
    setError(null);
    try {
      // CHARACTER: play the logout farewell wave-off (the <LogoutFarewell>
      // portal mounted in (app)/layout) before redirecting, so the user doesn't
      // watch a blank flash. Skipped under prefers-reduced-motion — the
      // overlay's motion would be suppressed anyway — for an instant sign-out.
      const reduceMotion =
        typeof window !== 'undefined' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (!reduceMotion) {
        dispatchFarewell();
        await new Promise((r) => setTimeout(r, 1600));
      }
      await getSupabase().auth.signOut();
    } catch (e) {
      setError(describeError(e, 'authentication_error'));
    } finally {
      setBusy(null);
      // Always leave — sign-out is best-effort, and navigating away unmounts the
      // (app)-group farewell overlay. Without this, a thrown signOut() would
      // strand the user behind the full-screen wave-off with no way to dismiss it.
      router.replace('/login');
    }
  };

  const onReturnHome = async () => {
    setBusy('return-home');
    setError(null);
    try {
      await getSupabase().auth.signOut();
      router.replace('/');
    } catch (e) {
      setError(describeError(e, 'authentication_error'));
    } finally {
      setBusy(null);
      setConfirmAction(null);
    }
  };

  const onSaveMobile = async () => {
    const trimmed = mobileDraft.trim();
    const value = trimmed === '' ? null : normalizeIndianMobile(trimmed);
    // Block invalid input up front with a precise, actionable message — never a
    // generic "something went wrong".
    if (trimmed !== '' && value === null) {
      setError('Enter a 10-digit Indian mobile starting 6-9.');
      return;
    }
    setBusy('save-mobile');
    setError(null);
    try {
      await updateProfile({ mobileE164: value });
    } catch (e) {
      // The DB trigger rejects a change inside the 30-day window.
      if (isAppError(e) && e.code === 'rate_limited') {
        setError(
          mobileNext
            ? `You can change your number again on ${mobileNext.toLocaleDateString()}.`
            : 'You can change your mobile number only once every 30 days.',
        );
      } else {
        setError(describeError(e, 'dependency_failure'));
      }
      setBusy(null);
      return;
    }
    // The write succeeded — post-save revalidation must not present success as a
    // failure, so it runs outside the try and only flips the UI on success.
    setEditingMobile(false);
    flashToast(value ? 'Mobile number updated.' : 'Mobile number cleared.');
    try {
      await revalidateAppViews();
      router.refresh();
    } catch {
      // View cache refresh is best-effort; the value is already saved.
    } finally {
      setBusy(null);
    }
  };

  const onSavePlace = async () => {
    setBusy('save-place');
    setError(null);
    try {
      const trimmed = placeDraft.trim();
      await updateProfile({ place: trimmed === '' ? null : trimmed });
      setEditingPlace(false);
      flashToast(trimmed ? 'Place updated.' : 'Place cleared.');
      await revalidateAppViews();
      router.refresh();
    } catch (e) {
      setError(describeError(e, 'validation_error'));
    } finally {
      setBusy(null);
    }
  };

  const onSaveCountry = async (reset: boolean) => {
    setBusy('save-country');
    setError(null);
    setCountryError(null);
    try {
      if (reset) await resetLedgerForRegion(country);
      else await setRegion(country);
      setConfirmRegionReset(false);
      flashToast(reset ? 'Ledger reset for the new country.' : 'Country saved.');
      await revalidateAppViews();
      router.refresh();
    } catch (e) {
      if (isAppError(e) && e.code === 'region_change_requires_reset') {
        setConfirmRegionReset(true);
        setCountryError(describeError(e));
      } else {
        setCountryError(describeError(e, 'validation_error'));
      }
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
      setError(describeError(e, 'dependency_failure'));
    } finally {
      setBusy(null);
      setConfirmAction(null);
    }
  };

  const onDeleteAccount = async () => {
    setBusy('delete-account');
    setError(null);
    // Hoisted so finally can read it — suppresses dialog close on reauth redirect.
    let isReauthRedirect = false;
    try {
      await deleteUserAccount({
        onReauthRequired: () => {
          router.push(
            `/login?next=${encodeURIComponent('/settings?action=delete')}&reason=reauth`,
          );
        },
      });
      // Best-effort local cleanup; the account is already gone server-side, so
      // never block the homepage redirect on it.
      try {
        await wipeSecureStore();
      } catch {
        // Ignore — deletion already succeeded; the redirect must still happen.
      }
      // Account is gone — return the user to the public homepage with a
      // confirmation flag (the landing page shows a dismissible notice).
      router.replace('/?deleted=1');
    } catch (e) {
      // When onReauthRequired fires, it throws AppError('authentication_error').
      // The redirect IS the UX — suppress the error stripe and keep the dialog
      // open so there is no flash before navigation lands.
      isReauthRedirect = isAppError(e) && e.code === 'authentication_error';
      if (!isReauthRedirect) {
        setError(describeError(e, 'dependency_failure'));
      }
    } finally {
      setBusy(null);
      if (!isReauthRedirect) setConfirmAction(null);
    }
  };

  // ── Derived profile display values ──────────────────────────────────────
  const age = profile.dateOfBirth ? computeAge(profile.dateOfBirth) : null;
  const ageText = age != null ? `${age} years` : 'Not set';
  const genderText = profile.gender ? GENDER_LABELS[profile.gender] : 'Not set';
  const nameText = profile.fullName && profile.fullName.trim() !== '' ? profile.fullName : 'Not set';
  const mobileEditable = canChangeMobile(profile.mobileChangedAt ?? null, new Date());
  const mobileNext = nextMobileChangeDate(profile.mobileChangedAt ?? null);
  // Empty is allowed (clears the number); otherwise it must be a valid +91 number.
  const mobileDraftValid = mobileDraft.trim() === '' || INDIA_MOBILE_RE.test(`+91${mobileDraft}`);
  const mobileSublabel =
    !mobileEditable && mobileNext
      ? `Used for support only. Changeable once every 30 days — next change on ${mobileNext.toLocaleDateString()}.`
      : 'Used for support only. Changeable once every 30 days.';

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="relative page-column pt-xl pb-32 md:pt-xxl">
      {/* Atmospheric paper noise — purely decorative, behind everything. */}
      <div aria-hidden className="paper-noise absolute inset-0 -z-10" />

      <div className="editorial-stage flex flex-col section-gap">
        {/* ─────────────── Masthead ───────────────
            The h1 carries the accessible name "Settings" so the existing
            Playwright spec (`heading { name: 'Settings' }`) keeps matching.
            Visually, the caption reads as a masthead rule pair. */}
        <header style={stageIndex(0)} className="flex flex-col group-tight">
          <div className="flex items-center gap-md">
            <span
              aria-hidden
              className="h-px flex-1 bg-[var(--rule-strong)] rule-draw"
              style={stageIndex(0)}
            />
            <h1 className="editorial-caption">Settings</h1>
            <span
              aria-hidden
              className="h-px flex-1 bg-[var(--rule-strong)] rule-draw"
              style={stageIndex(0)}
            />
          </div>
          <p className="text-small text-text-muted text-center italic">
            Preferences, policies, the way out.
          </p>
        </header>

        {/* ─────────────── Preferences (Baseline) ─────────────── */}
        <section
          style={stageIndex(1)}
          aria-labelledby="prefs-heading"
          className="flex flex-col gap-md"
        >
          <SectionHead
            id="prefs-heading"
            caption="Daily baseline"
            deck="The number of cigarettes that counts as your usual day. Everything on the dashboard is read against this."
          />
          <dl className="flex flex-col">
            <div className="rule-hair-strong grid grid-cols-[1fr_auto] items-center gap-md py-md">
              <div className="min-w-0 flex flex-col gap-xs">
                <dt className="text-body text-text">Baseline per day</dt>
                <dd className="text-small text-text-muted max-w-[44ch]">
                  Your typical day before quitting.
                </dd>
              </div>
              <dd className="shrink-0 flex items-center gap-md">
                {editingBaseline ? (
                  <>
                    <input
                      type="number"
                      min={0}
                      step={1}
                      inputMode="numeric"
                      value={baseline}
                      onChange={(event) => setBaseline(event.target.value)}
                      aria-label="Baseline sticks per day"
                      placeholder="e.g. 10"
                      autoFocus
                      className="w-20 bg-transparent border-0 border-b nums-tabular text-body text-text text-right focus:outline-none focus-visible:border-[var(--text)]"
                      style={{ borderBottomColor: 'var(--rule-strong)' }}
                    />
                    <TextLink
                      onClick={() => void onSaveProfile()}
                      disabled={busy != null}
                      busy={busy === 'save-profile'}
                      ariaLabel="Save baseline"
                    >
                      {busy === 'save-profile' ? 'Saving…' : 'Save'}
                    </TextLink>
                    <TextLink
                      onClick={() => {
                        setBaseline(initialBaseline);
                        setEditingBaseline(false);
                      }}
                      disabled={busy != null}
                    >
                      Cancel
                    </TextLink>
                  </>
                ) : (
                  <>
                    <span
                      className="editorial-numeral--small nums-tabular text-right"
                      aria-label={
                        initialBaseline === ''
                          ? 'No baseline set'
                          : `Baseline: ${initialBaseline} per day`
                      }
                    >
                      {initialBaseline === '' ? '—' : initialBaseline}
                      {initialBaseline === '' ? null : (
                        <span className="text-small text-text-faint font-sans ml-xs">/d</span>
                      )}
                    </span>
                    <TextLink
                      onClick={() => setEditingBaseline(true)}
                      disabled={busy != null}
                      ariaLabel="Edit baseline"
                    >
                      Edit
                    </TextLink>
                  </>
                )}
              </dd>
            </div>
          </dl>
        </section>

        {/* ─────────────── Profile ─────────────── */}
        <section
          style={stageIndex(1.5)}
          aria-labelledby="profile-heading"
          className="flex flex-col gap-md"
        >
          <SectionHead
            id="profile-heading"
            caption="Profile"
            deck="Your name, age, and gender are set once at signup and can't be changed. Mobile number and place are optional."
          />
          <dl className="flex flex-col">
            <PrefRow
              strongRule
              label="Name"
              control={<span className="text-body text-text">{nameText}</span>}
            />
            <PrefRow label="Age" control={<span className="text-body text-text">{ageText}</span>} />
            <PrefRow
              label="Gender"
              control={<span className="text-body text-text">{genderText}</span>}
            />
            <PrefRow
              label="Mobile number"
              sublabel={mobileSublabel}
              control={
                editingMobile ? (
                  <div className="flex flex-col items-end gap-xs">
                    <div className="flex items-center gap-md">
                      <span className="text-body text-text-faint" aria-hidden>
                        +91
                      </span>
                      <input
                        type="tel"
                        inputMode="numeric"
                        maxLength={10}
                        value={mobileDraft}
                        onChange={(event) => {
                          setMobileDraft(toLocalMobileDigits(event.target.value));
                          if (error) setError(null);
                        }}
                        aria-label="Mobile number"
                        aria-invalid={!mobileDraftValid}
                        placeholder="10-digit number"
                        autoFocus
                        className="w-40 bg-transparent border-0 border-b text-body text-text text-right focus:outline-none focus-visible:border-[var(--text)]"
                        style={{
                          borderBottomColor: mobileDraftValid
                            ? 'var(--rule-strong)'
                            : 'var(--warn-earth)',
                        }}
                      />
                      <TextLink
                        onClick={() => void onSaveMobile()}
                        disabled={busy != null || !mobileDraftValid}
                        busy={busy === 'save-mobile'}
                        ariaLabel="Save mobile number"
                      >
                        {busy === 'save-mobile' ? 'Saving…' : 'Save'}
                      </TextLink>
                      <TextLink
                        onClick={() => {
                          setMobileDraft(localMobileDigits(profile.mobileE164));
                          setError(null);
                          setEditingMobile(false);
                        }}
                        disabled={busy != null}
                      >
                        Cancel
                      </TextLink>
                    </div>
                    <span className="text-small text-text-muted">10 digits, starting 6-9</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-md">
                    <span className="text-body text-text">{profile.mobileE164 ?? 'Not set'}</span>
                    {mobileEditable ? (
                      <TextLink
                        onClick={() => {
                          setMobileDraft(localMobileDigits(profile.mobileE164));
                          setEditingMobile(true);
                        }}
                        disabled={busy != null}
                        ariaLabel="Edit mobile number"
                      >
                        Edit
                      </TextLink>
                    ) : null}
                  </div>
                )
              }
            />
            <PrefRow
              label="Place"
              sublabel="City or region (optional)."
              control={
                editingPlace ? (
                  <div className="flex items-center gap-md">
                    <input
                      type="text"
                      value={placeDraft}
                      onChange={(event) => setPlaceDraft(event.target.value)}
                      aria-label="Place"
                      placeholder="e.g. Mumbai"
                      autoFocus
                      maxLength={80}
                      className="w-40 bg-transparent border-0 border-b text-body text-text text-right focus:outline-none focus-visible:border-[var(--text)]"
                      style={{ borderBottomColor: 'var(--rule-strong)' }}
                    />
                    <TextLink
                      onClick={() => void onSavePlace()}
                      disabled={busy != null}
                      busy={busy === 'save-place'}
                      ariaLabel="Save place"
                    >
                      {busy === 'save-place' ? 'Saving…' : 'Save'}
                    </TextLink>
                    <TextLink
                      onClick={() => {
                        setPlaceDraft(profile.place ?? '');
                        setEditingPlace(false);
                      }}
                      disabled={busy != null}
                    >
                      Cancel
                    </TextLink>
                  </div>
                ) : (
                  <div className="flex items-center gap-md">
                    <span className="text-body text-text">{profile.place ?? 'Not set'}</span>
                    <TextLink
                      onClick={() => {
                        setPlaceDraft(profile.place ?? '');
                        setEditingPlace(true);
                      }}
                      disabled={busy != null}
                      ariaLabel="Edit place"
                    >
                      Edit
                    </TextLink>
                  </div>
                )
              }
            />
            {isRegionPickerEnabled() ? (
              <div className="flex flex-col gap-sm py-md" style={{ borderTop: '1px solid var(--rule)' }}>
                <CountryField
                  value={country}
                  onChange={(next) => {
                    setCountry(next);
                    setConfirmRegionReset(false);
                  }}
                />
                <div className="flex items-center gap-md">
                  <TextLink
                    onClick={() => void onSaveCountry(false)}
                    disabled={busy != null}
                    busy={busy === 'save-country'}
                    ariaLabel="Save country"
                  >
                    {busy === 'save-country' ? 'Saving…' : 'Save country'}
                  </TextLink>
                  {confirmRegionReset ? (
                    <TextLink
                      onClick={() => void onSaveCountry(true)}
                      disabled={busy != null}
                      ariaLabel="Reset the ledger and switch country"
                    >
                      Reset the ledger and switch
                    </TextLink>
                  ) : null}
                </div>
                {countryError ? <p className="text-small text-text-muted">{countryError}</p> : null}
              </div>
            ) : null}
          </dl>
        </section>

        {/* ─────────────── Privacy ─────────────── */}
        <section
          style={stageIndex(2)}
          aria-labelledby="privacy-heading"
          className="flex flex-col gap-md"
        >
          <SectionHead
            id="privacy-heading"
            caption="Privacy"
            deck="What this device shows you, and what — if anything — leaves it."
          />
          <dl className="flex flex-col">
            <PrefRow
              strongRule
              label="Discreet mode"
              sublabel="Mask totals and brand names on the home screen."
              control={
                <EditorialSwitch
                  checked={profile.discreetMode}
                  onChange={(value) => void onToggleDiscreet(value)}
                  disabled={busy != null}
                  ariaLabel="Discreet mode"
                />
              }
            />
            <PrefRow
              label="Hide totals on home"
              sublabel="Collapse the headline number and spend on the dashboard."
              control={
                <EditorialSwitch
                  checked={profile.hideTotalsOnHome}
                  onChange={(value) => void onToggleHideTotals(value)}
                  disabled={busy != null}
                  ariaLabel="Hide totals on home"
                />
              }
            />
            <PrefRow
              label="Anonymous analytics"
              sublabel="Opt-in, first-party event counts only. No log content, no brand names, no prices."
              control={
                <EditorialSwitch
                  checked={analyticsOptIn}
                  onChange={(value) => void onToggleAnalytics(value)}
                  disabled={busy != null}
                  ariaLabel="Anonymous analytics"
                />
              }
            />
          </dl>
        </section>

        {/* ─────────────── Brand catalog ─────────────── */}
        <section
          style={stageIndex(3)}
          aria-labelledby="catalog-heading"
          className="flex flex-col gap-md"
        >
          <SectionHead
            id="catalog-heading"
            caption="Brand catalog"
            deck="Add brands and variants when your preferred option is not already listed."
          />
          <dl className="flex flex-col">
            <PrefRow
              strongRule
              label="Add a custom brand"
              sublabel="Local to your account; never shared with other users."
              control={
                <TextLink
                  onClick={() => setShowAddBrand((open) => !open)}
                  disabled={busy != null}
                  ariaLabel={showAddBrand ? 'Hide brand form' : 'Add brand'}
                >
                  {showAddBrand ? 'Hide form' : 'Add brand'}
                </TextLink>
              }
            />
          </dl>

          {showAddBrand ? (
            <div className="rule-hair pt-md flex flex-col gap-md">
              <label className="flex flex-col gap-xs">
                <span className="editorial-caption">Brand name</span>
                <input
                  type="text"
                  value={newBrandName}
                  onChange={(event) => setNewBrandName(event.target.value)}
                  placeholder="e.g. Camel"
                  className="w-full bg-transparent border-0 border-b text-body text-text focus:outline-none focus-visible:border-[var(--text)] py-xs"
                  style={{ borderBottomColor: 'var(--rule-strong)' }}
                />
              </label>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-md">
                <label className="flex flex-col gap-xs">
                  <span className="editorial-caption">Variant</span>
                  <input
                    type="text"
                    value={newVariantName}
                    onChange={(event) => setNewVariantName(event.target.value)}
                    placeholder="e.g. Blue"
                    className="w-full bg-transparent border-0 border-b text-body text-text focus:outline-none focus-visible:border-[var(--text)] py-xs"
                    style={{ borderBottomColor: 'var(--rule-strong)' }}
                  />
                </label>
                <label className="flex flex-col gap-xs">
                  <span className="editorial-caption">Pack size</span>
                  <input
                    type="number"
                    min={1}
                    step={1}
                    inputMode="numeric"
                    value={newPackSize}
                    onChange={(event) => setNewPackSize(event.target.value)}
                    placeholder="20"
                    className="w-full bg-transparent border-0 border-b nums-tabular text-body text-text focus:outline-none focus-visible:border-[var(--text)] py-xs"
                    style={{ borderBottomColor: 'var(--rule-strong)' }}
                  />
                </label>
                <label className="flex flex-col gap-xs">
                  <span className="editorial-caption">Price per stick ({packCurrency})</span>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    inputMode="decimal"
                    value={newAvgPrice}
                    onChange={(event) => setNewAvgPrice(event.target.value)}
                    placeholder="per stick, optional"
                    aria-label={`Price per stick in ${packCurrency}`}
                    className="w-full bg-transparent border-0 border-b nums-tabular text-body text-text focus:outline-none focus-visible:border-[var(--text)] py-xs"
                    style={{ borderBottomColor: 'var(--rule-strong)' }}
                  />
                </label>
              </div>
              <label className="flex flex-col gap-xs">
                <span className="editorial-caption">Category</span>
                <select
                  value={newCategory}
                  onChange={(event) =>
                    setNewCategory(event.target.value as Brand['category'])
                  }
                  className="w-full bg-transparent border-0 border-b text-body text-text focus:outline-none focus-visible:border-[var(--text)] py-xs"
                  style={{ borderBottomColor: 'var(--rule-strong)' }}
                >
                  <option value="budget">Budget</option>
                  <option value="regular">Regular</option>
                  <option value="premium">Premium</option>
                  <option value="imported">Imported</option>
                  <option value="other">Other</option>
                </select>
              </label>
              <div className="flex items-center justify-end gap-md pt-xs">
                <TextLink
                  onClick={() => setShowAddBrand(false)}
                  disabled={busy != null}
                >
                  Cancel
                </TextLink>
                <TextLink
                  onClick={() => void onAddCustomBrand()}
                  disabled={busy != null}
                  busy={busy === 'add-brand'}
                  ariaLabel="Save new brand"
                >
                  {busy === 'add-brand' ? 'Saving…' : 'Save brand'}
                </TextLink>
              </div>
            </div>
          ) : null}

          <dl className="flex flex-col">
            <PrefRow
              label="Edit saved prices"
              sublabel="Override the per-stick price of any brand variant. Your price is kept and won't be reset by catalog updates."
              control={
                <TextLink
                  onClick={() => setShowPrices((open) => !open)}
                  disabled={busy != null}
                  ariaLabel={showPrices ? 'Hide prices' : 'Edit prices'}
                >
                  {showPrices ? 'Hide' : 'Edit prices'}
                </TextLink>
              }
            />
          </dl>

          {showPrices ? (
            <div className="rule-hair pt-md flex flex-col gap-lg">
              {brands.length === 0 ? (
                <p className="text-small text-text-muted">No brands yet.</p>
              ) : (
                brands.map((b) => (
                  <div key={b.id} className="flex flex-col gap-xs">
                    <span className="editorial-caption">{b.name}</span>
                    {b.variants.length === 0 ? (
                      <p className="text-small text-text-muted">No variants.</p>
                    ) : (
                      b.variants.map((v) => (
                        <div
                          key={v.id}
                          className="rule-hair grid grid-cols-[1fr_auto] items-center gap-md py-sm"
                        >
                          <div className="min-w-0 text-body text-text truncate">
                            {v.name}
                            <span className="text-text-muted"> · {v.defaultPackSize}s</span>
                          </div>
                          {editingVariantId === v.id ? (
                            <div className="flex items-center gap-sm">
                              <span className="text-text-muted">{packCurrency === 'EUR' ? '€' : '₹'}</span>
                              <input
                                type="number"
                                min={0}
                                max={2000}
                                step={packCurrency === 'EUR' ? '0.01' : '1'}
                                inputMode="decimal"
                                value={priceDraft}
                                onChange={(event) => setPriceDraft(event.target.value)}
                                autoFocus
                                className="w-20 bg-transparent border-0 border-b nums-tabular text-body text-text text-right focus:outline-none focus-visible:border-[var(--text)] py-xs"
                                style={{ borderBottomColor: 'var(--rule-strong)' }}
                                aria-label={`Price per stick for ${b.name} ${v.name}`}
                              />
                              <TextLink onClick={cancelEditPrice} disabled={busy != null}>
                                Cancel
                              </TextLink>
                              <TextLink
                                onClick={() => void onSaveVariantPrice(v.id)}
                                disabled={busy != null}
                                busy={busy === 'save-price'}
                                ariaLabel="Save price"
                              >
                                {busy === 'save-price' ? 'Saving…' : 'Save'}
                              </TextLink>
                            </div>
                          ) : (
                            <div className="flex items-center gap-md">
                              <span className="nums-tabular text-body text-text">
                                {v.avgPriceInr != null
                                  ? formatMoney(v.avgPriceInr, packCurrency, { locale: packLocale })
                                  : '—'}
                              </span>
                              <TextLink
                                onClick={() => beginEditPrice(v)}
                                disabled={busy != null}
                                ariaLabel={`Edit price for ${b.name} ${v.name}`}
                              >
                                Edit
                              </TextLink>
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                ))
              )}
            </div>
          ) : null}
        </section>

        {/* ─────────────── Data (export + erase, equal weight) ─────────────── */}
        <section
          style={stageIndex(4)}
          aria-labelledby="data-heading"
          className="flex flex-col gap-md"
        >
          <SectionHead
            id="data-heading"
            caption="Your data"
            deck="Both rows are DPDP rights: export everything you've recorded, or erase the log without closing the account."
          />
          <dl className="flex flex-col">
            <PrefRow
              strongRule
              label="Export your data"
              sublabel="JSON file with your profile, logs, and brand catalogue. Includes a truncation flag if more rows existed than the export window."
              control={
                /* Accessible name must include "Export data (JSON)" — the
                 * e2e spec asserts `button name /Export data \(JSON\)/`. */
                <TextLink
                  onClick={() => void onExportJson()}
                  disabled={busy != null}
                  busy={busy === 'export-json'}
                  ariaLabel="Export data (JSON)"
                >
                  {busy === 'export-json' ? 'Exporting…' : 'Export data (JSON)'}
                </TextLink>
              }
            />
            {exportWarning ? (
              <div className="py-sm">
                <p
                  role="status"
                  className="text-small italic"
                  style={{ color: 'var(--warn-earth)' }}
                >
                  {exportWarning}
                </p>
              </div>
            ) : null}
            <PrefRow
              label="Erase all log data"
              sublabel="Removes every cigarette log, goal, and custom brand. Your account and login stay."
              control={
                /* Accessible name "Erase all app data" matches the e2e spec. */
                <TextLink
                  onClick={() => setConfirmAction('erase')}
                  disabled={busy != null}
                  destructive
                  busy={busy === 'erase-all'}
                  ariaLabel="Erase all app data"
                >
                  {busy === 'erase-all' ? 'Erasing…' : 'Erase all app data'}
                </TextLink>
              }
            />
          </dl>
        </section>

        {/* ─────────────── Account (sign out + delete) ─────────────── */}
        <section
          style={stageIndex(5)}
          aria-labelledby="account-heading"
          className="flex flex-col gap-md"
        >
          <SectionHead
            id="account-heading"
            caption="Account"
            deck="Return to the home page, sign out of this device, or close the account entirely. The DPDP deletion record is retained for compliance."
          />
          <dl className="flex flex-col">
            {/* The only theme control inside the app shell (the global fixed
                toggle is hidden there — see .theme-toggle-fixed in globals.css). */}
            <PrefRow
              strongRule
              label="Dark theme"
              sublabel="Ink on paper, or paper on ink. Follows your account."
              control={<ThemeToggle placement="inline" ariaLabel="Dark theme" />}
            />
            <PrefRow
              label="Return to home page"
              sublabel="Signs you out and returns to the public home page. Your data is saved — you can sign back in anytime."
              control={
                <TextLink
                  onClick={() => setConfirmAction('leave')}
                  disabled={busy != null}
                  busy={busy === 'return-home'}
                  ariaLabel="Return to home page"
                >
                  {busy === 'return-home' ? 'Leaving…' : 'Go home'}
                </TextLink>
              }
            />
            <PrefRow
              label="Sign out of this device"
              sublabel="Your data stays. You can sign back in anywhere."
              control={
                <TextLink
                  onClick={() => void onSignOut()}
                  disabled={busy != null}
                  busy={busy === 'signout'}
                  ariaLabel="Sign out"
                >
                  {busy === 'signout' ? 'Signing out…' : 'Sign out'}
                </TextLink>
              }
            />
            <PrefRow
              label="Delete account permanently"
              sublabel="All your logs, preferences, and audit history are erased. The audit-deletion record itself is retained per DPDP for compliance."
              control={
                /* Accessible name "Delete account — permanent" carries the
                 * consequence for screen-reader users; the visible label
                 * "Delete account" matches the e2e spec's role/name lookup. */
                <TextLink
                  onClick={() => setConfirmAction('delete')}
                  disabled={busy != null}
                  destructive
                  busy={busy === 'delete-account'}
                  ariaLabel="Delete account — permanent"
                >
                  {busy === 'delete-account' ? 'Deleting…' : 'Delete account'}
                </TextLink>
              }
            />
          </dl>
        </section>

        {/* ─────────────── Status / toast / error stripe ─────────────── */}
        {(toast || error) ? (
          <div
            className="rule-hair pt-md flex flex-col gap-xs"
            role={error ? 'alert' : 'status'}
            aria-live="polite"
          >
            {toast ? (
              <p className="text-small italic" style={{ color: 'var(--accent-ink)' }}>
                {toast}
              </p>
            ) : null}
            {error ? (
              <p className="text-small" style={{ color: 'var(--warn-earth)' }}>
                {error}
              </p>
            ) : null}
          </div>
        ) : null}

        {/* ─────────────── End-mark — third sibling of the publication ─── */}
        <footer
          style={stageIndex(6)}
          className="rule-hair pt-md flex items-center justify-center"
        >
          <span className="text-caption text-text-faint italic">
            Set quietly. Reviewed quietly.
          </span>
        </footer>
      </div>

      {/*
       * Destructive-action gate. The title + description preserve the
       * consequence-language contract that the Playwright DPDP spec asserts
       * (data-export-and-deletion.spec.ts + authenticated-flows.spec.ts):
       *   - Erase dialog message contains "Erase all app data" / "erase|delete|all".
       *   - Delete dialog message contains "Delete your account permanently"
       *     and matches /delete.*account|permanent/.
       * Do not weaken this copy.
       */}
      <ConfirmDialog
        open={confirmAction === 'erase'}
        title="Erase all app data?"
        description="This keeps your login and re-seeds default brands. All your logs, goals, and custom data will be erased and cannot be recovered."
        confirmLabel="Erase data"
        destructive
        loading={busy === 'erase-all'}
        onConfirm={() => void onEraseAll()}
        onOpenChange={(open) => !open && setConfirmAction(null)}
      />
      <ConfirmDialog
        open={confirmAction === 'delete'}
        title="Delete your account permanently?"
        description="This removes your authentication account, every log, every preference, and every custom brand. It is permanent and cannot be undone."
        confirmLabel="Delete account"
        destructive
        loading={busy === 'delete-account'}
        onConfirm={() => void onDeleteAccount()}
        onOpenChange={(open) => !open && setConfirmAction(null)}
      />
      <ConfirmDialog
        open={confirmAction === 'leave'}
        title="Return to the home page?"
        description="You'll be signed out and taken back to the public home page. Your data is saved — you can sign back in anytime."
        confirmLabel="Sign out & leave"
        loading={busy === 'return-home'}
        onConfirm={() => void onReturnHome()}
        onOpenChange={(open) => !open && setConfirmAction(null)}
      />
    </div>
  );
}
