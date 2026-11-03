import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Text } from '@/components/ui/Text';
import { Divider } from '@/components/ui/Divider';
import { spacing, fonts } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';
import type { Row } from '@/domain/ledgerChat/types';
import { maskNumbers } from '@/lib/discreet';
import { proseMasked as isProseMasked, rowDisplay, rowMasked } from '@/lib/askView';
import type { CurrencyCode } from '@/lib/regions';

export interface AskTurnData {
  id: string;
  question: string;
  answer: string;
  rows: Row[];
}

interface AskTurnProps {
  turn: AskTurnData;
  /** Totals hidden (discreet mode or hide-totals): figures start masked, tap to reveal. */
  hidden: boolean;
  currency: CurrencyCode;
  locale?: string;
}

const MIN_TARGET = 44;

/**
 * One exchange: the question in italic display type, figures as hairline label /
 * value lines, then the model's paragraph with a quiet "Written by AI" caption.
 * Masking happens here, at the render site, for the rows and for figures the
 * paragraph repeats; reveals live in component state and die with the screen.
 */
export function AskTurn({ turn, hidden, currency, locale }: AskTurnProps) {
  const theme = useTheme();
  const [revealed, setRevealed] = useState<ReadonlySet<string>>(() => new Set());
  const reveal = (key: string) => setRevealed((prev) => new Set(prev).add(key));

  const proseKey = 'answer';
  const proseMasked = isProseMasked(turn.answer, hidden, revealed.has(proseKey));
  const paragraphs = turn.answer
    .split(/\n+/)
    .filter((p) => p.trim().length > 0)
    .map((p, i) => (
      <Text key={i} variant="body">
        {maskNumbers(p, proseMasked)}
      </Text>
    ));

  return (
    <View style={{ gap: spacing.sm, paddingTop: spacing.md }}>
      <Divider />
      <Text variant="h3" style={{ fontFamily: fonts.displaySoft, fontStyle: 'italic', fontWeight: '400' }}>
        {turn.question}
      </Text>

      {turn.rows.length > 0 ? (
        <View accessibilityRole="list">
          {turn.rows.map((row, i) => {
            const masked = rowMasked(row, hidden, revealed);
            const display = rowDisplay(row, masked, { currency, locale });
            const label = masked ? `${row.label} hidden, double tap to reveal` : `${row.label} ${display}`;
            return (
              <Pressable
                key={row.id}
                disabled={!masked}
                onPress={() => reveal(row.id)}
                accessibilityRole={masked ? 'button' : 'text'}
                accessibilityLabel={label}
                style={{
                  minHeight: MIN_TARGET,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: spacing.md,
                  borderTopWidth: i === 0 ? 0 : 1,
                  borderTopColor: theme.rule,
                  paddingVertical: spacing.sm,
                }}
              >
                <Text variant="small" muted style={{ flex: 1 }}>
                  {row.label}
                </Text>
                <Text variant="bodyStrong">{display}</Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}

      {proseMasked ? (
        <Pressable
          onPress={() => reveal(proseKey)}
          accessibilityRole="button"
          accessibilityLabel="Answer with figures hidden, double tap to reveal"
          style={{ gap: spacing.sm }}
        >
          {paragraphs}
        </Pressable>
      ) : (
        <View style={{ gap: spacing.sm }}>{paragraphs}</View>
      )}

      <Text variant="caption" muted style={{ textTransform: 'uppercase', letterSpacing: 1.4 }}>
        Written by AI
      </Text>
    </View>
  );
}
