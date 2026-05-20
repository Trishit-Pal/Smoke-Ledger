import type { TriggerTag } from '@/types';

export interface TriggerOption {
  value: TriggerTag;
  label: string;
}

export const TRIGGER_OPTIONS: TriggerOption[] = [
  { value: 'morning', label: 'Morning' },
  { value: 'after_meal', label: 'After meal' },
  { value: 'stress', label: 'Stress' },
  { value: 'boredom', label: 'Boredom' },
  { value: 'social', label: 'Social' },
  { value: 'caffeine', label: 'Tea / coffee' },
  { value: 'alcohol', label: 'Alcohol' },
  { value: 'work_break', label: 'Work break' },
  { value: 'other', label: 'Other' },
];

export function triggerLabel(tag: TriggerTag | null | undefined): string {
  if (!tag) return '—';
  return TRIGGER_OPTIONS.find((t) => t.value === tag)?.label ?? tag;
}
