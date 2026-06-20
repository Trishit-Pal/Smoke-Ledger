import React from 'react';
import { Modal, Pressable, ScrollView, View } from 'react-native';
import { Text } from '@/components/ui/Text';
import { useTheme } from '@/hooks/useTheme';
import { useReduceMotion } from '@/hooks/useReduceMotion';
import { spacing, radius } from '@/constants/theme';

// ThemedSelect — a theme-aware dropdown. The trigger matches the surrounding
// fields; tapping it opens a modal list whose background tracks the active
// theme (theme.bg), with option text in the theme's foreground (theme.text,
// the near-opposite of the background) and the selected option highlighted
// with the brand accent. Reads `useTheme()` so it re-themes live.

export interface ThemedSelectOption {
  value: string;
  label: string;
}

interface ThemedSelectProps {
  value: string | null | undefined;
  onChange: (value: string) => void;
  options: ThemedSelectOption[];
  placeholder?: string;
  accessibilityLabel?: string;
}

export function ThemedSelect({
  value,
  onChange,
  options,
  placeholder = 'Select…',
  accessibilityLabel,
}: ThemedSelectProps) {
  const theme = useTheme();
  const reduce = useReduceMotion();
  const [open, setOpen] = React.useState(false);

  const selected = options.find((o) => o.value === value) ?? null;

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityState={{ expanded: open }}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          height: 44,
          paddingHorizontal: spacing.md,
          borderWidth: 1,
          borderColor: theme.rule,
          borderRadius: radius.md,
          backgroundColor: theme.bgElevated,
        }}
      >
        <Text variant="body" color={selected ? theme.text : theme.textFaint}>
          {selected ? selected.label : placeholder}
        </Text>
        <Text variant="body" color={theme.textMuted}>
          ▾
        </Text>
      </Pressable>

      <Modal
        visible={open}
        transparent
        animationType={reduce ? 'none' : 'fade'}
        onRequestClose={() => setOpen(false)}
      >
        <Pressable
          onPress={() => setOpen(false)}
          accessibilityLabel="Dismiss"
          style={{
            flex: 1,
            backgroundColor: 'rgba(11,15,20,0.32)',
            justifyContent: 'center',
            padding: spacing.lg,
          }}
        >
          {/* stop-propagation container */}
          <Pressable
            onPress={() => {
              /* swallow tap inside the sheet */
            }}
            style={{
              backgroundColor: theme.bg,
              borderRadius: radius.md,
              borderWidth: 1,
              borderColor: theme.ruleStrong,
              overflow: 'hidden',
              maxHeight: '70%',
            }}
          >
            <ScrollView>
              {options.map((opt) => {
                const isSelected = opt.value === value;
                return (
                  <Pressable
                    key={opt.value}
                    onPress={() => {
                      onChange(opt.value);
                      setOpen(false);
                    }}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isSelected }}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      paddingVertical: spacing.md,
                      paddingHorizontal: spacing.lg,
                      backgroundColor: isSelected ? theme.accentSoft : 'transparent',
                    }}
                  >
                    <Text variant="body" color={isSelected ? theme.accent : theme.text}>
                      {opt.label}
                    </Text>
                    {isSelected ? (
                      <Text variant="body" color={theme.accent}>
                        ✓
                      </Text>
                    ) : null}
                  </Pressable>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

export default ThemedSelect;
