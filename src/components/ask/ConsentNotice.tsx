import React from 'react';
import { View } from 'react-native';
import { Text } from '@/components/ui/Text';
import { spacing } from '@/constants/theme';
import { LEDGER_CHAT_NOTICE } from '@/domain/ledgerChat/notice';
import { mobileNoticeParagraphs } from '@/lib/askView';

/** The shared notice, shown wherever Ask the ledger can be turned on. */
export function ConsentNotice() {
  const [lead, ...rest] = mobileNoticeParagraphs();
  return (
    <View style={{ gap: spacing.sm }}>
      {/* The lead stays first and plain; the detail follows in muted small text. */}
      <Text variant="body">{lead ?? LEDGER_CHAT_NOTICE.lead}</Text>
      {rest.map((line) => (
        <Text key={line} variant="small" muted>
          {line}
        </Text>
      ))}
    </View>
  );
}
