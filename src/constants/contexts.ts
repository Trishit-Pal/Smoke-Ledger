import type { ContextTag } from '@/types';

export interface ContextOption {
  value: ContextTag;
  label: string;
}

export const CONTEXT_OPTIONS: ContextOption[] = [
  { value: 'alone', label: 'Alone' },
  { value: 'friends', label: 'With friends' },
  { value: 'work_break', label: 'Work break' },
  { value: 'commute', label: 'Commute' },
  { value: 'after_meal', label: 'After meal' },
  { value: 'stress', label: 'Stress' },
  { value: 'party', label: 'Party' },
  { value: 'tea_coffee', label: 'Tea / coffee' },
  { value: 'alcohol', label: 'Alcohol' },
  { value: 'other', label: 'Other' },
];

export function contextLabel(c: ContextTag | null | undefined): string {
  if (!c) return '—';
  return CONTEXT_OPTIONS.find((o) => o.value === c)?.label ?? c;
}
