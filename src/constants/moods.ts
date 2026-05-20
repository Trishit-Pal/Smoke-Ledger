import type { Mood } from '@/types';

export interface MoodOption {
  value: Mood;
  label: string;
}

export const MOOD_OPTIONS: MoodOption[] = [
  { value: 'calm', label: 'Calm' },
  { value: 'stressed', label: 'Stressed' },
  { value: 'bored', label: 'Bored' },
  { value: 'social', label: 'Social' },
  { value: 'tired', label: 'Tired' },
  { value: 'anxious', label: 'Anxious' },
  { value: 'neutral', label: 'Neutral' },
];

export function moodLabel(m: Mood | null | undefined): string {
  if (!m) return '—';
  return MOOD_OPTIONS.find((o) => o.value === m)?.label ?? m;
}
