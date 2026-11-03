import React, { useEffect, useState } from 'react';
import { Pressable, Switch, View } from 'react-native';
import { Text } from '@/components/ui/Text';
import { spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';
import { LEDGER_CHAT_SETTINGS_SUBLABEL } from '@/domain/ledgerChat/notice';
import { describeError } from '@/lib/errors';
import { readLedgerChatOptIn, setLedgerChatOptIn } from '@/services/ledgerChat';
import { ConsentNotice } from './ConsentNotice';

const LABEL = 'Ask the ledger';

function LinkButton({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      style={{ minHeight: 44, justifyContent: 'center', opacity: disabled ? 0.5 : 1 }}
    >
      <Text variant="small" style={{ textDecorationLine: 'underline', textDecorationColor: theme.ruleStrong }}>
        {label}
      </Text>
    </Pressable>
  );
}

/**
 * Settings › Privacy row for the Ask the ledger opt-in. Turning it on shows the
 * same notice the Ask screen shows and waits for a plain "Turn on"; turning it
 * off is direct. The caller renders this only when the build flag is on.
 */
export function LedgerChatSetting() {
  const theme = useTheme();
  const [on, setOn] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    readLedgerChatOptIn()
      .then((value) => {
        if (mounted) setOn(value);
      })
      .catch(() => {
        // Unreadable counts as off; the switch can still be used.
      });
    return () => {
      mounted = false;
    };
  }, []);

  const save = async (value: boolean) => {
    setBusy(true);
    setError(null);
    try {
      await setLedgerChatOptIn(value);
      setOn(value);
      setConfirming(false);
    } catch (e) {
      setError(describeError(e, 'dependency_failure'));
    } finally {
      setBusy(false);
    }
  };

  const onToggle = (value: boolean) => {
    if (value) setConfirming(true);
    else void save(false);
  };

  return (
    <View style={{ borderTopWidth: 1, borderTopColor: theme.rule, paddingVertical: spacing.md, gap: spacing.md }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md }}>
        <View style={{ flex: 1, gap: spacing.xs }}>
          <Text variant="body">{LABEL}</Text>
          <Text variant="small" muted style={{ maxWidth: 280 }}>
            {LEDGER_CHAT_SETTINGS_SUBLABEL}
          </Text>
        </View>
        <Switch
          value={on || confirming}
          onValueChange={onToggle}
          disabled={busy}
          trackColor={{ false: theme.rule, true: theme.accent }}
          thumbColor={on || confirming ? theme.bg : theme.textFaint}
          ios_backgroundColor={theme.rule}
          accessibilityLabel={LABEL}
          accessibilityRole="switch"
          accessibilityState={{ checked: on, disabled: busy }}
        />
      </View>
      {confirming ? (
        <View style={{ gap: spacing.sm }}>
          <ConsentNotice />
          <View style={{ flexDirection: 'row', gap: spacing.lg }}>
            <LinkButton label="Turn on" onPress={() => void save(true)} disabled={busy} />
            <LinkButton label="Not now" onPress={() => setConfirming(false)} disabled={busy} />
          </View>
        </View>
      ) : null}
      {error ? (
        <Text variant="small" color={theme.warnEarth}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}
