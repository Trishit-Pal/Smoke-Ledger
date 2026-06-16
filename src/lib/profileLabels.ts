import type { Gender } from '@/types';

/** Human-readable labels for the stored gender enum. Shared by signup + settings. */
export const GENDER_LABELS: Record<Gender, string> = {
  male: 'Male',
  female: 'Female',
  other: 'Other',
  undisclosed: 'Prefer not to say',
};
