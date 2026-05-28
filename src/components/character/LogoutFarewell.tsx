// LogoutFarewell — full-screen farewell overlay (RN port).
//
// Listens for `character:farewell` events. Renders a paper-noise overlay with
// the wave-off figure + "Until tomorrow." copy. The caller is responsible for
// the actual signOut + navigation; this overlay simply bridges the visual gap.
//
// Usage in a sign-out handler:
//   dispatchFarewell();
//   await new Promise((r) => setTimeout(r, 1600));
//   await supabase.auth.signOut();
//   router.replace('/login');
//
// Mount ONCE near the app root.

import React from 'react';
import { Modal, View } from 'react-native';
import { Figure } from './Figure';
import { PaperNoise } from '@/components/ui/PaperNoise';
import { Text } from '@/components/ui/Text';
import { useTheme } from '@/hooks/useTheme';
import { fonts, spacing } from '@/constants/theme';
import { onFarewell } from '@/lib/character/mood';

const SAFETY_DISMISS_MS = 3200;

export function LogoutFarewell() {
  const theme = useTheme();
  const [open, setOpen] = React.useState(false);
  const safetyTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    const sub = onFarewell(() => {
      setOpen(true);
      // Safety net: if the caller doesn't navigate (the layout would normally
      // unmount this Modal on route change), auto-dismiss after a few seconds
      // so the screen isn't stuck behind an overlay.
      if (safetyTimer.current) clearTimeout(safetyTimer.current);
      safetyTimer.current = setTimeout(() => setOpen(false), SAFETY_DISMISS_MS);
    });
    return () => {
      sub.remove();
      if (safetyTimer.current) clearTimeout(safetyTimer.current);
    };
  }, []);

  return (
    <Modal
      visible={open}
      transparent={false}
      animationType="fade"
      onRequestClose={() => setOpen(false)}
      accessibilityViewIsModal
    >
      <View
        accessibilityLabel="Signed out"
        accessibilityLiveRegion="polite"
        style={{
          flex: 1,
          backgroundColor: theme.bgElevated,
          alignItems: 'center',
          justifyContent: 'center',
          padding: spacing.xl,
          gap: spacing.sm,
        }}
      >
        <PaperNoise />
        <Figure mood="bye" size={160} />
        <Text
          variant="caption"
          style={{ textTransform: 'uppercase', letterSpacing: 1.6, color: theme.textMuted }}
        >
          Signed out
        </Text>
        <Text
          variant="display"
          style={{
            textAlign: 'center',
            color: theme.text,
            fontFamily: fonts.displaySoft,
            marginTop: spacing.xs,
          }}
        >
          Until tomorrow.
        </Text>
        <Text
          variant="small"
          muted
          style={{ textAlign: 'center', maxWidth: 320, lineHeight: 20, marginTop: spacing.xs }}
        >
          The ledger will be here when you are. Be kind to yourself in the meantime.
        </Text>
        <View style={{ width: 80, borderTopWidth: 1, borderTopColor: theme.rule, marginTop: spacing.md }} />
      </View>
    </Modal>
  );
}
