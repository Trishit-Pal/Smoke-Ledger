import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Switch,
  Alert,
  Linking,
  Pressable,
  TextInput,
  type KeyboardTypeOptions,
} from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { useRouter } from 'expo-router';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { Chip } from '@/components/ui/Chip';
import { spacing, typography, fonts } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';
import { useReduceMotion } from '@/hooks/useReduceMotion';
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
import { toSafeErrorMessage, isAppError } from '@/lib/errors';
import { dispatchFarewell } from '@/lib/character/mood';
import { computeAge } from '@/domain/age';
import { normalizeToE164, nextMobileChangeDate, canChangeMobile } from '@/lib/mobileNumber';
import { GENDER_LABELS } from '@/lib/profileLabels';
import type { Brand } from '@/types';

// ─── Types ────────────────────────────────────────────────────────────────────

type BusyAction =
  | null
  | 'save-baseline'
  | 'save-mobile'
  | 'save-place'
  | 'signout'
  | 'return-home'
  | 'export-json'
  | 'erase-all'
  | 'delete-account'
  | 'toggle-discreet'
  | 'toggle-hide'
  | 'toggle-analytics'
  | 'add-brand';

// ─── Small-caps section caption + deck ────────────────────────────────────────

interface SectionHeadProps {
  caption: string;
  deck: string;
  accessibilityLabel?: string;
}

function SectionHead({ caption, deck, accessibilityLabel }: SectionHeadProps) {
  const theme = useTheme();
  return (
    <View style={{ gap: spacing.xs }} accessible accessibilityLabel={accessibilityLabel ?? caption}>
      <Text
        variant="caption"
        color={theme.textMuted}
        style={{ textTransform: 'uppercase', letterSpacing: 1.8 }}
      >
        {caption}
      </Text>
      <Text variant="small" muted style={{ maxWidth: 320 }}>
        {deck}
      </Text>
    </View>
  );
}

// ─── Hairline preference row ──────────────────────────────────────────────────

interface PrefRowProps {
  label: string;
  sublabel?: string;
  control: React.ReactNode;
  strongRule?: boolean;
  /** When true, renders the top border as a strong rule (used on first rows) */
}

function PrefRow({ label, sublabel, control, strongRule = false }: PrefRowProps) {
  const theme = useTheme();
  return (
    <View
      style={{
        borderTopWidth: 1,
        borderTopColor: strongRule ? theme.ruleStrong : theme.rule,
        flexDirection: 'row',
        alignItems: 'flex-start',
        paddingVertical: spacing.md,
        gap: spacing.md,
      }}
    >
      <View style={{ flex: 1, gap: spacing.xs }}>
        <Text variant="body">{label}</Text>
        {sublabel ? (
          <Text variant="small" muted style={{ maxWidth: 280 }}>
            {sublabel}
          </Text>
        ) : null}
      </View>
      <View style={{ flexShrink: 0, alignItems: 'flex-end', justifyContent: 'center', paddingTop: 2 }}>
        {control}
      </View>
    </View>
  );
}

// ─── Editorial switch (native Switch with editorial track/thumb colours) ──────

interface EditorialSwitchProps {
  value: boolean;
  onValueChange: (v: boolean) => void;
  disabled?: boolean;
  accessibilityLabel: string;
}

function EditorialSwitch({ value, onValueChange, disabled, accessibilityLabel }: EditorialSwitchProps) {
  const theme = useTheme();
  return (
    <Switch
      value={value}
      onValueChange={onValueChange}
      disabled={disabled}
      trackColor={{ false: theme.rule, true: theme.accent }}
      thumbColor={value ? theme.bg : theme.textFaint}
      ios_backgroundColor={theme.rule}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled: !!disabled }}
    />
  );
}

// ─── Text-link control ────────────────────────────────────────────────────────

interface TextLinkProps {
  onPress: () => void;
  disabled?: boolean;
  busy?: boolean;
  destructive?: boolean;
  accessibilityLabel?: string;
  children: string;
}

