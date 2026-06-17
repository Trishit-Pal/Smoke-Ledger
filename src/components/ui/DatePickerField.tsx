import React, { useMemo, useState } from 'react';
import { Modal, Pressable, View, FlatList } from 'react-native';
import dayjs from 'dayjs';
import { Text } from './Text';
import { useTheme } from '@/hooks/useTheme';
import { useReduceMotion } from '@/hooks/useReduceMotion';
import { radius, spacing, type Theme } from '@/constants/theme';
import { MIN_AGE } from '@/domain/age';

// Oldest plausible age — bounds the year wheel so it isn't a thousand rows.
const MAX_AGE = 120;
const ROW_HEIGHT = 44;
const VISIBLE_ROWS = 5;
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export interface DatePickerFieldProps {
  label?: string;
  /** Committed value as a strict 'YYYY-MM-DD' string, or '' when unset. */
  value: string;
  onChange: (ymd: string) => void;
  hint?: string;
  error?: string | null;
  placeholder?: string;
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function daysInMonth(year: number, month: number): number {
  return dayjs(`${year}-${pad(month)}-01`).daysInMonth();
}

/**
 * Theme-aware date-of-birth picker. The closed state mirrors `Input` so it sits
 * cleanly among the other signup fields; tapping opens a bottom-sheet with three
 * tap-to-select columns (day / month / year). Output is always a strict
 * 'YYYY-MM-DD' string, so `computeAge`/`YmdSchema` validation is unchanged.
 *
 * The year wheel is capped at `currentYear - MIN_AGE`, reinforcing the 18+ gate
 * at the UI; the exact within-year boundary is still enforced by `computeAge` on
 * submit. Honors reduce-motion by dropping the sheet's slide animation.
 */
export function DatePickerField({
  label,
  value,
  onChange,
  hint,
  error,
  placeholder = 'Select date',
}: DatePickerFieldProps) {
  const theme = useTheme();
  const reduceMotion = useReduceMotion();
  const [open, setOpen] = useState(false);

  const currentYear = dayjs().year();
  const maxYear = currentYear - MIN_AGE; // latest birth year that can already be 18+
  const minYear = currentYear - MAX_AGE;
  const defaultYear = Math.min(maxYear, currentYear - 25);

  const years = useMemo(() => {
    const out: number[] = [];
    for (let y = maxYear; y >= minYear; y -= 1) out.push(y);
    return out;
  }, [maxYear, minYear]);
  const months = useMemo(() => MONTH_NAMES.map((name, i) => ({ name, value: i + 1 })), []);

  const parsed = /^\d{4}-\d{2}-\d{2}$/.test(value) ? dayjs(value) : null;

  const [tempY, setTempY] = useState<number>(parsed ? parsed.year() : defaultYear);
  const [tempM, setTempM] = useState<number>(parsed ? parsed.month() + 1 : 1);
  const [tempD, setTempD] = useState<number>(parsed ? parsed.date() : 1);

  const days = useMemo(() => {
    const count = daysInMonth(tempY, tempM);
    return Array.from({ length: count }, (_, i) => i + 1);
  }, [tempY, tempM]);

  const openSheet = () => {
    // Re-sync working state from the committed value every time the sheet opens.
    if (parsed) {
      setTempY(parsed.year());
      setTempM(parsed.month() + 1);
      setTempD(parsed.date());
    } else {
      setTempY(defaultYear);
      setTempM(1);
      setTempD(1);
    }
    setOpen(true);
  };

  const confirm = () => {
    const clampedDay = Math.min(tempD, daysInMonth(tempY, tempM));
    onChange(`${tempY}-${pad(tempM)}-${pad(clampedDay)}`);
    setOpen(false);
  };

  const selectMonth = (m: number) => {
    setTempM(m);
    setTempD((d) => Math.min(d, daysInMonth(tempY, m)));
  };
  const selectYear = (y: number) => {
    setTempY(y);
    setTempD((d) => Math.min(d, daysInMonth(y, tempM)));
  };

  const display = parsed ? parsed.format('D MMMM YYYY') : placeholder;

  return (
    <View style={{ gap: spacing.xs }}>
      {label ? (
        <Text variant="caption" muted style={{ textTransform: 'uppercase', letterSpacing: 1.6 }}>
          {label}
        </Text>
      ) : null}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label ?? 'Date'}: ${parsed ? parsed.format('D MMMM YYYY') : 'not set'}`}
        onPress={openSheet}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          borderWidth: 1,
          borderColor: error ? theme.danger : theme.rule,
          borderRadius: radius.md,
          backgroundColor: theme.bgElevated,
          paddingHorizontal: spacing.md,
          minHeight: 48,
        }}
      >
        <Text variant="body" color={parsed ? theme.text : theme.textFaint} style={{ flex: 1 }}>
          {display}
        </Text>
      </Pressable>

      {error ? (
        <Text variant="small" color={theme.danger}>{error}</Text>
      ) : hint ? (
        <Text variant="small" muted>{hint}</Text>
      ) : null}

      <Modal
        visible={open}
        transparent
        animationType={reduceMotion ? 'none' : 'slide'}
        onRequestClose={() => setOpen(false)}
      >
        <View style={{ flex: 1, justifyContent: 'flex-end' }}>
          {/* Dimmed backdrop sits behind the sheet so taps outside dismiss, but the
              sheet's own scroll gestures are never intercepted by a wrapping Pressable. */}
          <Pressable
            accessibilityLabel="Dismiss date picker"
            onPress={() => setOpen(false)}
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(11,15,20,0.45)' }}
          />
          <View
            style={{
              backgroundColor: theme.bgElevated,
              borderTopLeftRadius: radius.xl,
              borderTopRightRadius: radius.xl,
              borderTopWidth: 1,
              borderColor: theme.rule,
              paddingTop: spacing.lg,
              paddingBottom: spacing.xxl,
              paddingHorizontal: spacing.lg,
              gap: spacing.md,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Pressable accessibilityRole="button" onPress={() => setOpen(false)} hitSlop={8}>
                <Text variant="body" muted>Cancel</Text>
              </Pressable>
              <Text variant="h3">{label ?? 'Select date'}</Text>
              <Pressable accessibilityRole="button" onPress={confirm} hitSlop={8}>
                <Text variant="bodyStrong" color={theme.accent}>Done</Text>
              </Pressable>
            </View>

            <View style={{ flexDirection: 'row', height: ROW_HEIGHT * VISIBLE_ROWS }}>
              <WheelColumn
                flex={2}
                data={days}
                selectedValue={tempD}
                getValue={(d) => d}
                getLabel={(d) => String(d)}
                onSelect={setTempD}
                theme={theme}
              />
              <WheelColumn
                flex={3}
                data={months}
                selectedValue={tempM}
                getValue={(m) => m.value}
                getLabel={(m) => m.name}
                onSelect={selectMonth}
                theme={theme}
              />
              <WheelColumn
                flex={3}
                data={years}
                selectedValue={tempY}
                getValue={(y) => y}
                getLabel={(y) => String(y)}
                onSelect={selectYear}
                theme={theme}
              />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

interface WheelColumnProps<T> {
  flex: number;
  data: T[];
  selectedValue: number;
  getValue: (item: T) => number;
  getLabel: (item: T) => string;
  onSelect: (value: number) => void;
  theme: Theme;
}

function WheelColumn<T>({
  flex,
  data,
  selectedValue,
  getValue,
  getLabel,
  onSelect,
  theme,
}: WheelColumnProps<T>) {
  const listRef = React.useRef<FlatList<T>>(null);
  const selectedIndex = Math.max(0, data.findIndex((d) => getValue(d) === selectedValue));
  return (
    <FlatList
      ref={listRef}
      style={{ flex }}
      data={data}
      keyExtractor={(item) => String(getValue(item))}
      initialScrollIndex={selectedIndex}
      getItemLayout={(_, index) => ({ length: ROW_HEIGHT, offset: ROW_HEIGHT * index, index })}
      // initialScrollIndex isn't reliable before layout (esp. Android); retry once
      // the list has measured so the selected row is in view.
      onScrollToIndexFailed={(info) => {
        setTimeout(() => {
          listRef.current?.scrollToIndex({ index: info.index, animated: false });
        }, 50);
      }}
      showsVerticalScrollIndicator={false}
      renderItem={({ item }) => {
        const v = getValue(item);
        const isSelected = v === selectedValue;
        return (
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: isSelected }}
            onPress={() => onSelect(v)}
            style={{ height: ROW_HEIGHT, alignItems: 'center', justifyContent: 'center' }}
          >
            <Text variant={isSelected ? 'bodyStrong' : 'body'} color={isSelected ? theme.accent : theme.textMuted}>
              {getLabel(item)}
            </Text>
          </Pressable>
        );
      }}
    />
  );
}
