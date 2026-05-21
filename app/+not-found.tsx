import React from 'react';
import { View } from 'react-native';
import { Link } from 'expo-router';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { Button } from '@/components/ui/Button';
import { spacing } from '@/constants/theme';

export default function NotFound() {
  return (
    <Screen>
      <View style={{ gap: spacing.lg, flex: 1, justifyContent: 'center' }}>
        <Text variant="h1">Page not found</Text>
        <Text variant="body" muted>
          This screen does not exist in Smoke Ledger.
        </Text>
        <Link href="/(tabs)" asChild>
          <Button title="Go to dashboard" fullWidth />
        </Link>
      </View>
    </Screen>
  );
}