function TextLink({ onPress, disabled, busy, destructive, accessibilityLabel, children }: TextLinkProps) {
  const theme = useTheme();
  const color = destructive ? theme.warnEarth : theme.text;
  const isDisabled = disabled || busy;
  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? children}
      accessibilityState={{ disabled: !!isDisabled, busy: !!busy }}
      style={{ opacity: isDisabled ? 0.5 : 1, minHeight: 32, justifyContent: 'center' }}
    >
      <Text
        variant="small"
        color={color}
        style={{ textDecorationLine: 'underline', textDecorationColor: color }}
      >
        {busy ? `${children.replace(/…$/, '')}…` : children}
      </Text>
    </Pressable>
  );
}

// ─── Stagger-entry animated section wrapper ───────────────────────────────────

interface StageProps {
  index: number;
  reduce: boolean;
  children: React.ReactNode;
}

function Stage({ index, reduce, children }: StageProps) {
  if (reduce) {
    return <View>{children}</View>;
  }
  return (
    <Animated.View entering={FadeIn.delay(index * 80).duration(260)}>
      {children}
    </Animated.View>
  );
}

// ─── Inline baseline editor ───────────────────────────────────────────────────

interface BaselineSectionProps {
  initialBaseline: string;
  busy: BusyAction;
  reduce: boolean;
  onSave: (value: string, onDone: () => void) => void;
}

function BaselineSection({ initialBaseline, busy, reduce, onSave }: BaselineSectionProps) {
  const theme = useTheme();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(initialBaseline);
  const inputRef = useRef<TextInput>(null);

  const isBusy = busy === 'save-baseline';
  const isAnyBusy = busy !== null;

  const handleEdit = () => {
    setDraft(initialBaseline);
    setEditing(true);
  };

  const handleCancel = () => {
    setDraft(initialBaseline);
    setEditing(false);
  };

  const handleSave = () => {
    onSave(draft, () => setEditing(false));
  };

  const displayValue = initialBaseline === '' ? '—' : initialBaseline;

  return (
    <PrefRow
      strongRule
      label="Baseline per day"
      sublabel="Your typical day before quitting."
      control={
        editing ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <TextInput
              ref={inputRef}
              value={draft}
              onChangeText={setDraft}
              keyboardType="number-pad"
              autoFocus
              returnKeyType="done"
              onSubmitEditing={handleSave}
              accessibilityLabel="Baseline sticks per day"
              placeholder="e.g. 10"
              placeholderTextColor={theme.textFaint}
              style={{
                width: 64,
                color: theme.text,
                fontFamily: fonts.body,
                fontSize: typography.small.fontSize,
                textAlign: 'right',
                borderBottomWidth: 1,
                borderBottomColor: theme.ruleStrong,
                paddingVertical: spacing.xs,
              }}
            />
            <TextLink onPress={handleSave} busy={isBusy} disabled={isAnyBusy} accessibilityLabel="Save baseline">
              Save
            </TextLink>
            <TextLink onPress={handleCancel} disabled={isAnyBusy}>
              Cancel
            </TextLink>
          </View>
        ) : (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <Text
              variant="small"
              color={initialBaseline === '' ? theme.textFaint : theme.text}
              style={{ fontFamily: fonts.bodyMedium, minWidth: 24, textAlign: 'right' }}
            >
              {displayValue}
              {initialBaseline !== '' ? (
                <Text variant="caption" faint>
                  {' /d'}
                </Text>
              ) : null}
            </Text>
            <TextLink onPress={handleEdit} disabled={isAnyBusy} accessibilityLabel="Edit baseline">
              Edit
            </TextLink>
          </View>
        )
      }
    />
  );
}

// ─── Inline editable text row (mobile number, place) ──────────────────────────

interface InlineEditRowProps {
  label: string;
  sublabel?: string;
  value: string | null;
  placeholder?: string;
  keyboardType?: KeyboardTypeOptions;
  busyKey: BusyAction;
  busy: BusyAction;
  /** When false, the field is read-only (e.g. mobile is in its 30-day lock). */
  editable?: boolean;
  strongRule?: boolean;
  onSave: (value: string, onDone: () => void) => void;
}

