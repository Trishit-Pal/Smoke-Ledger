// Domain types for Smoke Ledger India
// All monetary values in INR (paise not tracked; rupees as number for UX simplicity).

export type PurchaseMode = 'single' | 'pack' | 'carton' | 'custom';
export type PriceSource = 'exact' | 'estimated' | 'inferred' | 'unknown';
export type Mood = 'calm' | 'stressed' | 'bored' | 'social' | 'tired' | 'anxious' | 'neutral';
export type ContextTag =
  | 'alone'
  | 'friends'
  | 'work_break'
  | 'commute'
  | 'after_meal'
  | 'stress'
  | 'party'
  | 'tea_coffee'
  | 'alcohol'
  | 'other';
export type TriggerTag =
  | 'morning'
  | 'after_meal'
  | 'stress'
  | 'boredom'
  | 'social'
  | 'caffeine'
  | 'alcohol'
  | 'work_break'
  | 'other';

export interface Brand {
  id: string;
  name: string;
  category: 'budget' | 'regular' | 'premium' | 'imported' | 'other';
  isSeed: boolean;
  isFavorite: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface BrandVariant {
  id: string;
  brandId: string;
  name: string;
  defaultPackSize: number;
  avgPriceInr: number | null;
  lastPriceInr: number | null;
  lastPricedAt: string | null;
}

export interface CigaretteLog {
  id: string;
  tsUtc: string; // ISO
  localDate: string; // YYYY-MM-DD in Asia/Kolkata
  localHour: number; // 0..23
  brandId: string | null;
  brandNameSnap: string | null;
  variantSnap: string | null;
  quantity: number; // sticks
  purchaseMode: PurchaseMode;
  packSize: number | null;
  totalPriceInr: number | null;
  unitPriceInr: number | null;
  priceSource: PriceSource;
  triggerTag: TriggerTag | null;
  moodBefore: Mood | null;
  moodAfter: Mood | null;
  craving: number | null; // 0..10
  contextTag: ContextTag | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export type GoalType =
  | 'daily_cap'
  | 'spend_cap_daily'
  | 'no_smoke_window'
  | 'reduction_target'
  | 'weekly_target'
  | 'quit_date';

export interface Goal {
  id: string;
  type: GoalType;
  targetValue: number; // interpretation depends on type
  currentBaseline: number | null;
  startDate: string; // YYYY-MM-DD
  endDate: string | null;
  status: 'active' | 'paused' | 'completed' | 'abandoned';
  meta: Record<string, unknown> | null; // e.g., window start/end hours
  createdAt: string;
}

export type OnboardingStep = 'privacy' | 'setup' | 'baseline' | 'brands' | 'goal' | 'done';

export interface UserProfile {
  baselinePerDay: number | null;
  baselineWindowDays: number; // 7|30|custom
  currency: 'INR';
  discreetMode: boolean;
  appLockEnabled: boolean;
  hideTotalsOnHome: boolean;
  onboardedAt: string | null;
  onboardingStep?: OnboardingStep | null;
  ageConfirmedAt?: string | null;
  termsVersion?: string | null;
  privacyVersion?: string | null;
  healthDisclaimerVersion?: string | null;
  dataProcessingConsentAt?: string | null;
  marketingConsentAt?: string | null;
}

export interface Insight {
  id: string;
  title: string;
  explanation: string;
  evidence: string;
  confidence: 'low' | 'medium' | 'high';
  severity: 'info' | 'watch' | 'act';
  generatedAt: string;
}

export interface DailyStat {
  date: string; // YYYY-MM-DD
  sticks: number;
  spendInr: number;
}
