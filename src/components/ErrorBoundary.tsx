import React from 'react';
import { View } from 'react-native';
import { Text } from '@/components/ui/Text';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { spacing } from '@/constants/theme';

interface State { error: Error | null }

/**
 * Last-line-of-defense boundary. Wraps a screen / nav stack and renders a
 * recovery card on render errors instead of letting RN's red-box crash the
 * whole app for the user.
 */
export class ErrorBoundary extends React.Component<React.PropsWithChildren<{ label?: string }>, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error) {
    if (__DEV__) console.warn('[ErrorBoundary]', error);
  }

  reset = () => this.setState({ error: null });

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <View style={{ flex: 1, padding: spacing.lg, justifyContent: 'center' }}>
        <Card>
          <View style={{ gap: spacing.md }}>
            <Text variant="h2">Something went wrong</Text>
            <Text variant="small" muted>
              {this.props.label ? `${this.props.label} — ` : ''}
              {this.state.error.message || 'Unknown error.'} You can try again without losing your data.
            </Text>
            <Button title="Try again" onPress={this.reset} />
          </View>
        </Card>
      </View>
    );
  }
}