function InlineEditRow({
  label,
  sublabel,
  value,
  placeholder,
  keyboardType = 'default',
  busyKey,
  busy,
  editable = true,
  strongRule,
  onSave,
}: InlineEditRowProps) {
  const theme = useTheme();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? '');

  const isBusy = busy === busyKey;
  const isAnyBusy = busy !== null;
  const hasValue = !!value && value.trim() !== '';

  const handleEdit = () => {
    setDraft(value ?? '');
    setEditing(true);
  };
  const handleCancel = () => {
    setDraft(value ?? '');
    setEditing(false);
  };
  const handleSave = () => onSave(draft, () => setEditing(false));

  return (
    <PrefRow
      strongRule={strongRule}
      label={label}
      sublabel={sublabel}
      control={
        editing ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <TextInput
              value={draft}
              onChangeText={setDraft}
              keyboardType={keyboardType}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={handleSave}
              accessibilityLabel={label}
              placeholder={placeholder}
              placeholderTextColor={theme.textFaint}
              style={{
                minWidth: 150,
                color: theme.text,
                fontFamily: fonts.body,
                fontSize: typography.small.fontSize,
                textAlign: 'right',
                borderBottomWidth: 1,
                borderBottomColor: theme.ruleStrong,
                paddingVertical: spacing.xs,
              }}
            />
            <TextLink
              onPress={handleSave}
              busy={isBusy}
              disabled={isAnyBusy}
              accessibilityLabel={`Save ${label}`}
            >
              Save
            </TextLink>
            <TextLink onPress={handleCancel} disabled={isAnyBusy}>
              Cancel
            </TextLink>
          </View>
        ) : (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <Text
              variant="small"
              color={hasValue ? theme.text : theme.textFaint}
              style={{ fontFamily: fonts.bodyMedium }}
            >
              {hasValue ? value : 'Not set'}
            </Text>
            {editable ? (
              <TextLink
                onPress={handleEdit}
                disabled={isAnyBusy}
                accessibilityLabel={`Edit ${label}`}
              >
                Edit
              </TextLink>
            ) : null}
          </View>
        )
      }
    />
  );
}

// ─── Read-only display row (immutable identity) ───────────────────────────────

