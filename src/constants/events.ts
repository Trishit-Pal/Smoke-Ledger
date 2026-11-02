// Privacy-aware analytics event schema.
// Events are written to Supabase `usage_events` (RLS, per user). No third-party SDKs.
//
// Design rule: payloads must NOT carry UUIDs, per-row IDs, or user-input text.
// Use aggregate/enum fields only so no downstream consumer can reconstruct timelines.

import type { BrandCategory, GoalType } from '@/types';

export const AnalyticsEvents = {
  APP_OPENED: 'app_opened',
  ONBOARDING_COMPLETED: 'onboarding_completed',
  CIGARETTE_LOGGED: 'cigarette_logged',
  QUICK_ADD_USED: 'quick_add_used',
  REPEAT_LAST_USED: 'repeat_last_used',
  LOG_EDITED: 'log_edited',
  LOG_DELETED: 'log_deleted',
  GOAL_CREATED: 'goal_created',
  GOAL_PROGRESS_VIEWED: 'goal_progress_viewed',
  INSIGHT_VIEWED: 'insight_viewed',
  REPORT_VIEWED: 'report_viewed',
  REMINDER_ENABLED: 'reminder_enabled',
  EXPORT_REQUESTED: 'export_requested',
  DISCREET_MODE_ENABLED: 'discreet_mode_enabled',
  BRAND_CREATED: 'brand_created',
  BRAND_FAVORITED: 'brand_favorited',
  LEDGER_CHAT_ASKED: 'ledger_chat_asked',
} as const;

export type AnalyticsEvent = (typeof AnalyticsEvents)[keyof typeof AnalyticsEvents];

export interface EventPayloadMap {
  app_opened: { first_open?: boolean };
  onboarding_completed: { baseline_per_day?: number; goal_set?: boolean };
  cigarette_logged: {
    quantity: number;
    mode: string;
    has_price: boolean;
    price_source: string;
  };
  quick_add_used: Record<string, never>;
  repeat_last_used: Record<string, never>;
  // field_changed tracks WHICH kind of edit occurred, not which row.
  // Pass undefined/omit when the edit site doesn't know the changed field.
  log_edited: { field_changed?: 'quantity' | 'price' | 'time' | 'meta' | 'multiple' };
  // Knowing a deletion occurred is enough; the row ID adds no analytics value.
  log_deleted: Record<string, never>;
  goal_created: { type: GoalType };
  // goal_type replaces goal_id — identifies which kind of goal was viewed, not which row.
  goal_progress_viewed: { goal_type: GoalType };
  // insight_category replaces insight_id — per-session IDs are ephemeral random values
  // (generated via makeId), not canonical seeds, so they constitute soft PII.
  insight_viewed: { insight_category: 'time_of_day' | 'trigger' | 'trend' | 'brand' | 'dow' | 'onboarding' };
  report_viewed: { report: string };
  reminder_enabled: { kind: string };
  export_requested: { format: 'csv' | 'json' };
  discreet_mode_enabled: { enabled: boolean };
  // category + is_seed replace brand_name (user-input text) and brand_id (UUID).
  brand_created: { category: BrandCategory; is_seed: boolean };
  // Same treatment: category + is_seed instead of brand_id UUID.
  brand_favorited: { category: BrandCategory; is_seed: boolean };
  // Whether a starter was tapped and which tools answered (names from a fixed set
  // the route validates); never the question or the answer.
  ledger_chat_asked: { starter: boolean; tools: string[] };
}
