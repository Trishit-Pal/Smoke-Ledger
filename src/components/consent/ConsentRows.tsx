import React from 'react';
import { Linking, Pressable, Switch, View } from 'react-native';
import { Text } from '@/components/ui/Text';
import { Divider } from '@/components/ui/Divider';
import { ConsentNotice } from '@/components/ask/ConsentNotice';
import { spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';
import { LEGAL_URLS } from '@/lib/legal';
import {
  AGREEMENT_LABEL_PARTS,
  AGREEMENT_SUB,
  HEALTH_CONSENT_LABEL,
  HEALTH_CONSENT_SUB,
} from '@/lib/healthConsent';
import type { ChatAnswer } from '@/lib/consentForm';

// The consent rows, shared by the onboarding privacy step and the /consent
// re-consent screen so the wording and links cannot drift.

const ROW_TARGET = 44;

interface ConsentRowProps {
  index: number;
  /** Plain text of the row: the spoken label, and the visible one unless `content` is given. */
  label: string;
  /** Visible label when it carries links; `label` is still what a screen reader hears. */
  content?: React.ReactNode;
  sub?: string;
  required: boolean;
  value: boolean;
  onChange: (value: boolean) => void;
  showBottomRule: boolean;
}

export function ConsentRow({ index, label, content, sub, required, value, onChange, showBottomRule }: ConsentRowProps) {
  const theme = useTheme();
  return (
    <View>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'flex-start',
          gap: spacing.md,
          paddingVertical: spacing.md,
        }}
      >
        {/* Row number */}
        <Text
          variant="caption"
          color={value ? theme.accent : theme.textFaint}
          style={{ minWidth: 22, letterSpacing: 0.5, marginTop: 2 }}
        >
          {String(index).padStart(2, '0')}
        </Text>

        {/* Label + sub */}
        <View style={{ flex: 1, gap: spacing.xs }}>
          <Text variant="small" color={theme.text}>
            {content ?? label}
          </Text>
          {sub ? (
            <Text variant="caption" color={theme.textFaint}>
              {sub}
            </Text>
          ) : null}
          {!required ? (
            <Text variant="caption" color={theme.textFaint} style={{ fontStyle: 'italic' }}>
              optional
            </Text>
          ) : null}
        </View>

        {/* Switch */}
        <Switch
          accessibilityLabel={label}
          value={value}
          onValueChange={onChange}
          trackColor={{ false: theme.border, true: theme.accent }}
          thumbColor={value ? theme.bgElevated : theme.textFaint}
        />
      </View>
      {showBottomRule ? <Divider /> : null}
    </View>
  );
}

interface TickRowProps {
  index: number;
  value: boolean;
  onChange: (value: boolean) => void;
  showBottomRule: boolean;
}

/** Tick 1: age, Terms, Privacy Policy and the medical-advice note, in one line. */
export function AgreementRow({ index, value, onChange, showBottomRule }: TickRowProps) {
  const theme = useTheme();
  const { before, terms, middle, privacy, after } = AGREEMENT_LABEL_PARTS;
  const link = (text: string, url: string) => (
    <Text
      variant="small"
      color={theme.accent}
      style={{ textDecorationLine: 'underline' }}
      accessibilityRole="link"
      onPress={() => Linking.openURL(url)}
    >
      {text}
    </Text>
  );
  return (
    <ConsentRow
      index={index}
      label={`${before}${terms}${middle}${privacy}${after}`}
      content={
        <>
          {before}
          {link(terms, LEGAL_URLS.terms)}
          {middle}
          {link(privacy, LEGAL_URLS.privacy)}
          {after}
        </>
      }
      sub={AGREEMENT_SUB}
      required
      value={value}
      onChange={onChange}
      showBottomRule={showBottomRule}
    />
  );
}

/** Tick 2: the unticked Art 9 consent, on its own line. */
export function HealthConsentRow({ index, value, onChange, showBottomRule }: TickRowProps) {
  return (
    <ConsentRow
      index={index}
      label={HEALTH_CONSENT_LABEL}
      sub={HEALTH_CONSENT_SUB}
      required
      value={value}
      onChange={onChange}
      showBottomRule={showBottomRule}
    />
  );
}

function ChoiceButton({ selected, onPress, title }: { selected: boolean; onPress: () => void; title: string }) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ selected }}
      style={{
        flex: 1,
        minHeight: ROW_TARGET,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: spacing.lg,
        borderWidth: 1,
        borderRadius: 10,
        borderColor: selected ? theme.accent : theme.ruleStrong,
        backgroundColor: selected ? theme.accentSoft : 'transparent',
      }}
    >
      {/* The tick marks the choice in words as well as colour. */}
      <Text variant="bodyStrong" color={theme.text}>
        {selected ? `✓ ${title}` : title}
      </Text>
    </Pressable>
  );
}

interface ChatChoiceRowProps {
  /** null until the reader chooses; there is no default. */
  answer: ChatAnswer;
  onAnswer: (turnOn: boolean) => void;
  index: number;
}

/** Ask the ledger: the full notice and an equal Yes / No pair, neither chosen. */
export function ChatChoiceRow({ answer, onAnswer, index }: ChatChoiceRowProps) {
  const theme = useTheme();
  return (
    <View style={{ paddingVertical: spacing.md, gap: spacing.md }}>
      <View style={{ flexDirection: 'row', gap: spacing.md }}>
        <Text
          variant="caption"
          color={answer === null ? theme.textFaint : theme.accent}
          style={{ minWidth: 22, letterSpacing: 0.5, marginTop: 2 }}
        >
          {String(index).padStart(2, '0')}
        </Text>
        <View style={{ flex: 1, gap: spacing.sm }}>
          <Text variant="bodyStrong">Turn on Ask the ledger?</Text>
          <ConsentNotice />
        </View>
      </View>
      <View style={{ flexDirection: 'row', gap: spacing.md }}>
        <ChoiceButton selected={answer === true} onPress={() => onAnswer(true)} title="Yes, turn it on" />
        <ChoiceButton selected={answer === false} onPress={() => onAnswer(false)} title="No, thanks" />
      </View>
    </View>
  );
}