function ReadonlyRow({
  label,
  sublabel,
  value,
  strongRule,
}: {
  label: string;
  sublabel?: string;
  value: string | null;
  strongRule?: boolean;
}) {
  const theme = useTheme();
  const hasValue = !!value && value.trim() !== '';
  return (
    <PrefRow
      strongRule={strongRule}
      label={label}
      sublabel={sublabel}
      control={
        <Text
          variant="small"
          color={hasValue ? theme.text : theme.textFaint}
          style={{ fontFamily: fonts.bodyMedium }}
        >
          {hasValue ? value : 'Not set'}
        </Text>
      }
    />
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function Settings() {
  const theme = useTheme();
  const router = useRouter();
  const reduce = useReduceMotion();

  const profile = useSession((s) => s.profile);
  const booted = useSession((s) => s.booted);
  const refreshProfile = useSession((s) => s.refreshProfile);
  const refreshBrands = useSession((s) => s.refreshBrands);
  const boot = useSession((s) => s.boot);

  const [analyticsOptIn, setAnalyticsOptIn] = useState(false);
  const [busy, setBusy] = useState<BusyAction>(null);
  const [error, setError] = useState<string | null>(null);
  const [exportWarning, setExportWarning] = useState<string | null>(null);

  // Brand form
  const [showAddBrand, setShowAddBrand] = useState(false);
  const [newBrandName, setNewBrandName] = useState('');
  const [newVariantName, setNewVariantName] = useState('Regular');
  const [newPackSize, setNewPackSize] = useState('20');
  const [newAvgPrice, setNewAvgPrice] = useState('');
  const [newCategory, setNewCategory] = useState<Brand['category']>('regular');

  useEffect(() => {
    let mounted = true;
    void (async () => {
      const value = await getSetting<boolean>('consent.analyticsOptIn');
      if (mounted) setAnalyticsOptIn(value === true);
    })();
    return () => { mounted = false; };
  }, []);

  // ─── Handlers ───────────────────────────────────────────────────────────────

  const saveBaseline = async (draft: string, onDone: () => void) => {
    setBusy('save-baseline');
    setError(null);
    try {
      const parsed = draft.trim() === '' ? null : Number(draft);
      if (parsed != null && (!Number.isFinite(parsed) || parsed < 0)) {
        throw new Error('Baseline must be a valid number.');
      }
      await updateProfile({ baselinePerDay: parsed });
      await refreshProfile();
      onDone();
    } catch (e) {
      setError(toSafeErrorMessage(e, 'validation_error'));
    } finally {
      setBusy(null);
    }
  };

  const saveMobile = async (raw: string, onDone: () => void) => {
    setBusy('save-mobile');
    setError(null);
    try {
      const trimmed = raw.trim();
      const value = trimmed === '' ? null : normalizeToE164(trimmed);
      if (trimmed !== '' && value === null) {
        throw new Error('Enter a valid mobile number.');
      }
      await updateProfile({ mobileE164: value });
      await refreshProfile();
      onDone();
    } catch (e) {
      // The DB trigger rejects a change inside the 30-day window — surface the
      // specific disclaimer rather than the generic rate-limit copy.
      if (isAppError(e) && e.code === 'rate_limited') {
        setError('You can change your mobile number only once every 30 days.');
      } else {
        setError(toSafeErrorMessage(e, 'validation_error'));
      }
    } finally {
      setBusy(null);
    }
  };

  const savePlace = async (raw: string, onDone: () => void) => {
    setBusy('save-place');
    setError(null);
    try {
      const trimmed = raw.trim();
      await updateProfile({ place: trimmed === '' ? null : trimmed });
      await refreshProfile();
      onDone();
    } catch (e) {
      setError(toSafeErrorMessage(e, 'validation_error'));
    } finally {
      setBusy(null);
    }
  };

  const toggleProfile = async (
    key: 'discreetMode' | 'hideTotalsOnHome',
    value: boolean,
    actionKey: BusyAction,
  ) => {
    setBusy(actionKey);
    setError(null);
    try {
      await updateProfile({ [key]: value } as Record<string, boolean>);
      await refreshProfile();
      if (key === 'discreetMode' && value) {
        void track(AnalyticsEvents.DISCREET_MODE_ENABLED, { enabled: true });
      }
    } catch (e) {
      setError(toSafeErrorMessage(e, 'dependency_failure'));
    } finally {
      setBusy(null);
    }
  };

  const toggleAnalytics = async (value: boolean) => {
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
      setError(toSafeErrorMessage(e, 'dependency_failure'));
    } finally {
      setBusy(null);
    }
  };

  const exportData = async () => {
    setBusy('export-json');
    setError(null);
    setExportWarning(null);
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
      void track(AnalyticsEvents.EXPORT_REQUESTED, { format: 'json' });
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

  const addCustomBrand = async () => {
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
      void track(AnalyticsEvents.BRAND_CREATED, { category: newCategory, is_seed: false });
      setNewBrandName('');
      setNewVariantName('Regular');
      setNewPackSize('20');
      setNewAvgPrice('');
      setNewCategory('regular');
      setShowAddBrand(false);
    } catch (e) {
      setError(toSafeErrorMessage(e, 'validation_error'));
    } finally {
      setBusy(null);
    }
  };

  const signOut = () => {
    Alert.alert('Sign out?', 'Your data stays. You can sign back in anywhere.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: async () => {
          setBusy('signout');
          setError(null);
          try {
            // Fire the farewell overlay first; bridge the visual gap so the
            // user sees the wave-off rather than a blank flash before /login.
            dispatchFarewell();
            await new Promise((r) => setTimeout(r, 1600));
            await getSupabase().auth.signOut();
            router.replace('/login');
          } catch (e) {
            setError(toSafeErrorMessage(e, 'dependency_failure'));
          } finally {
            setBusy(null);
          }
        },
      },
    ]);
  };

  const returnHome = () => {
    Alert.alert(
      'Return to the home screen?',
      'You will be signed out and taken back to the sign-in screen. Your data is saved — you can sign back in anytime.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign out & leave',
          style: 'destructive',
          onPress: async () => {
            setBusy('return-home');
            setError(null);
            try {
              dispatchFarewell();
              await new Promise((r) => setTimeout(r, 1600));
              await getSupabase().auth.signOut();
              router.replace('/login');
            } catch (e) {
              setError(toSafeErrorMessage(e, 'dependency_failure'));
            } finally {
              setBusy(null);
            }
          },
        },
      ],
    );
  };

  const deleteAccount = () => {
    Alert.alert(
      'Delete your account permanently?',
      'This removes your authentication account, every log, every preference, and every custom brand. It is permanent and cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete account',
          style: 'destructive',
          onPress: async () => {
            setBusy('delete-account');
            setError(null);
            let isReauthRedirect = false;
            try {
              await deleteUserAccount({
                onReauthRequired: () => {
                  isReauthRedirect = true;
                  router.replace('/login?reason=reauth');
                },
              });
              // Best-effort local cleanup; never block the redirect on it.
              try {
                await wipeSecureStore();
              } catch {
                // Ignore — deletion already succeeded.
              }
              router.replace('/login');
            } catch (e) {
              if (!isReauthRedirect) {
                setError(toSafeErrorMessage(e, 'dependency_failure'));
              }
            } finally {
              setBusy(null);
            }
          },
        },
      ],
    );
  };

  const eraseAll = () => {
    Alert.alert(
      'Erase all app data?',
      'This keeps your login and re-seeds default brands. All your logs, goals, and custom data will be erased and cannot be recovered.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Erase data',
          style: 'destructive',
          onPress: async () => {
            setBusy('erase-all');
            setError(null);
            try {
              await cancelAll();
              await eraseAllUserData();
              await wipeSecureStore();
              await boot();
              router.replace('/onboarding/welcome');
            } catch (e) {
              setError(toSafeErrorMessage(e, 'dependency_failure'));
            } finally {
              setBusy(null);
            }
          },
        },
      ],
    );
  };

  // ─── Loading / error guards ──────────────────────────────────────────────────

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
        <Pressable
          onPress={() => void refreshProfile()}
          accessibilityRole="button"
          accessibilityLabel="Retry loading profile"
          style={{ marginTop: spacing.md }}
        >
          <Text variant="small" color={theme.accent} style={{ textDecorationLine: 'underline' }}>
            Retry
          </Text>
        </Pressable>
      </Screen>
    );
  }

  const currentBaseline =
    profile.baselinePerDay != null ? String(profile.baselinePerDay) : '';

  const age = profile.dateOfBirth ? computeAge(profile.dateOfBirth) : null;
  const ageText = age != null ? `${age} years` : null;
  const genderText = profile.gender ? GENDER_LABELS[profile.gender] : null;
  const mobileEditable = canChangeMobile(profile.mobileChangedAt, new Date());
  const mobileNext = nextMobileChangeDate(profile.mobileChangedAt);
  const mobileSublabel =
    !mobileEditable && mobileNext
      ? `Used for support only. Changeable once every 30 days — next change on ${mobileNext.toLocaleDateString()}.`
      : 'Used for support only. Changeable once every 30 days.';

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <Screen>

      {/* ── Masthead ── */}
      <Stage index={0} reduce={reduce}>
        <View style={{ gap: spacing.sm }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
            <View style={{ flex: 1, height: 1, backgroundColor: theme.ruleStrong }} />
            <Text
              variant="caption"
              color={theme.textMuted}
              style={{ textTransform: 'uppercase', letterSpacing: 1.8 }}
            >
              Settings
            </Text>
            <View style={{ flex: 1, height: 1, backgroundColor: theme.ruleStrong }} />
          </View>
          <Text
            variant="small"
            muted
            style={{ textAlign: 'center', fontStyle: 'italic' }}
          >
            Preferences, policies, the way out.
          </Text>
        </View>
      </Stage>

      {/* ── Appearance ── */}
      <Stage index={1} reduce={reduce}>
        <View style={{ gap: spacing.md }}>
          <SectionHead
            caption="Appearance"
            deck="Choose how the app looks. Auto follows your system setting."
          />
          <PrefRow
            strongRule
            label="Theme"
            sublabel="Light · Auto · Dark"
            control={<ThemeToggle />}
          />
        </View>
      </Stage>

      {/* ── Daily baseline ── */}
      <Stage index={2} reduce={reduce}>
        <View style={{ gap: spacing.md }}>
          <SectionHead
            caption="Daily baseline"
            deck="The number of cigarettes that counts as your usual day. Everything on the dashboard is read against this."
          />
          <BaselineSection
            initialBaseline={currentBaseline}
            busy={busy}
            reduce={reduce}
            onSave={saveBaseline}
          />
        </View>
      </Stage>

      {/* ── Profile ── */}
      <Stage index={2.5} reduce={reduce}>
        <View style={{ gap: spacing.md }}>
          <SectionHead
            caption="Profile"
            deck="Your name, age, and gender are set once at signup and can't be changed. Mobile number and place are optional."
          />
          <View>
            <ReadonlyRow strongRule label="Name" value={profile.fullName ?? null} />
            <ReadonlyRow label="Age" value={ageText} />
            <ReadonlyRow label="Gender" value={genderText} />
            <InlineEditRow
              label="Mobile number"
              sublabel={mobileSublabel}
              value={profile.mobileE164 ?? null}
              placeholder="+91…"
              keyboardType="phone-pad"
              busyKey="save-mobile"
              busy={busy}
              editable={mobileEditable}
              onSave={saveMobile}
            />
            <InlineEditRow
              label="Place"
              sublabel="City or region (optional)."
              value={profile.place ?? null}
              placeholder="e.g. Mumbai"
              busyKey="save-place"
              busy={busy}
              onSave={savePlace}
            />
          </View>
        </View>
      </Stage>

      {/* ── Privacy ── */}
      <Stage index={3} reduce={reduce}>
        <View style={{ gap: spacing.md }}>
          <SectionHead
            caption="Privacy"
            deck="What this device shows you, and what — if anything — leaves it."
          />
          <View>
            <PrefRow
              strongRule
              label="Discreet mode"
              sublabel="Mask totals and brand names on the home screen."
              control={
                <EditorialSwitch
                  value={profile.discreetMode}
                  onValueChange={(v) => void toggleProfile('discreetMode', v, 'toggle-discreet')}
                  disabled={busy !== null}
                  accessibilityLabel="Discreet mode"
                />
              }
            />
            <PrefRow
              label="Hide totals on home"
              sublabel="Collapse the headline number and spend on the dashboard."
              control={
                <EditorialSwitch
                  value={profile.hideTotalsOnHome}
                  onValueChange={(v) => void toggleProfile('hideTotalsOnHome', v, 'toggle-hide')}
                  disabled={busy !== null}
                  accessibilityLabel="Hide totals on home"
                />
              }
            />
            <PrefRow
              label="Anonymous analytics"
              sublabel="Opt-in, first-party event counts only. No log content, no brand names, no prices."
              control={
                <EditorialSwitch
                  value={analyticsOptIn}
                  onValueChange={(v) => void toggleAnalytics(v)}
                  disabled={busy !== null}
                  accessibilityLabel="Anonymous analytics"
                />
              }
            />
          </View>
        </View>
      </Stage>

      {/* ── Brand catalog ── */}
      <Stage index={4} reduce={reduce}>
        <View style={{ gap: spacing.md }}>
          <SectionHead
            caption="Brand catalog"
            deck="Add brands and variants when your preferred option is not already listed."
          />
          <PrefRow
            strongRule
            label="Add a custom brand"
            sublabel="Local to your account; never shared with other users."
            control={
              <TextLink
                onPress={() => setShowAddBrand((open) => !open)}
                disabled={busy !== null}
                accessibilityLabel={showAddBrand ? 'Hide brand form' : 'Add brand'}
              >
                {showAddBrand ? 'Hide form' : 'Add brand'}
              </TextLink>
            }
          />

          {showAddBrand ? (
            <View
              style={{
                borderTopWidth: 1,
                borderTopColor: theme.rule,
                paddingTop: spacing.md,
                gap: spacing.md,
              }}
            >
              {/* Brand name */}
              <View style={{ gap: spacing.xs }}>
                <Text
                  variant="caption"
                  color={theme.textMuted}
                  style={{ textTransform: 'uppercase', letterSpacing: 1.6 }}
                >
                  Brand name
                </Text>
                <TextInput
                  value={newBrandName}
                  onChangeText={setNewBrandName}
                  placeholder="e.g. Camel"
                  placeholderTextColor={theme.textFaint}
                  autoCapitalize="words"
                  accessibilityLabel="Brand name"
                  style={{
                    color: theme.text,
                    fontFamily: fonts.body,
                    fontSize: typography.body.fontSize,
                    borderBottomWidth: 1,
                    borderBottomColor: theme.ruleStrong,
                    paddingVertical: spacing.xs,
                  }}
                />
              </View>

              {/* Variant + Pack size + Avg price */}
              <View style={{ flexDirection: 'row', gap: spacing.md }}>
                <View style={{ flex: 1, gap: spacing.xs }}>
                  <Text
                    variant="caption"
                    color={theme.textMuted}
                    style={{ textTransform: 'uppercase', letterSpacing: 1.6 }}
                  >
                    Variant
                  </Text>
                  <TextInput
                    value={newVariantName}
                    onChangeText={setNewVariantName}
                    placeholder="e.g. Blue"
                    placeholderTextColor={theme.textFaint}
                    accessibilityLabel="Variant name"
                    style={{
                      color: theme.text,
                      fontFamily: fonts.body,
                      fontSize: typography.body.fontSize,
                      borderBottomWidth: 1,
                      borderBottomColor: theme.ruleStrong,
                      paddingVertical: spacing.xs,
                    }}
                  />
                </View>
                <View style={{ flex: 1, gap: spacing.xs }}>
                  <Text
                    variant="caption"
                    color={theme.textMuted}
                    style={{ textTransform: 'uppercase', letterSpacing: 1.6 }}
                  >
                    Pack size
                  </Text>
                  <TextInput
                    value={newPackSize}
                    onChangeText={setNewPackSize}
                    keyboardType="number-pad"
                    placeholder="20"
                    placeholderTextColor={theme.textFaint}
                    accessibilityLabel="Pack size"
                    style={{
                      color: theme.text,
                      fontFamily: fonts.body,
                      fontSize: typography.body.fontSize,
                      borderBottomWidth: 1,
                      borderBottomColor: theme.ruleStrong,
                      paddingVertical: spacing.xs,
                    }}
                  />
                </View>
                <View style={{ flex: 1, gap: spacing.xs }}>
                  <Text
                    variant="caption"
                    color={theme.textMuted}
                    style={{ textTransform: 'uppercase', letterSpacing: 1.6 }}
                  >
                    Avg price (₹)
                  </Text>
                  <TextInput
                    value={newAvgPrice}
                    onChangeText={setNewAvgPrice}
                    keyboardType="decimal-pad"
                    placeholder="optional"
                    placeholderTextColor={theme.textFaint}
                    accessibilityLabel="Average price in rupees"
                    style={{
                      color: theme.text,
                      fontFamily: fonts.body,
                      fontSize: typography.body.fontSize,
                      borderBottomWidth: 1,
                      borderBottomColor: theme.ruleStrong,
                      paddingVertical: spacing.xs,
                    }}
                  />
                </View>
              </View>

              {/* Category chips */}
              <View style={{ gap: spacing.xs }}>
                <Text
                  variant="caption"
                  color={theme.textMuted}
                  style={{ textTransform: 'uppercase', letterSpacing: 1.6 }}
                >
                  Category
                </Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
                  {(['budget', 'regular', 'premium', 'imported', 'other'] as Brand['category'][]).map(
                    (cat) => (
                      <Chip
                        key={cat}
                        label={cat}
                        selected={newCategory === cat}
                        onPress={() => setNewCategory(cat)}
                      />
                    ),
                  )}
                </View>
              </View>

              {/* Form actions */}
              <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.md, paddingTop: spacing.xs }}>
                <TextLink onPress={() => setShowAddBrand(false)} disabled={busy !== null}>
                  Cancel
                </TextLink>
                <TextLink
                  onPress={() => void addCustomBrand()}
                  busy={busy === 'add-brand'}
                  disabled={busy !== null}
                  accessibilityLabel="Save new brand"
                >
                  Save brand
                </TextLink>
              </View>
            </View>
          ) : null}
        </View>
      </Stage>

      {/* ── Your data ── */}
      <Stage index={5} reduce={reduce}>
        <View style={{ gap: spacing.md }}>
          <SectionHead
            caption="Your data"
            deck="Export everything you have recorded, or erase the log without closing the account."
          />
          <View>
            <PrefRow
              strongRule
              label="Export your data"
              sublabel="JSON file with your profile, logs, and brand catalogue."
              control={
                <TextLink
                  onPress={() => void exportData()}
                  busy={busy === 'export-json'}
                  disabled={busy !== null}
                  accessibilityLabel="Export data (JSON)"
                >
                  Export data (JSON)
                </TextLink>
              }
            />
            {exportWarning ? (
              <View style={{ paddingVertical: spacing.sm }}>
                <Text variant="small" color={theme.warnEarth} style={{ fontStyle: 'italic' }}>
                  {exportWarning}
                </Text>
              </View>
            ) : null}
            <PrefRow
              label="Erase all log data"
              sublabel="Removes every cigarette log, goal, and custom brand. Your account and login stay."
              control={
                <TextLink
                  onPress={eraseAll}
                  busy={busy === 'erase-all'}
                  disabled={busy !== null}
                  destructive
                  accessibilityLabel="Erase all app data"
                >
                  Erase all app data
                </TextLink>
              }
            />
          </View>
        </View>
      </Stage>

      {/* ── Account ── */}
      <Stage index={6} reduce={reduce}>
        <View style={{ gap: spacing.md }}>
          <SectionHead
            caption="Account"
            deck="Return to the home screen, sign out of this device, or close the account entirely."
          />
          <View>
            <PrefRow
              strongRule
              label="Return to home screen"
              sublabel="Signs you out and returns to the sign-in screen. Your data is saved."
              control={
                <TextLink
                  onPress={returnHome}
                  busy={busy === 'return-home'}
                  disabled={busy !== null}
                  accessibilityLabel="Return to home screen"
                >
                  Go home
                </TextLink>
              }
            />
            <PrefRow
              label="Sign out of this device"
              sublabel="Your data stays. You can sign back in anywhere."
              control={
                <TextLink
                  onPress={signOut}
                  busy={busy === 'signout'}
                  disabled={busy !== null}
                  accessibilityLabel="Sign out"
                >
                  Sign out
                </TextLink>
              }
            />
            <PrefRow
              label="Delete account permanently"
              sublabel="All your logs, preferences, and audit history are erased. This is permanent."
              control={
                <TextLink
                  onPress={deleteAccount}
                  busy={busy === 'delete-account'}
                  disabled={busy !== null}
                  destructive
                  accessibilityLabel="Delete account — permanent"
                >
                  Delete account
                </TextLink>
              }
            />
          </View>
        </View>
      </Stage>

      {/* ── About ── */}
      <Stage index={7} reduce={reduce}>
        <View style={{ gap: spacing.md }}>
          <SectionHead
            caption="About"
            deck="Cessation support for smoking behaviour and spend in INR. No advertising SDKs. This is not medical advice."
          />
          <View>
            <PrefRow
              strongRule
              label="Privacy policy"
              sublabel={undefined}
              control={
                <TextLink
                  onPress={() => void Linking.openURL(LEGAL_URLS.privacy)}
                  accessibilityLabel="Open privacy policy"
                >
                  Open
                </TextLink>
              }
            />
            <PrefRow
              label="Terms of service"
              sublabel={undefined}
              control={
                <TextLink
                  onPress={() => void Linking.openURL(LEGAL_URLS.terms)}
                  accessibilityLabel="Open terms of service"
                >
                  Open
                </TextLink>
              }
            />
            <PrefRow
              label="Support"
              sublabel={undefined}
              control={
                <TextLink
                  onPress={() => void Linking.openURL(LEGAL_URLS.support)}
                  accessibilityLabel="Open support"
                >
                  Open
                </TextLink>
              }
            />
          </View>
          <Text variant="caption" faint style={{ paddingTop: spacing.xs }}>
            v0.2.0
          </Text>
        </View>
      </Stage>

      {/* ── Status / error stripe ── */}
      {error ? (
        <View
          accessible
          accessibilityRole="alert"
          accessibilityLiveRegion="polite"
          style={{ paddingTop: spacing.sm }}
        >
          <Text variant="small" color={theme.warnEarth}>
            {error}
          </Text>
        </View>
      ) : null}

      {/* ── End-mark ── */}
      <View
        style={{
          borderTopWidth: 1,
          borderTopColor: theme.rule,
          paddingTop: spacing.md,
          alignItems: 'center',
        }}
      >
        <Text variant="caption" faint style={{ fontStyle: 'italic' }}>
          Set quietly. Reviewed quietly.
        </Text>
      </View>

    </Screen>
  );
}
